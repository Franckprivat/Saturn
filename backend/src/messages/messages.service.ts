import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SENDER_SELECT = {
  id: true,
  email: true,
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
    include: { user: { select: { id: true, nickname: true, email: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
  readBy: {
    select: { userId: true, readAt: true },
  },
};

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureParticipant(userId: string, conversationId: string) {
    const count = await this.prisma.conversationParticipant.count({
      where: { userId, conversationId },
    });
    if (!count) throw new ForbiddenException('You are not a participant of this conversation');
  }

  async getMessagesForConversation(
    conversationId: string,
    userId: string,
    cursor?: string,
    limit = 50,
  ) {
    await this.ensureParticipant(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: MESSAGE_INCLUDE,
    });
    const hasMore = messages.length > limit;
    const items = hasMore ? messages.slice(0, limit) : messages;
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
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: MESSAGE_INCLUDE,
    });
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
    const isWhisper = !!(whisperTo && whisperTo.length > 0);
    return this.prisma.message.create({
      data: {
        senderId: userId,
        conversationId,
        content,
        ...file,
        isWhisper,
        whisperTo: whisperTo ?? [],
        replyToId: replyToId ?? null,
        type: 'MESSAGE',
      },
      include: MESSAGE_INCLUDE,
    });
  }

  async editMessage(messageId: string, userId: string, content: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Message not found');
    if (msg.senderId !== userId) throw new ForbiddenException('Cannot edit this message');
    if (msg.deletedAt) throw new ForbiddenException('Cannot edit a deleted message');
    return this.prisma.message.update({
      where: { id: messageId },
      data: { content, editedAt: new Date() },
      include: MESSAGE_INCLUDE,
    });
  }

  async createSystemMessage(senderId: string, conversationId: string, content: string) {
    return this.prisma.message.create({
      data: { senderId, conversationId, content, type: 'SYSTEM' },
      include: MESSAGE_INCLUDE,
    });
  }

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

    return this.prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: '', fileUrl: null, fileName: null, fileType: null },
      include: MESSAGE_INCLUDE,
    });
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    const messages = await this.prisma.message.findMany({
      where: { conversationId, senderId: { not: userId } },
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
      where: { conversationId },
      include: { message: { include: MESSAGE_INCLUDE } },
      orderBy: { pinnedAt: 'desc' },
    });
  }

  async pinMessage(conversationId: string, messageId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg || msg.conversationId !== conversationId) throw new NotFoundException('Message not found');
    return this.prisma.pinnedMessage.upsert({
      where: { conversationId_messageId: { conversationId, messageId } },
      create: { conversationId, messageId, pinnedBy: userId },
      update: { pinnedBy: userId, pinnedAt: new Date() },
      include: { message: { include: MESSAGE_INCLUDE } },
    });
  }

  async unpinMessage(conversationId: string, messageId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);
    await this.prisma.pinnedMessage.deleteMany({ where: { conversationId, messageId } });
    return { ok: true };
  }

  async toggleReaction(messageId: string, userId: string, emoji: string) {
    const msg = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { conversationId: true },
    });
    if (!msg) throw new NotFoundException('Message not found');

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
      include: { user: { select: { id: true, nickname: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return { messageId, conversationId: msg.conversationId, reactions };
  }
}
