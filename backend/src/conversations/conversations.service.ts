import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';

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
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    nickname: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                sender: {
                  select: {
                    id: true,
                    email: true,
                    nickname: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        conversation: {
          createdAt: 'desc',
        },
      },
    });

    return participants.map((p) => p.conversation);
  }

  async createConversation(creatorId: string, participantIds: string[]) {
    const uniqueUserIds = Array.from(new Set([creatorId, ...participantIds]));

    const conversation = await this.prisma.conversation.create({
      data: {
        participants: {
          create: uniqueUserIds.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }

  async isUserInConversation(userId: string, conversationId: string): Promise<boolean> {
    const count = await this.prisma.conversationParticipant.count({
      where: {
        userId,
        conversationId,
      },
    });
    return count > 0;
  }

  async getOrCreateDmConversation(currentUserId: string, otherUserId: string) {
    await this.friendsService.ensureAreFriends(currentUserId, otherUserId);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        type: 'DM',
        participants: {
          some: {
            userId: currentUserId,
          },
        },
        AND: {
          participants: {
            some: {
              userId: otherUserId,
            },
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const conversation = await this.prisma.conversation.create({
      data: {
        type: 'DM',
        participants: {
          create: [
            { userId: currentUserId },
            { userId: otherUserId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                nickname: true,
              },
            },
          },
        },
      },
    });

    return conversation;
  }
}
