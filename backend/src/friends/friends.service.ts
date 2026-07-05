import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(query: string, currentUserId: string) {
    if (!query.trim()) {
      return [];
    }

    // Les utilisateurs bloqués (dans un sens ou l'autre) n'apparaissent pas
    const blocked = await this.prisma.friendship.findMany({
      where: {
        status: 'BLOCKED',
        OR: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
      },
      select: { requesterId: true, addresseeId: true },
    });
    const blockedIds = blocked.map((f) =>
      f.requesterId === currentUserId ? f.addresseeId : f.requesterId,
    );

    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          { id: { notIn: blockedIds } },
          {
            OR: [
              { nickname: { contains: query, mode: 'insensitive' } },
              { email: { equals: query.trim(), mode: 'insensitive' } },
            ],
          },
        ],
      },
      select: {
        id: true,
        nickname: true,
        image: true,
        avatarColor: true,
        bio: true,
      },
      take: 20,
    });
  }

  async sendFriendRequest(requesterId: string, addresseeId: string) {
    if (requesterId === addresseeId) {
      throw new ForbiddenException('You cannot add yourself');
    }

    await this.prisma.user.findUniqueOrThrow({ where: { id: addresseeId } });

    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId },
          { requesterId: addresseeId, addresseeId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'BLOCKED') {
        throw new ForbiddenException('Impossible d\'envoyer une demande à cet utilisateur');
      }
      // Demande croisée : l'autre m'avait déjà demandé → on devient amis directement
      if (existing.status === 'PENDING' && existing.requesterId === addresseeId) {
        return this.prisma.friendship.update({
          where: { id: existing.id },
          data: { status: 'ACCEPTED' },
        });
      }
      return existing;
    }

    return this.prisma.friendship.create({
      data: {
        requesterId,
        addresseeId,
      },
    });
  }

  async getFriendRequests(userId: string) {
    return this.prisma.friendship.findMany({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
      },
      include: {
        requester: {
          select: { id: true, nickname: true, image: true, avatarColor: true },
        },
        addressee: {
          select: { id: true, nickname: true, image: true, avatarColor: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getFriends(userId: string) {
    const friendships = await this.prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId },
          { addresseeId: userId },
        ],
      },
      include: {
        requester: {
          select: { id: true, nickname: true, image: true, avatarColor: true },
        },
        addressee: {
          select: { id: true, nickname: true, image: true, avatarColor: true },
        },
      },
    });

    return friendships.map((f) =>
      f.requesterId === userId ? f.addressee : f.requester,
    );
  }

  async respondToRequest(
    currentUserId: string,
    friendshipId: string,
    accept: boolean,
  ) {
    const friendship = await this.prisma.friendship.findUnique({
      where: { id: friendshipId },
    });

    if (!friendship) {
      throw new NotFoundException('Friend request not found');
    }

    if (friendship.addresseeId !== currentUserId) {
      throw new ForbiddenException('You cannot respond to this request');
    }

    // Seule une demande en attente peut être acceptée/refusée — empêche
    // notamment un utilisateur bloqué de « s'auto-débloquer » en acceptant
    if (friendship.status !== 'PENDING') {
      throw new ForbiddenException('This request has already been handled');
    }

    if (!accept) {
      await this.prisma.friendship.delete({ where: { id: friendshipId } });
      return { status: 'DECLINED' };
    }

    const updated = await this.prisma.friendship.update({
      where: { id: friendshipId },
      data: { status: 'ACCEPTED' },
    });

    return updated;
  }

  async removeFriend(userId: string, friendId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
    if (!friendship) throw new NotFoundException('Vous n\'êtes pas amis avec cet utilisateur');
    await this.prisma.friendship.delete({ where: { id: friendship.id } });
    return { ok: true };
  }

  async blockUser(requesterId: string, targetId: string) {
    const existing = await this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: requesterId },
        ],
      },
    });
    if (existing) {
      return this.prisma.friendship.update({
        where: { id: existing.id },
        data: { status: 'BLOCKED', requesterId, addresseeId: targetId },
      });
    }
    return this.prisma.friendship.create({
      data: { requesterId, addresseeId: targetId, status: 'BLOCKED' },
    });
  }

  async unblockUser(requesterId: string, targetId: string) {
    await this.prisma.friendship.deleteMany({
      where: {
        status: 'BLOCKED',
        OR: [
          { requesterId, addresseeId: targetId },
          { requesterId: targetId, addresseeId: requesterId },
        ],
      },
    });
  }

  /** Mini-profil pour les notifications temps réel. */
  getUserBrief(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { id: true, nickname: true, email: true, image: true },
    });
  }

  /** True si l'un des deux utilisateurs a bloqué l'autre. */
  async isBlockedBetween(userId: string, otherUserId: string): Promise<boolean> {
    const blocked = await this.prisma.friendship.count({
      where: {
        status: 'BLOCKED',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });
    return blocked > 0;
  }

  async ensureAreFriends(userId: string, otherUserId: string) {
    const friendship = await this.prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { requesterId: userId, addresseeId: otherUserId },
          { requesterId: otherUserId, addresseeId: userId },
        ],
      },
    });

    if (!friendship) {
      throw new ForbiddenException('You must be friends to start a DM');
    }
  }
}

