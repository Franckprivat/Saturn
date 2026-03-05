import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureParticipant(userId: string, conversationId: string) {
    const count = await this.prisma.conversationParticipant.count({
      where: { userId, conversationId },
    });
    if (!count) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }
  }

  async getMessagesForConversation(conversationId: string, userId: string) {
    await this.ensureParticipant(userId, conversationId);

    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });
  }

  async createMessage(userId: string, conversationId: string, content: string) {
    await this.ensureParticipant(userId, conversationId);

    return this.prisma.message.create({
      data: {
        senderId: userId,
        conversationId,
        content,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            nickname: true,
          },
        },
      },
    });
  }
}
