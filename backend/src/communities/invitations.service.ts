import {
  BadRequestException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { ChatGateway } from '../chat/chat.gateway';

type Role = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
const RANK: Record<Role, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

/** Actions soumises à permission, avec leur rôle minimal par défaut. */
export type PermissionAction =
  | 'invite' | 'createLink' | 'manageLinks' | 'approveRequests'
  | 'kick' | 'ban' | 'promote';

export const DEFAULT_PERMISSIONS: Record<PermissionAction, Role> = {
  invite: 'MEMBER',
  createLink: 'MODERATOR',
  manageLinks: 'ADMIN',
  approveRequests: 'MODERATOR',
  kick: 'MODERATOR',
  ban: 'ADMIN',
  promote: 'ADMIN',
};

/** Durée de vie d'une invitation directe. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const USER_BRIEF = { id: true, nickname: true, email: true, image: true, avatarColor: true } as const;

function displayName(u: { nickname?: string | null; email?: string | null } | null | undefined) {
  return u?.nickname?.trim() || u?.email?.split('@')[0] || 'Quelqu\'un';
}

@Injectable()
export class InvitationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatGateway: ChatGateway,
  ) {}

  // ── Permissions ────────────────────────────────────────────────────────────

  private async getMembership(communityId: string, userId: string) {
    const m = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId } },
    });
    if (!m) throw new ForbiddenException('Vous ne faites pas partie de cette communauté');
    return m;
  }

  /** Vérifie qu'un membre a le rôle minimal configuré pour une action. */
  async requirePermission(communityId: string, userId: string, action: PermissionAction) {
    const m = await this.getMembership(communityId, userId);
    if (m.role === 'OWNER') return m;
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { permissions: true },
    });
    const overrides = (community?.permissions ?? {}) as Partial<Record<PermissionAction, Role>>;
    const minRole = overrides[action] ?? DEFAULT_PERMISSIONS[action];
    if (RANK[m.role as Role] < RANK[minRole]) {
      throw new ForbiddenException('Permissions insuffisantes pour cette action');
    }
    return m;
  }

  async updateSettings(
    communityId: string,
    userId: string,
    data: { permissions?: Partial<Record<PermissionAction, Role>>; joinPolicy?: 'OPEN' | 'APPROVAL' },
  ) {
    const m = await this.getMembership(communityId, userId);
    if (RANK[m.role as Role] < RANK.ADMIN) throw new ForbiddenException('Réservé aux administrateurs');

    let permissions: Record<string, Role> | undefined;
    if (data.permissions) {
      permissions = {};
      for (const [action, role] of Object.entries(data.permissions)) {
        if (!(action in DEFAULT_PERMISSIONS)) throw new BadRequestException(`Action inconnue : ${action}`);
        if (!role || !(role in RANK) || role === 'OWNER') throw new BadRequestException(`Rôle invalide : ${role}`);
        permissions[action] = role as Role;
      }
    }

    await this.prisma.community.update({
      where: { id: communityId },
      data: {
        ...(permissions ? { permissions } : {}),
        ...(data.joinPolicy ? { joinPolicy: data.joinPolicy } : {}),
      },
    });
    await this.audit(communityId, userId, 'settings_updated', { metadata: data as any });
    return this.getSettings(communityId, userId);
  }

  async getSettings(communityId: string, userId: string) {
    await this.getMembership(communityId, userId);
    const c = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { joinPolicy: true, permissions: true },
    });
    return {
      joinPolicy: c?.joinPolicy ?? 'OPEN',
      permissions: { ...DEFAULT_PERMISSIONS, ...((c?.permissions as any) ?? {}) },
      defaults: DEFAULT_PERMISSIONS,
    };
  }

  // ── Audit ──────────────────────────────────────────────────────────────────

  private audit(
    communityId: string,
    actorId: string,
    action: string,
    extra: { targetUserId?: string; linkId?: string; metadata?: any } = {},
  ) {
    return this.prisma.communityAuditLog.create({
      data: { communityId, actorId, action, ...extra },
    });
  }

  async getAuditLog(communityId: string, userId: string, limit = 100) {
    await this.requirePermission(communityId, userId, 'manageLinks');
    const entries = await this.prisma.communityAuditLog.findMany({
      where: { communityId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    // Résolution des identités en une requête
    const ids = new Set<string>();
    for (const e of entries) { ids.add(e.actorId); if (e.targetUserId) ids.add(e.targetUserId); }
    const users = await this.prisma.user.findMany({
      where: { id: { in: Array.from(ids) } },
      select: USER_BRIEF,
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return entries.map((e) => ({
      ...e,
      actor: byId.get(e.actorId) ?? null,
      target: e.targetUserId ? byId.get(e.targetUserId) ?? null : null,
    }));
  }

  // ── Bans ───────────────────────────────────────────────────────────────────

  private async isBanned(communityId: string, userId: string) {
    const ban = await this.prisma.communityBan.count({ where: { communityId, userId } });
    return ban > 0;
  }

  async banMember(communityId: string, actorId: string, targetUserId: string, reason?: string) {
    const me = await this.requirePermission(communityId, actorId, 'ban');
    const target = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId, userId: targetUserId } },
    });
    if (target) {
      if (target.role === 'OWNER') throw new ForbiddenException('Impossible de bannir le propriétaire');
      if (RANK[target.role as Role] >= RANK[me.role as Role]) {
        throw new ForbiddenException('Impossible de bannir un membre de rang égal ou supérieur');
      }
      await this.prisma.communityMember.delete({
        where: { communityId_userId: { communityId, userId: targetUserId } },
      });
    }
    await this.prisma.communityBan.upsert({
      where: { communityId_userId: { communityId, userId: targetUserId } },
      create: { communityId, userId: targetUserId, bannedById: actorId, reason: reason?.slice(0, 300) },
      update: { bannedById: actorId, reason: reason?.slice(0, 300) },
    });
    // Un banni ne doit plus avoir d'invitation ou de demande active
    await this.prisma.communityInvite.updateMany({
      where: { communityId, inviteeId: targetUserId, status: 'PENDING' },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
    await this.prisma.communityJoinRequest.updateMany({
      where: { communityId, userId: targetUserId, status: 'PENDING' },
      data: { status: 'REJECTED', respondedAt: new Date(), respondedById: actorId },
    });
    await this.audit(communityId, actorId, 'member_banned', { targetUserId, metadata: { reason } });
    return { ok: true };
  }

  async unbanMember(communityId: string, actorId: string, targetUserId: string) {
    await this.requirePermission(communityId, actorId, 'ban');
    await this.prisma.communityBan.deleteMany({ where: { communityId, userId: targetUserId } });
    await this.audit(communityId, actorId, 'member_unbanned', { targetUserId });
    return { ok: true };
  }

  async listBans(communityId: string, userId: string) {
    await this.requirePermission(communityId, userId, 'ban');
    return this.prisma.communityBan.findMany({
      where: { communityId },
      include: { user: { select: USER_BRIEF } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Invitations directes ───────────────────────────────────────────────────

  /** Invite plusieurs amis d'un coup. Dédupe : déjà membre / déjà invité / banni. */
  async inviteMembers(communityId: string, actorId: string, userIds: string[], message?: string) {
    await this.requirePermission(communityId, actorId, 'invite');
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { name: true, image: true },
    });
    if (!community) throw new NotFoundException('Communauté introuvable');

    const unique = Array.from(new Set(userIds)).filter((id) => id && id !== actorId).slice(0, 50);
    if (!unique.length) throw new BadRequestException('Aucun destinataire');

    const [members, pending, bans] = await Promise.all([
      this.prisma.communityMember.findMany({ where: { communityId, userId: { in: unique } }, select: { userId: true } }),
      this.prisma.communityInvite.findMany({
        where: { communityId, inviteeId: { in: unique }, status: 'PENDING', expiresAt: { gt: new Date() } },
        select: { inviteeId: true },
      }),
      this.prisma.communityBan.findMany({ where: { communityId, userId: { in: unique } }, select: { userId: true } }),
    ]);
    const skip = new Set([
      ...members.map((m) => m.userId),
      ...pending.map((i) => i.inviteeId),
      ...bans.map((b) => b.userId),
    ]);
    const toInvite = unique.filter((id) => !skip.has(id));

    const inviter = await this.prisma.user.findUnique({ where: { id: actorId }, select: USER_BRIEF });
    const trimmedMessage = message?.trim().slice(0, 300) || null;
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    for (const inviteeId of toInvite) {
      const invite = await this.prisma.communityInvite.create({
        data: { communityId, inviterId: actorId, inviteeId, message: trimmedMessage, expiresAt },
      });
      await this.audit(communityId, actorId, 'invite_sent', { targetUserId: inviteeId });
      // Notification temps réel avec actions Accepter / Refuser
      this.chatGateway.server.to(`user:${inviteeId}`).emit('notification', {
        type: 'community_invite',
        title: `Invitation — ${community.name}`,
        body: `${displayName(inviter)} t'invite à rejoindre ${community.name}${trimmedMessage ? ` : « ${trimmedMessage} »` : ''}`,
        href: '/communities',
        image: community.image,
        inviteId: invite.id,
        timestamp: new Date().toISOString(),
      });
    }

    return { invited: toInvite.length, skipped: unique.length - toInvite.length };
  }

  /** Invitations reçues par l'utilisateur (en attente, non expirées). */
  async myInvites(userId: string) {
    return this.prisma.communityInvite.findMany({
      where: { inviteeId: userId, status: 'PENDING', expiresAt: { gt: new Date() } },
      include: {
        inviter: { select: USER_BRIEF },
        community: { select: { id: true, name: true, image: true, description: true, _count: { select: { members: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** L'invité répond : accepter (→ devient membre) ou refuser. */
  async respondToInvite(inviteId: string, userId: string, accept: boolean) {
    const invite = await this.prisma.communityInvite.findUnique({
      where: { id: inviteId },
      include: { community: { select: { id: true, name: true, image: true } } },
    });
    if (!invite || invite.inviteeId !== userId) throw new NotFoundException('Invitation introuvable');
    if (invite.status !== 'PENDING') throw new BadRequestException('Invitation déjà traitée');
    if (invite.expiresAt < new Date()) throw new GoneException('Invitation expirée');

    if (accept && (await this.isBanned(invite.communityId, userId))) {
      throw new ForbiddenException('Vous avez été banni de cette communauté');
    }

    await this.prisma.communityInvite.update({
      where: { id: inviteId },
      data: { status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: new Date() },
    });

    const invitee = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_BRIEF });

    if (accept) {
      await this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: invite.communityId, userId } },
        create: { communityId: invite.communityId, userId, role: 'MEMBER' },
        update: {},
      });
      await this.prisma.communityJoinLog.create({
        data: { communityId: invite.communityId, userId, viaInviterId: invite.inviterId },
      });
      await this.audit(invite.communityId, userId, 'invite_accepted', { targetUserId: invite.inviterId });
      this.notifyMemberJoined(invite.communityId, invite.community.name, invitee);
    } else {
      await this.audit(invite.communityId, userId, 'invite_declined', { targetUserId: invite.inviterId });
    }

    // Prévenir l'inviteur du résultat
    this.chatGateway.server.to(`user:${invite.inviterId}`).emit('notification', {
      type: accept ? 'invite_accepted' : 'invite_declined',
      title: invite.community.name,
      body: `${displayName(invitee)} a ${accept ? 'accepté' : 'refusé'} ton invitation`,
      href: accept ? `/communities/${invite.communityId}` : '/communities',
      image: invite.community.image,
      timestamp: new Date().toISOString(),
    });

    return { ok: true, communityId: accept ? invite.communityId : null };
  }

  /** Annulation par un admin/inviteur tant que l'invitation est en attente. */
  async cancelInvite(communityId: string, actorId: string, inviteId: string) {
    const invite = await this.prisma.communityInvite.findUnique({ where: { id: inviteId } });
    if (!invite || invite.communityId !== communityId) throw new NotFoundException('Invitation introuvable');
    if (invite.inviterId !== actorId) {
      await this.requirePermission(communityId, actorId, 'manageLinks');
    } else {
      await this.getMembership(communityId, actorId);
    }
    if (invite.status !== 'PENDING') throw new BadRequestException('Invitation déjà traitée');
    await this.prisma.communityInvite.update({
      where: { id: inviteId },
      data: { status: 'CANCELLED', respondedAt: new Date() },
    });
    await this.audit(communityId, actorId, 'invite_cancelled', { targetUserId: invite.inviteeId });
    return { ok: true };
  }

  /** Tableau de bord : toutes les invitations (statut EXPIRED calculé à la volée). */
  async listInvites(communityId: string, userId: string) {
    await this.requirePermission(communityId, userId, 'invite');
    const invites = await this.prisma.communityInvite.findMany({
      where: { communityId },
      include: { inviter: { select: USER_BRIEF }, invitee: { select: USER_BRIEF } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    const now = new Date();
    return invites.map((i) => ({
      ...i,
      status: i.status === 'PENDING' && i.expiresAt < now ? 'EXPIRED' : i.status,
    }));
  }

  // ── Liens d'invitation ─────────────────────────────────────────────────────

  async createInviteLink(
    communityId: string,
    actorId: string,
    options: { label?: string; expiresInHours?: number | null; maxUses?: number | null } = {},
  ) {
    await this.requirePermission(communityId, actorId, 'createLink');
    const count = await this.prisma.communityInviteLink.count({ where: { communityId, disabledAt: null } });
    if (count >= 25) throw new BadRequestException('Limite de 25 liens actifs atteinte');

    const expiresAt = options.expiresInHours
      ? new Date(Date.now() + options.expiresInHours * 3600_000)
      : null;
    const maxUses = options.maxUses && options.maxUses > 0 ? Math.min(options.maxUses, 10_000) : null;

    const link = await this.prisma.communityInviteLink.create({
      data: {
        communityId,
        creatorId: actorId,
        token: randomBytes(10).toString('hex'),
        label: options.label?.trim().slice(0, 60) || null,
        expiresAt,
        maxUses,
      },
      include: { creator: { select: USER_BRIEF } },
    });
    await this.audit(communityId, actorId, 'link_created', {
      linkId: link.id,
      metadata: { label: link.label, expiresAt, maxUses },
    });
    return link;
  }

  private linkState(link: { disabledAt: Date | null; expiresAt: Date | null; maxUses: number | null; uses: number }) {
    if (link.disabledAt) return 'disabled';
    if (link.expiresAt && link.expiresAt < new Date()) return 'expired';
    if (link.maxUses !== null && link.uses >= link.maxUses) return 'exhausted';
    return 'active';
  }

  async listInviteLinks(communityId: string, userId: string) {
    await this.requirePermission(communityId, userId, 'createLink');
    const links = await this.prisma.communityInviteLink.findMany({
      where: { communityId },
      include: {
        creator: { select: USER_BRIEF },
        joins: { include: { user: { select: USER_BRIEF } }, orderBy: { joinedAt: 'desc' }, take: 25 },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return links.map((l) => ({ ...l, state: this.linkState(l) }));
  }

  async updateInviteLink(
    communityId: string,
    actorId: string,
    linkId: string,
    action: 'disable' | 'enable' | 'regenerate',
  ) {
    await this.requirePermission(communityId, actorId, 'manageLinks');
    const link = await this.prisma.communityInviteLink.findUnique({ where: { id: linkId } });
    if (!link || link.communityId !== communityId) throw new NotFoundException('Lien introuvable');

    const data =
      action === 'disable' ? { disabledAt: new Date() }
      : action === 'enable' ? { disabledAt: null }
      : { token: randomBytes(10).toString('hex'), disabledAt: null };

    const updated = await this.prisma.communityInviteLink.update({
      where: { id: linkId },
      data,
      include: { creator: { select: USER_BRIEF } },
    });
    await this.audit(communityId, actorId, `link_${action}d`, { linkId });
    return { ...updated, state: this.linkState(updated) };
  }

  async deleteInviteLink(communityId: string, actorId: string, linkId: string) {
    await this.requirePermission(communityId, actorId, 'manageLinks');
    const link = await this.prisma.communityInviteLink.findUnique({ where: { id: linkId } });
    if (!link || link.communityId !== communityId) throw new NotFoundException('Lien introuvable');
    await this.prisma.communityInviteLink.delete({ where: { id: linkId } });
    await this.audit(communityId, actorId, 'link_deleted', { linkId, metadata: { label: link.label } });
    return { ok: true };
  }

  // ── Jonction via lien / token ──────────────────────────────────────────────

  /** Aperçu public (authentifié) d'un lien : la page de jonction s'en sert. */
  async getLinkPreview(token: string, userId: string) {
    const link = await this.prisma.communityInviteLink.findUnique({
      where: { token },
      include: { community: { select: { id: true, name: true, image: true, description: true, joinPolicy: true, _count: { select: { members: true } } } } },
    });
    // Compat : ancien token « legacy » stocké sur la communauté
    const community = link?.community
      ?? (await this.prisma.community.findUnique({
        where: { inviteToken: token },
        select: { id: true, name: true, image: true, description: true, joinPolicy: true, _count: { select: { members: true } } },
      }));
    if (!community) return { state: 'not_found' as const };

    const [member, banned, pendingRequest] = await Promise.all([
      this.prisma.communityMember.count({ where: { communityId: community.id, userId } }),
      this.isBanned(community.id, userId),
      this.prisma.communityJoinRequest.count({ where: { communityId: community.id, userId, status: 'PENDING' } }),
    ]);

    return {
      state: link ? this.linkState(link) : 'active',
      community: {
        id: community.id,
        name: community.name,
        image: community.image,
        description: community.description,
        memberCount: community._count.members,
      },
      joinPolicy: community.joinPolicy,
      alreadyMember: member > 0,
      banned,
      requestPending: pendingRequest > 0,
    };
  }

  /** Rejoindre via un lien/token — ou déposer une demande si la communauté l'exige. */
  async joinViaToken(token: string, userId: string, message?: string) {
    const link = await this.prisma.communityInviteLink.findUnique({
      where: { token },
      include: { community: { select: { id: true, name: true, image: true, joinPolicy: true } } },
    });
    let community = link?.community ?? null;
    if (!community) {
      community = await this.prisma.community.findUnique({
        where: { inviteToken: token },
        select: { id: true, name: true, image: true, joinPolicy: true },
      });
    }
    if (!community) throw new NotFoundException('Invitation invalide ou expirée');

    if (link) {
      const state = this.linkState(link);
      if (state === 'disabled') throw new GoneException('Ce lien a été désactivé');
      if (state === 'expired') throw new GoneException('Ce lien a expiré');
      if (state === 'exhausted') throw new GoneException('Ce lien a atteint son nombre maximal d\'utilisations');
    }
    if (await this.isBanned(community.id, userId)) {
      throw new ForbiddenException('Vous avez été banni de cette communauté');
    }

    const already = await this.prisma.communityMember.count({
      where: { communityId: community.id, userId },
    });
    if (already) return { id: community.id, name: community.name, joined: true };

    // Communauté sur approbation → demande d'adhésion au lieu d'une entrée directe
    if (community.joinPolicy === 'APPROVAL') {
      const existing = await this.prisma.communityJoinRequest.findFirst({
        where: { communityId: community.id, userId, status: 'PENDING' },
      });
      if (!existing) {
        await this.prisma.communityJoinRequest.create({
          data: { communityId: community.id, userId, message: message?.trim().slice(0, 300) || null },
        });
        await this.audit(community.id, userId, 'join_requested', { linkId: link?.id });
        await this.notifyApprovers(community.id, community.name, userId);
      }
      return { id: community.id, name: community.name, requested: true };
    }

    // Entrée directe + parrainage + compteur d'utilisation
    await this.prisma.communityMember.create({
      data: { communityId: community.id, userId, role: 'MEMBER' },
    });
    if (link) {
      await this.prisma.communityInviteLink.update({
        where: { id: link.id },
        data: { uses: { increment: 1 } },
      });
    }
    await this.prisma.communityJoinLog.create({
      data: { communityId: community.id, userId, viaLinkId: link?.id ?? null },
    });
    await this.audit(community.id, userId, 'joined_via_link', { linkId: link?.id });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: USER_BRIEF });
    this.notifyMemberJoined(community.id, community.name, user);
    return { id: community.id, name: community.name, joined: true };
  }

  // ── Demandes d'adhésion ────────────────────────────────────────────────────

  async listJoinRequests(communityId: string, userId: string) {
    await this.requirePermission(communityId, userId, 'approveRequests');
    const requests = await this.prisma.communityJoinRequest.findMany({
      where: { communityId, status: 'PENDING' },
      include: { user: { select: { ...USER_BRIEF, bio: true, createdAt: true } } },
      orderBy: { createdAt: 'asc' },
    });

    // Amis en commun : amis du demandeur ∩ membres de la communauté
    const memberIds = new Set(
      (await this.prisma.communityMember.findMany({ where: { communityId }, select: { userId: true } }))
        .map((m) => m.userId),
    );
    const enriched = await Promise.all(requests.map(async (r) => {
      const friendships = await this.prisma.friendship.findMany({
        where: { status: 'ACCEPTED', OR: [{ requesterId: r.userId }, { addresseeId: r.userId }] },
        select: { requesterId: true, addresseeId: true },
      });
      const friendIds = friendships.map((f) => (f.requesterId === r.userId ? f.addresseeId : f.requesterId));
      const mutual = friendIds.filter((id) => memberIds.has(id));
      const mutualUsers = mutual.length
        ? await this.prisma.user.findMany({ where: { id: { in: mutual.slice(0, 3) } }, select: USER_BRIEF })
        : [];
      return { ...r, mutualFriendsCount: mutual.length, mutualFriends: mutualUsers };
    }));
    return enriched;
  }

  async respondToJoinRequest(communityId: string, actorId: string, requestId: string, approve: boolean) {
    await this.requirePermission(communityId, actorId, 'approveRequests');
    const request = await this.prisma.communityJoinRequest.findUnique({
      where: { id: requestId },
      include: { community: { select: { name: true, image: true } } },
    });
    if (!request || request.communityId !== communityId) throw new NotFoundException('Demande introuvable');
    if (request.status !== 'PENDING') throw new BadRequestException('Demande déjà traitée');

    await this.prisma.communityJoinRequest.update({
      where: { id: requestId },
      data: { status: approve ? 'APPROVED' : 'REJECTED', respondedAt: new Date(), respondedById: actorId },
    });

    if (approve) {
      await this.prisma.communityMember.upsert({
        where: { communityId_userId: { communityId, userId: request.userId } },
        create: { communityId, userId: request.userId, role: 'MEMBER' },
        update: {},
      });
      await this.prisma.communityJoinLog.create({
        data: { communityId, userId: request.userId },
      });
      const user = await this.prisma.user.findUnique({ where: { id: request.userId }, select: USER_BRIEF });
      this.notifyMemberJoined(communityId, request.community.name, user);
    }
    await this.audit(communityId, actorId, approve ? 'request_approved' : 'request_rejected', {
      targetUserId: request.userId,
    });

    // Prévenir le demandeur
    this.chatGateway.server.to(`user:${request.userId}`).emit('notification', {
      type: approve ? 'request_approved' : 'request_rejected',
      title: request.community.name,
      body: approve
        ? `Ta demande a été acceptée — bienvenue dans ${request.community.name} !`
        : `Ta demande pour rejoindre ${request.community.name} a été refusée`,
      href: approve ? `/communities/${communityId}` : '/communities',
      image: request.community.image,
      timestamp: new Date().toISOString(),
    });

    return { ok: true };
  }

  // ── Notifications internes ─────────────────────────────────────────────────

  /** Nouveau membre : événement live pour la page + cloche pour les modérateurs. */
  private notifyMemberJoined(
    communityId: string,
    communityName: string,
    user: { id: string; nickname: string | null; email: string | null; image: string | null } | null,
  ) {
    this.chatGateway.server.to(`community:${communityId}`).emit('community_member_joined', {
      communityId,
      user,
      timestamp: new Date().toISOString(),
    });
  }

  /** Demande d'adhésion : notifie les membres habilités à approuver. */
  private async notifyApprovers(communityId: string, communityName: string, requesterId: string) {
    const settings = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { permissions: true, image: true },
    });
    const overrides = (settings?.permissions ?? {}) as Partial<Record<PermissionAction, Role>>;
    const minRole = overrides.approveRequests ?? DEFAULT_PERMISSIONS.approveRequests;
    const approvers = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true, role: true },
    });
    const requester = await this.prisma.user.findUnique({ where: { id: requesterId }, select: USER_BRIEF });
    for (const m of approvers) {
      if (RANK[m.role as Role] < RANK[minRole]) continue;
      this.chatGateway.server.to(`user:${m.userId}`).emit('notification', {
        type: 'join_request',
        title: `Demande d'adhésion — ${communityName}`,
        body: `${displayName(requester)} souhaite rejoindre la communauté`,
        href: `/communities/${communityId}`,
        image: settings?.image,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
