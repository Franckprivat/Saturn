import {
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { getSessionUser } from '../auth/get-session-user';
import { createVoiceToken, getLiveKitConfig } from './livekit';

@Controller('voice')
export class VoiceController {
  constructor(private readonly prisma: PrismaService) {}

  /** Jeton pour rejoindre un salon vocal (membres de la communauté uniquement). */
  @Post(':channelId/token')
  async token(@Req() req: Request, @Param('channelId') channelId: string) {
    const config = getLiveKitConfig();
    if (!config)
      throw new ServiceUnavailableException(
        'Les salons vocaux ne sont pas configurés sur ce serveur',
      );
    const user = await getSessionUser(req);
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { communityId: true, type: true },
    });
    if (!channel || channel.type !== 'VOICE')
      throw new NotFoundException('Salon vocal introuvable');
    const member = await this.prisma.communityMember.count({
      where: { communityId: channel.communityId, userId: user.id },
    });
    if (!member) throw new ForbiddenException('Not a community member');
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { nickname: true, name: true },
    });
    const token = await createVoiceToken(config, channelId, {
      id: user.id,
      name: profile?.nickname || profile?.name || '',
    });
    return { url: config.publicUrl, token };
  }
}
