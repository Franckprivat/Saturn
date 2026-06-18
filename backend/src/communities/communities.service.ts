import { ForbiddenException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConversationsService } from '../conversations/conversations.service';
import { MessagesService } from '../messages/messages.service';
import { ChatGateway } from '../chat/chat.gateway';
import { randomBytes } from 'crypto';

type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
const RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

const MEMBER_SELECT = {
  id: true,
  role: true,
  joinedAt: true,
  user: { select: { id: true, email: true, nickname: true, image: true, avatarColor: true } },
} as const;

@Injectable()
export class CommunitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversationsService: ConversationsService,
    private readonly messagesService: MessagesService,
    private readonly chatGateway: ChatGateway,
  ) {}

  private async getMembership(communityId: string, userId: string) {
    const m = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!m) throw new ForbiddenException('Vous ne faites pas partie de cette communauté');
    return m;
  }

  private async requireRole(communityId: string, userId: string, min: Role) {
    const m = await this.getMembership(communityId, userId);
    if (RANK[m.role as Role] < RANK[min]) {
      throw new ForbiddenException('Permissions insuffisantes');
    }
    return m;
  }

  // ── Communautés ──────────────────────────────────────────────────────────

  async getMyCommunities(userId: string) {
    const memberships = await this.prisma.communityMember.findMany({
      where: { userId },
      include: {
        community: {
          include: { _count: { select: { members: true } } },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });
    return memberships.map((m) => ({
      ...m.community,
      myRole: m.role,
      memberCount: m.community._count.members,
    }));
  }

  async createCommunity(userId: string, name: string, description?: string, image?: string) {
    if (!name?.trim()) throw new BadRequestException('Nom requis');

    const community = await this.prisma.community.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        image: image || null,
        ownerId: userId,
        inviteToken: randomBytes(8).toString('hex'),
        members: { create: { userId, role: 'OWNER' } },
      },
    });

    // Catégorie + salons par défaut
    const category = await this.prisma.channelCategory.create({
      data: { communityId: community.id, name: 'Salons textuels', position: 0 },
    });
    const voiceCategory = await this.prisma.channelCategory.create({
      data: { communityId: community.id, name: 'Salons vocaux', position: 1 },
    });

    const conv = await this.prisma.conversation.create({
      data: { type: 'CHANNEL', name: 'général', communityId: community.id },
    });
    await this.prisma.channel.create({
      data: { communityId: community.id, categoryId: category.id, name: 'général', type: 'TEXT', position: 0, conversationId: conv.id },
    });
    await this.prisma.channel.create({
      data: { communityId: community.id, categoryId: voiceCategory.id, name: 'Général', type: 'VOICE', position: 0 },
    });

    return this.getCommunityDetail(community.id, userId);
  }

  async getCommunityDetail(communityId: string, userId: string) {
    await this.getMembership(communityId, userId);
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      include: {
        categories: {
          orderBy: { position: 'asc' },
          include: { channels: { orderBy: { position: 'asc' } } },
        },
        channels: {
          where: { categoryId: null },
          orderBy: { position: 'asc' },
        },
        members: { select: MEMBER_SELECT, orderBy: { joinedAt: 'asc' } },
      },
    });
    if (!community) throw new NotFoundException('Communauté introuvable');
    const me = community.members.find((m) => m.user.id === userId);
    return { ...community, myRole: me?.role ?? 'MEMBER' };
  }

  async updateCommunity(communityId: string, userId: string, data: { name?: string; description?: string; image?: string }) {
    await this.requireRole(communityId, userId, 'ADMIN');
    await this.prisma.community.update({
      where: { id: communityId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.image !== undefined ? { image: data.image } : {}),
      },
    });
    return this.getCommunityDetail(communityId, userId);
  }

  async deleteCommunity(communityId: string, userId: string) {
    const m = await this.getMembership(communityId, userId);
    if (m.role !== 'OWNER') throw new ForbiddenException('Seul le propriétaire peut supprimer la communauté');
    // Supprimer les conversations des salons (cascade gère le reste)
    const channels = await this.prisma.channel.findMany({ where: { communityId, conversationId: { not: null } } });
    const convIds = channels.map((c) => c.conversationId!).filter(Boolean);
    if (convIds.length) {
      await this.prisma.message.deleteMany({ where: { conversationId: { in: convIds } } });
    }
    await this.prisma.community.delete({ where: { id: communityId } });
    if (convIds.length) {
      await this.prisma.conversation.deleteMany({ where: { id: { in: convIds } } });
    }
    return { ok: true };
  }

  // ── Catégories ─────────────────────────────────────────────────────────────

  async createCategory(communityId: string, userId: string, name: string) {
    await this.requireRole(communityId, userId, 'ADMIN');
    const count = await this.prisma.channelCategory.count({ where: { communityId } });
    await this.prisma.channelCategory.create({ data: { communityId, name: name.trim() || 'Nouvelle catégorie', position: count } });
    return this.getCommunityDetail(communityId, userId);
  }

  async deleteCategory(communityId: string, userId: string, categoryId: string) {
    await this.requireRole(communityId, userId, 'ADMIN');
    await this.prisma.channel.updateMany({ where: { categoryId }, data: { categoryId: null } });
    await this.prisma.channelCategory.delete({ where: { id: categoryId } });
    return this.getCommunityDetail(communityId, userId);
  }

  // ── Salons ───────────────────────────────────────────────────────────────

  async createChannel(communityId: string, userId: string, name: string, type: 'TEXT' | 'VOICE', categoryId?: string) {
    await this.requireRole(communityId, userId, 'MODERATOR');
    const count = await this.prisma.channel.count({ where: { communityId, categoryId: categoryId ?? null } });
    let conversationId: string | undefined;
    if (type === 'TEXT') {
      const conv = await this.prisma.conversation.create({
        data: { type: 'CHANNEL', name: name.trim(), communityId },
      });
      conversationId = conv.id;
    }
    await this.prisma.channel.create({
      data: { communityId, categoryId: categoryId ?? null, name: name.trim() || 'nouveau-salon', type, position: count, conversationId },
    });
    return this.getCommunityDetail(communityId, userId);
  }

  async renameChannel(communityId: string, userId: string, channelId: string, name: string) {
    await this.requireRole(communityId, userId, 'MODERATOR');
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.communityId !== communityId) throw new NotFoundException('Salon introuvable');
    await this.prisma.channel.update({ where: { id: channelId }, data: { name: name.trim() } });
    if (channel.conversationId) {
      await this.prisma.conversation.update({ where: { id: channel.conversationId }, data: { name: name.trim() } });
    }
    return this.getCommunityDetail(communityId, userId);
  }

  async deleteChannel(communityId: string, userId: string, channelId: string) {
    await this.requireRole(communityId, userId, 'MODERATOR');
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.communityId !== communityId) throw new NotFoundException('Salon introuvable');
    await this.prisma.channel.delete({ where: { id: channelId } });
    if (channel.conversationId) {
      await this.prisma.message.deleteMany({ where: { conversationId: channel.conversationId } });
      await this.prisma.conversation.delete({ where: { id: channel.conversationId } }).catch(() => {});
    }
    return this.getCommunityDetail(communityId, userId);
  }

  // ── Membres & rôles ──────────────────────────────────────────────────────

  async setMemberRole(communityId: string, userId: string, targetUserId: string, role: Role) {
    const me = await this.requireRole(communityId, userId, 'ADMIN');
    if (role === 'OWNER') throw new BadRequestException('Impossible d\'attribuer le rôle propriétaire');
    const target = await this.getMembership(communityId, targetUserId);
    if (target.role === 'OWNER') throw new ForbiddenException('Impossible de modifier le propriétaire');
    if (RANK[target.role as Role] >= RANK[me.role as Role]) throw new ForbiddenException('Vous ne pouvez pas modifier un membre de rang égal ou supérieur');
    await this.prisma.communityMember.update({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      data: { role },
    });
    return this.getCommunityDetail(communityId, userId);
  }

  async kickMember(communityId: string, userId: string, targetUserId: string) {
    const me = await this.requireRole(communityId, userId, 'MODERATOR');
    const target = await this.getMembership(communityId, targetUserId);
    if (target.role === 'OWNER') throw new ForbiddenException('Impossible d\'exclure le propriétaire');
    if (RANK[target.role as Role] >= RANK[me.role as Role]) throw new ForbiddenException('Permissions insuffisantes');
    await this.prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId: targetUserId } } });
    return { ok: true };
  }

  async leaveCommunity(communityId: string, userId: string) {
    const m = await this.getMembership(communityId, userId);
    if (m.role === 'OWNER') throw new BadRequestException('Le propriétaire doit transférer ou supprimer la communauté');
    await this.prisma.communityMember.delete({ where: { communityId_userId: { communityId, userId } } });
    return { ok: true };
  }

  async addMemberDirectly(communityId: string, actorId: string, targetUserId: string) {
    await this.requireRole(communityId, actorId, 'ADMIN');
    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: targetUserId } },
    });
    if (existing) throw new BadRequestException('Cet utilisateur est déjà membre');
    await this.prisma.communityMember.create({ data: { communityId, userId: targetUserId, role: 'MEMBER' } });
    return this.getCommunityDetail(communityId, actorId);
  }

  // ── Invitations ──────────────────────────────────────────────────────────

  async sendCommunityInviteDm(communityId: string, actorId: string, targetUserId: string) {
    await this.requireRole(communityId, actorId, 'ADMIN');

    let community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true, image: true, inviteToken: true },
    });
    if (!community) throw new NotFoundException('Communauté introuvable');

    if (!community.inviteToken) {
      const updated = await this.prisma.community.update({
        where: { id: communityId },
        data: { inviteToken: randomBytes(8).toString('hex') },
        select: { name: true, image: true, inviteToken: true },
      });
      community = updated;
    }

    const dm = await this.conversationsService.getOrCreateDmConversation(actorId, targetUserId);
    const msg = await this.messagesService.createCommunityInviteMessage(actorId, dm.id, {
      communityId,
      communityName: community.name,
      communityImage: community.image,
      token: community.inviteToken,
    });

    this.chatGateway.server.to(dm.id).emit('new_message', msg);
    return { ok: true };
  }

  async getInvite(communityId: string, userId: string) {
    await this.getMembership(communityId, userId);
    let community = await this.prisma.community.findUnique({ where: { id: communityId } });
    if (!community) throw new NotFoundException();
    if (!community.inviteToken) {
      community = await this.prisma.community.update({
        where: { id: communityId },
        data: { inviteToken: randomBytes(8).toString('hex') },
      });
    }
    return { token: community.inviteToken };
  }

  async joinByInvite(token: string, userId: string) {
    const community = await this.prisma.community.findUnique({ where: { inviteToken: token } });
    if (!community) throw new NotFoundException('Invitation invalide ou expirée');
    const existing = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: community.id, userId } },
    });
    if (!existing) {
      await this.prisma.communityMember.create({ data: { communityId: community.id, userId, role: 'MEMBER' } });
    }
    return { id: community.id, name: community.name };
  }
}
