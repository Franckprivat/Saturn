import { Body, Controller, Delete, Get, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { getSessionUser } from '../auth/get-session-user';
import { PushService } from './push.service';
import { PushSubscribeDto, PushUnsubscribeDto } from './dto/push.dto';

@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  /** Clé publique VAPID (null : notifications push non configurées). */
  @Get('public-key')
  publicKey() {
    return { publicKey: this.push.publicKey };
  }

  @Post('subscribe')
  async subscribe(@Req() req: Request, @Body() body: PushSubscribeDto) {
    const user = await getSessionUser(req);
    return this.push.subscribe(user.id, body);
  }

  @Delete('subscribe')
  async unsubscribe(@Req() req: Request, @Body() body: PushUnsubscribeDto) {
    const user = await getSessionUser(req);
    return this.push.unsubscribe(user.id, body.endpoint);
  }
}
