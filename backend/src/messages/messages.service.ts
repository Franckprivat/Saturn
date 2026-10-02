import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SENDER_SELECT = {
  id: true,
  nickname: true,
  image: true,
  avatarColor: true,
} as const;

const MESSAGE_INCLUDE = {
  sender: { select: SENDER_SELECT },
  replyTo: {
    include: { sender: { select: SENDER_SELECT } },
  },
  reactions: {
    include: { user: { select: { id: true, nickname: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  readBy: {
    select: { userId: true, readAt: true },
  },
  deliveredTo: {
    select: { userId: true, deliveredAt: true },
  },
};

/**
 * Filtre Prisma des messages visibles par `userId` : les chuchotements ne sont
 * visibles que par leur auteur et leurs destinataires.
 */
export function visibleTo(userId: string) {
  return {
    OR: [
      { isWhisper: false },
      { senderId: userId },
      { whisperTo: { has: userId } },
    ],
  };
}

/** True si `userId` fait partie de l'audience du message. */
export function canSeeMessage(
  msg: { isWhisper: boolean; senderId: string; whisperTo: string[] },
  userId: string,
) {
  return (
    !msg.isWhisper || msg.senderId === userId || msg.whisperTo.includes(userId)
  );
}

export const MAX_MESSAGE_LENGTH = 4000;

function normalizeContent(content: unknown): string {
  const text = typeof content === 'string' ? content.trim() : '';
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new BadRequestException(
      `Message trop long (${MAX_MESSAGE_LENGTH} caractères max)`,
    );
  }
  return text;
}

/**
 * Une pièce jointe doit venir de notre propre stockage (route /upload) :
 * sinon n'importe quelle URL externe (pixel de traçage…) s'afficherait dans le chat.
 */
function validateAttachment(file: {
  fileUrl: string;
  fileName: string;
  fileType: string;
}) {
  const url = typeof file.fileUrl === 'string' ? file.fileUrl.trim() : '';
  const r2 = process.env.R2_PUBLIC_URL?.replace(/\/+$/, '');
  const ownUpload =
    /^\/uploads\/[\w.-]+$/.test(url) ||
    (!!r2 &&
      url.startsWith(`${r2}/uploads/`) &&
      /^[\w.-]+$/.test(url.slice(r2.length + 9)));
  if (!ownUpload) throw new BadRequestException('Pièce jointe invalide');
  const fileType =
    typeof file.fileType === 'string' ? file.fileType.trim().slice(0, 100) : '';
  if (!/^[\w.+-]+\/[\w.+-]+$/.test(fileType))
    throw new BadRequestException('Type de fichier invalide');
  const fileName =
    (typeof file.fileName === 'string' ? file.fileName : 'fichier').slice(
      0,
      255,
    ) || 'fichier';
  return { fileUrl: url, fileName, fileType };
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureParticipant(userId: string, conversationId: string) {
    // Salon de communauté : l'accès dépend de l'appartenance à la communauté
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, communityId: true },
    });
    if (conv?.type === 'CHANNEL' && conv.communityId) {
      const member = await this.prisma.communityMember.count({
        where: { communityId: conv.communityId, userId },
      });
      if (!member)
        throw new ForbiddenException(
          'Vous ne faites pas partie de cette communauté',
        );
      return;
    }
    // DM / groupe : vérification classique des participants
    const count = await this.prisma.conversationParticipant.count({
      where: { userId, conversationId },
    });
    if (!count)
      throw new ForbiddenException(
        'You are not a participant of this conversation',
      );
  }

  /** Vérifie que tous les `userIds` ont accès à la conversation. */
  private async ensureAllCanAccess(conversationId: string, userIds: string[]) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, communityId: true },
    });
    const count =
      conv?.type === 'CHANNEL' && conv.communityId
        ? await this.prisma.communityMember.count({
            where: { communityId: conv.communityId, userId: { in: userIds } },
          })
        : await this.prisma.conversationParticipant.count({
            where: { conversationId, userId: { in: userIds } },
          });
    if (count !== userIds.length) {
      throw new BadRequestException('Destinataire de chuchotement invalide');
    }
  }

  /** Message visible par `userId` (participant + audience du chuchotement). */
  async getVisibleMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    await this.ensureParticipant(userId, msg.conversationId);
    if (!canSeeMessage(msg, userId))
      throw new NotFoundException('Message not found');
    return msg;
  }

  async getMessagesForConversation(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.ensureParticipant(userId, conversationId);
    const take = Math.min(
      Math.max(Number.isFinite(limit) ? limit : 50, 1),
      100,
    );
    const messages = await this.prisma.message.findMany({
      where: { conversationId, ...visibleTo(userId) },
      orderBy: { createdAt: 'desc' },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });
    const hasMore = messages.length > take;
    const items = hasMore ? messages.slice(0, take) : messages;
    return {
      messages: items.reverse(),
      nextCursor: hasMore ? items[0].id : null,
      hasMore,
    };
  }

  async searchMessages(conversationId: string, userId: string, query: string) {
    await this.ensureParticipant(userId, conversationId);
    return this.prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        type: 'MESSAGE',
        content: { contains: query, mode: 'insensitive' },
        ...visibleTo(userId),
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: MESSAGE_INCLUDE,
    });
  }

  /** Dans un DM, on ne peut plus écrire si l'un des deux a bloqué l'autre. */
  private async ensureNotBlocked(userId: string, conversationId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true, participants: { select: { userId: true } } },
    });
    if (conv?.type !== 'DM') return;
    const other = conv.participants.find((p) => p.userId !== userId);
    if (!other) return;
    const blocked = await this.prisma.friendship.count({
      where: {
        status: 'BLOCKED',
        OR: [
          { requesterId: userId, addresseeId: other.userId },
          { requesterId: other.userId, addresseeId: userId },
        ],
      },
    });
    if (blocked)
      throw new ForbiddenException(
        'Vous ne pouvez pas envoyer de message à cet utilisateur',
      );
  }

  async createMessage(
    userId: string,
    conversationId: string,
    content: string,
    file?: { fileUrl: string; fileName: string; fileType: string },
    whisperTo?: string[],
    replyToId?: string,
  ) {
    await this.ensureParticipant(userId, conversationId);
    await this.ensureNotBlocked(userId, conversationId);

    content = normalizeContent(content);
    if (file) file = validateAttachment(file);
    if (!content && !file) throw new BadRequestException('Message vide');

    // Une réponse doit cibler un message de la même conversation
    // Destinataires d'un chuchotement : uniquement des participants, sans doublon
    const recipients = Array.isArray(whisperTo)
      ? Array.from(
          new Set(
            whisperTo.filter((id) => typeof id === 'string' && id !== userId),
          ),
        ).slice(0, 50)
      : [];
    if (recipients.length) {
      await this.ensureAllCanAccess(conversationId, recipients);
    }
    const isWhisper = recipients.length > 0;

    // Une réponse doit cibler un message de la même conversation, visible par l'auteur
    if (replyToId) {
      const target = await this.prisma.message.findUnique({
        where: { id: replyToId },
        select: {
          conversationId: true,
          isWhisper: true,
          senderId: true,
          whisperTo: true,
        },
      });
      if (
        !target ||
        target.conversationId !== conversationId ||
        !canSeeMessage(target, userId)
      ) {
        throw new NotFoundException(
          'Message cité introuvable dans cette conversation',
        );
      }
      // Citer un chuchotement en public le révélerait à toute la conversation
      if (target.isWhisper && !isWhisper) {
        throw new ForbiddenException('Réponds à un chuchotement en chuchotant');
      }
    }

    return this.prisma.message.create({
      data: {
        senderId: userId,
        conversationId,
        content,
        ...file,
        isWhisper,
        whisperTo: recipients,
        replyToId: replyToId ?? null,
        type: 'MESSAGE',
      },
      include: MESSAGE_INCLUDE,
    });
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId)
      throw new ForbiddenException('Cannot edit this message');
    if (msg.deletedAt)
      throw new ForbiddenException('Cannot edit a deleted message');
    if (msg.type !== 'MESSAGE')
      throw new ForbiddenException('Cannot edit this message');
    await this.ensureParticipant(userId, msg.conversationId);
    const text = normalizeContent(content);
    if (!text && !msg.fileUrl) throw new BadRequestException('Message vide');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content: text, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
  }

  async createSystemMessage(
    senderId: string,
    conversationId: string,
    content: string,
  ) {
    return this.prisma.message.create({
      data: { senderId, conversationId, content, type: 'SYSTEM' },
      include: MESSAGE_INCLUDE,
    });
  }

  async createCommunityInviteMessage(
    senderId: string,
    conversationId: string,
    meta: {
      communityId: string;
      communityName: string;
      communityImage?: string | null;
      token?: string | null;
    },
  ) {
    return this.prisma.message.create({
      data: {
        senderId,
        conversationId,
        content: `Invitation à rejoindre ${meta.communityName}`,
        type: 'INVITE',
        metadata: meta,
      },
      include: MESSAGE_INCLUDE,
    });
  }

  /** Fenêtre pendant laquelle on peut supprimer son propre message pour tous. */
  private static readonly DELETE_FOR_ALL_WINDOW_MS = 24 * 60 * 60 * 1000;

  async deleteMessage(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { conversation: { include: { participants: true } } },
    });
    if (!msg) throw new NotFoundException('Message not found');

    const isAdmin = msg.conversation.participants.some(
      (p) => p.userId === userId && p.role === 'ADMIN',
    );
    if (msg.senderId !== userId && !isAdmin) {
      throw new ForbiddenException('Cannot delete this message');
    }
    // Ses propres messages : suppression pour tous limitée dans le temps
    // (au-delà, l'option « supprimer pour moi » côté client reste disponible).
    // Les admins de groupe conservent la modération sans limite.
    if (msg.senderId === userId && !isAdmin) {
      const age = Date.now() - new Date(msg.createdAt).getTime();
      if (age > MessagesService.DELETE_FOR_ALL_WINDOW_MS) {
        throw new ForbiddenException(
          'Ce message est trop ancien pour être supprimé pour tout le monde',
        );
      }
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: {
        deletedAt: new Date(),
        content: '',
        fileUrl: null,
        fileName: null,
        fileType: null,
      },
      include: MESSAGE_INCLUDE,
    });
  }

  /** Marque comme « distribués » les messages arrivés sur l'appareil de `userId`. */
  async markAsDelivered(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        deliveredTo: { none: { userId } },
      },
      select: { id: true },
    });
    if (!messages.length) return { count: 0 };
    await this.prisma.deliveryReceipt.createMany({
      data: messages.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });
    return { count: messages.length };
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    // Uniquement les messages pas encore lus (évite de réécrire tous les reçus)
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        readBy: { none: { userId } },
      },
      select: { id: true },
    });
    if (!messages.length) return { count: 0 };
    const data = messages.map((m) => ({
      messageId: m.id,
      userId,
    }));
    await this.prisma.readReceipt.createMany({ data, skipDuplicates: true });
    return { count: data.length };
  }

  async getPinnedMessages(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    return this.prisma.pinnedMessage.findMany({
      where: { conversationId, message: visibleTo(userId) },
      include: { message: { include: MESSAGE_INCLUDE } },
      orderBy: { pinnedAt: 'desc' },
    });
  }

  async pinMessage(conversationId: string, messageId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    const msg = await this.getVisibleMessage(messageId, userId);
    if (msg.conversationId !== conversationId)
      throw new NotFoundException('Message not found');
    // Épingler un chuchotement l'afficherait dans le bandeau de tout le monde
    if (msg.isWhisper)
      throw new ForbiddenException('Un chuchotement ne peut pas être épinglé');
    return this.prisma.pinnedMessage.upsert({
      where: { conversationId_messageId: { conversationId, messageId } },
      create: { conversationId, messageId, pinnedBy: userId },
      update: { pinnedBy: userId, pinnedAt: new Date() },
      include: { message: { include: MESSAGE_INCLUDE } },
    });
  }

  async unpinMessage(
    conversationId: string,
    messageId: string,
    userId: string,
  ) {
    await this.ensureParticipant(userId, conversationId);
    await this.prisma.pinnedMessage.deleteMany({
      where: { conversationId, messageId },
    });
    return { ok: true };
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    if (typeof emoji !== 'string' || !emoji.trim() || emoji.length > 16) {
      throw new BadRequestException('Emoji invalide');
    }
    const msg = await this.getVisibleMessage(messageId, userId);

    const existing = await this.prisma.messageReaction.findUnique({
      where: { messageId_userId: { messageId, userId } },
    });

    if (existing) {
      if (existing.emoji === emoji) {
        await this.prisma.messageReaction.delete({
          where: { messageId_userId: { messageId, userId } },
        });
      } else {
        await this.prisma.messageReaction.update({
          where: { messageId_userId: { messageId, userId } },
          data: { emoji },
        });
      }
    } else {
      await this.prisma.messageReaction.create({
        data: { messageId, userId, emoji },
      });
    }

    const reactions = await this.prisma.messageReaction.findMany({
      where: { messageId },
      include: { user: { select: { id: true, nickname: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      messageId,
      conversationId: msg.conversationId,
      reactions,
      message: msg,
    };
  }
}
