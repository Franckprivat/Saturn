import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';

const USER_SELECT = {
  id: true,
  email: true,
  nickname: true,
  image: true,
  avatarColor: true,
} as const;

const PARTICIPANTS_INCLUDE = {
  include: {
    user: { select: USER_SELECT },
  },
} as const;

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
          where: { fileUrl: { not: null } },
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
  private async filterToFriends(userId: string, candidateIds: string[]): Promise<string[]> {
    const unique = Array.from(new Set(candidateIds)).filter((id) => id && id !== userId);
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
      friendships.map((f) => (f.requesterId === userId ? f.addresseeId : f.requesterId)),
    );
    return unique.filter((id) => friendIds.has(id));
  }

  async createGroupConversation(creatorId: string, name: string, memberIds: string[]) {
    if (!name?.trim()) throw new BadRequestException('Nom du groupe requis');
    const friendMembers = await this.filterToFriends(creatorId, memberIds);
    if (!friendMembers.length) throw new BadRequestException('Ajoute au moins un ami au groupe');
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
    data: { name?: string; description?: string; image?: string },
  ) {
    await this.ensureAdmin(conversationId, userId);
    return this.prisma.conversation.update({
      where: { id: conversationId },
      data,
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async addMembers(conversationId: string, userId: string, memberIds: string[]) {
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
        data: toAdd.map((memberId) => ({ userId: memberId, conversationId, role: 'MEMBER' })),
      });
    }
    return this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async setMemberRole(conversationId: string, requesterId: string, targetUserId: string, role: 'ADMIN' | 'MEMBER') {
    await this.ensureAdmin(conversationId, requesterId);
    return this.prisma.conversationParticipant.updateMany({
      where: { conversationId, userId: targetUserId },
      data: { role },
    });
  }

  async removeMember(conversationId: string, requesterId: string, targetUserId: string) {
    await this.ensureAdmin(conversationId, requesterId);
    return this.prisma.conversationParticipant.deleteMany({
      where: { conversationId, userId: targetUserId },
    });
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
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
        participants: { create: [{ userId: currentUserId }, { userId: otherUserId }] },
      },
      include: { participants: PARTICIPANTS_INCLUDE },
    });
  }

  async generateInviteLink(conversationId: string, userId: string) {
    await this.ensureAdmin(conversationId, userId);
    const token = randomBytes(16).toString('hex');
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { inviteToken: token } });
    return { token };
  }

  async joinByInvite(token: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({ where: { inviteToken: token } });
    if (!conv) throw new NotFoundException('Lien invalide ou expiré');
    const already = await this.prisma.conversationParticipant.count({ where: { conversationId: conv.id, userId } });
    if (!already) {
      await this.prisma.conversationParticipant.create({ data: { conversationId: conv.id, userId, role: 'MEMBER' } });
    }
    return conv;
  }

  async leaveGroup(conversationId: string, userId: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { type: true },
    });
    if (conv?.type !== 'GROUP') throw new ForbiddenException('Seul un groupe peut être quitté');
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new NotFoundException('Not a participant');
    await this.prisma.conversationParticipant.delete({ where: { id: participant.id } });
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
    if (conv?.type !== 'GROUP') throw new ForbiddenException('Seul un groupe peut être supprimé');
    await this.ensureAdmin(conversationId, userId);
    await this.prisma.message.deleteMany({ where: { conversationId } });
    await this.prisma.conversationParticipant.deleteMany({ where: { conversationId } });
    await this.prisma.conversation.delete({ where: { id: conversationId } });
    return { ok: true };
  }

  private async ensureAdmin(conversationId: string, userId: string) {
    const participant = await this.prisma.conversationParticipant.findFirst({
      where: { conversationId, userId },
    });
    if (!participant) throw new ForbiddenException('Not a participant');
    if (participant.role !== 'ADMIN') throw new ForbiddenException('Admin required');
  }
}
