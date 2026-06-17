import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  async searchUsers(query: string, currentUserId: string) {
    if (!query.trim()) {
      return [];
    }

    return this.prisma.user.findMany({
      where: {
        AND: [
          { id: { not: currentUserId } },
          {
            nickname: { contains: query, mode: 'insensitive' },
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

