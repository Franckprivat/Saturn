import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CallsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCallLog(userId: string) {
    return this.prisma.callLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async saveCall(userId: string, data: {
    type: string;
    direction: string;
    status: string;
    duration?: number;
    withName: string;
    withImage?: string;
    withNickname?: string;
    conversationId?: string;
  }) {
    return this.prisma.callLog.create({ data: { userId, ...data } });
  }

  async deleteCall(userId: string, callId: string) {
    const call = await this.prisma.callLog.findUnique({ where: { id: callId } });
    if (!call || call.userId !== userId) throw new ForbiddenException();
    return this.prisma.callLog.delete({ where: { id: callId } });
  }

  async clearCallLog(userId: string) {
    return this.prisma.callLog.deleteMany({ where: { userId } });
  }
}
