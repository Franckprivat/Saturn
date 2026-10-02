import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';
import { visibleTo } from '../messages/messages.service';

const USER_SELECT = {
  id: true,
  nickname: true,
  image: true,
  avatarColor: true,
  lastSeenAt: true,
} as const;

const PARTICIPANTS_INCLUDE = {
  include: {
    user: { select: USER_SELECT },
  },
} as const;

/** Image de groupe : upload interne ou URL http(s), comme pour les avatars. */
function validateGroupImage(url: unknown): string | null {
  if (url === null || url === '') return null;
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (
    trimmed.length <= 2048 &&
    (/^\/uploads\/[\w.-]+$/.test(trimmed) || /^https?:\/\//i.test(trimmed))
  ) {
    return trimmed;
  }
  throw new BadRequestException('URL image invalide');
}

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friendsService: FriendsService,
  ) {}

  async getUserConversations(userId: string) {
    const participants = await this.prisma.conversationParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: PARTICIPANTS_INCLUDE,
            messages: {
              where: visibleTo(userId),
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: { sender: { select: USER_SELECT } },
            },
          },
        },
      },
    });

    // Tri façon WhatsApp : la conversation la plus récemment active en premier
    return participants
      .map((p) => p.conversation)
      .sort((a, b) => {
        const lastA = a.messages[0]?.createdAt ?? a.createdAt;
        const lastB = b.messages[0]?.createdAt ?? b.createdAt;
        return new Date(lastB).getTime() - new Date(lastA).getTime();
      });
  }

  async getConversationById(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: PARTICIPANTS_INCLUDE,
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: USER_SELECT } },
          where: { fileUrl: { not: null }, ...visibleTo(userId) },
          take: 50,
        },
      },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const isMember = conv.participants.some((p) => p.userId === userId);
    if (!isMember) throw new ForbiddenException('Not a participant');
    return conv;
  }

  /** Ne garde que les utilisateurs réellement amis avec `userId` (anti-spam). */
  private async filterToFriends(
    userId: string,
    candidateIds: string[],
  ): Promise<string[]> {
    const unique = Array.from(new Set(candidateIds)).filter(
      (id) => id && id !== userId,
    );
    if (!unique.length) return [];
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: { in: unique } },
          { addresseeId: userId, requesterId: { in: unique } },
        ],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const friendIds = new Set(
      friendships.map((f) =>
        f.requesterId === userId ? f.addresseeId : f.requesterId,
      ),
    );
    return unique.filter((id) => friendIds.has(id));
  }

  async createGroupConversation(
    creatorId: string,
    name: string,
    memberIds: string[],
  ) {
    if (typeof name !== 'string' || !name.trim())
      throw new BadRequestException('Nom du groupe requis');
    if (name.trim().length > 100)
      throw new BadRequestException(
        'Nom du groupe trop long (100 caractères max)',
      );
    if (!Array.isArray(memberIds))
      throw new BadRequestException('memberIds doit être une liste');
    const friendMembers = await this.filterToFriends(creatorId, memberIds);
    if (!friendMembers.length)
      throw new BadRequestException('Ajoute au moins un ami au groupe');
    const uniqueUserIds = [creatorId, ...friendMembers];
    return this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        name: name.trim(),
        creatorId,
        participants: {
          create: uniqueUserIds.map((userId) => ({
            userId,
            role: userId === creatorId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async updateGroup(
    conversationId: string,
    userId: string,
    data: { name?: string; description?: string | null; image?: string | null },
  ) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conv?.type !== 'GROUP')
      throw new ForbiddenException('Seul un groupe peut être modifié');
    await this.ensureAdmin(conversationId, userId);
    // Liste blanche : type, communityId, inviteToken, creatorId… ne sont pas modifiables
    const update: {
      name?: string;
      description?: string | null;
      image?: string | null;
    } = {};
    if (data.name !== undefined) {
      const name = typeof data.name === 'string' ? data.name.trim() : '';
      if (!name || name.length > 100)
        throw new BadRequestException(
          'Nom du groupe invalide (1 à 100 caractères)',
        );
      update.name = name;
    }
    if (data.description !== undefined) {
      if (data.description !== null && typeof data.description !== 'string') {
        throw new BadRequestException('Description invalide');
      }
      update.description = data.description?.trim().slice(0, 500) || null;
    }
    if (data.image !== undefined) update.image = validateGroupImage(data.image);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: update,
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async addMembers(
    conversationId: string,
    userId: string,
    memberIds: string[],
  ) {
    await this.ensureAdmin(conversationId, userId);
    const friendMembers = await this.filterToFriends(userId, memberIds);
    const existing = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    const existingIds = new Set(existing.map((p) => p.userId));
    const toAdd = friendMembers.filter((id) => !existingIds.has(id));
    if (toAdd.length > 0) {
      await this.prisma.conversationParticipant.createMany({
        data: toAdd.map((memberId) => ({
          userId: memberId,
          conversationId,
          role: 'MEMBER',
        })),
      });
    }
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async setMemberRole(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
    role: 'ADMIN' | 'MEMBER',
  ) {
    if (role !== 'ADMIN' && role !== 'MEMBER') {
      throw new BadRequestException('Rôle invalide');
    }
    await this.ensureAdmin(conversationId, requesterId);
    return this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: targetUserId },
      data: { role },
    });
  }

  async removeMember(
    conversationId: string,
    requesterId: string,
    targetUserId: string,
  ) {
    await this.ensureAdmin(conversationId, requesterId);
    return this.prisma.conversationParticipant.deleteMany({
      where: { conversationId, userId: targetUserId },
    });
  }

  /** Lève une erreur si les deux utilisateurs ne sont pas amis. */
  ensureFriends(userId: string, otherUserId: string) {
    return this.friendsService.ensureAreFriends(userId, otherUserId);
  }

  async isUserInConversation(
    userId: string,
    conversationId: string,
  ): Promise<boolean> {
    const count = await this.prisma.conversationParticipant.count({
      where: { userId, conversationId },
    });
    return count > 0;
  }

  async getOrCreateDmConversation(currentUserId: string, otherUserId: string) {
    await this.friendsService.ensureAreFriends(currentUserId, otherUserId);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DM',
        participants: { some: { userId: currentUserId } },
        AND: { participants: { some: { userId: otherUserId } } },
      },
      include: { participants: PARTICIPANTS_INCLUDE },
    });

    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        type: 'DM',
        participants: {
          create: [{ userId: currentUserId }, { userId: otherUserId }],
        },
      },
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async generateInviteLink(conversationId: string, userId: string) {
    await this.ensureAdmin(conversationId, userId);
    const token = randomBytes(16).toString('hex');
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { inviteToken: token },
    });
    return { token };
  }

  async joinByInvite(token: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { inviteToken: token },
    });
    if (!conv) throw new NotFoundException('Lien invalide ou expiré');
    const already = await this.prisma.conversationParticipant.count({
      where: { conversationId: conv.id, userId },
    });
    if (!already) {
      await this.prisma.conversationParticipant.create({
        data: { conversationId: conv.id, userId, role: 'MEMBER' },
      });
    }
    return conv;
  }

  async leaveGroup(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conv?.type !== 'GROUP')
      throw new ForbiddenException('Seul un groupe peut être quitté');
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new NotFoundException('Not a participant');
    await this.prisma.conversationParticipant.delete({
      where: { id: participant.id },
    });
    // If no admins remain, promote oldest member
    const remaining = await this.prisma.conversationParticipant.findMany({
      where: { conversationId },
      orderBy: { id: 'asc' },
    });
    if (remaining.length > 0) {
      const hasAdmin = remaining.some((p) => p.role === 'ADMIN');
      if (!hasAdmin) {
        await this.prisma.conversationParticipant.update({
          where: { id: remaining[0].id },
          data: { role: 'ADMIN' },
        });
      }
    }
    return { ok: true };
  }

  async deleteGroup(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conv?.type !== 'GROUP')
      throw new ForbiddenException('Seul un groupe peut être supprimé');
    await this.ensureAdmin(conversationId, userId);
    await this.prisma.message.deleteMany({ where: { conversationId } });
    await this.prisma.conversationParticipant.deleteMany({
      where: { conversationId },
    });
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { ok: true };
  }

  private async ensureAdmin(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
    if (participant.role !== 'ADMIN')
      throw new ForbiddenException('Admin required');
  }
}
