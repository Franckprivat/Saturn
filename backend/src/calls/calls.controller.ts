import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { CallsService } from './calls.service';
import { getSessionUser } from '../auth/get-session-user';
import type { Request } from 'express';
import { SaveCallDto } from './dto/save-call.dto';
import { buildIceServers } from './ice-servers';

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  async getCallLog(@Req() req: Request) {
    const user = await getSessionUser(req);
    return this.callsService.getCallLog(user.id);
  }

  /** Configuration ICE (STUN + TURN éventuel) pour les appels et salons vocaux. */
  @Get('ice-servers')
  async iceServers(@Req() req: Request) {
    const user = await getSessionUser(req);
    return { iceServers: buildIceServers(user.id) };
  }

  @Post()
  async saveCall(@Req() req: Request, @Body() body: SaveCallDto) {
    const user = await getSessionUser(req);
    return this.callsService.saveCall(user.id, {
      type: body.type,
      direction: body.direction,
      status: body.status,
      duration: body.duration,
      withName: body.withName || 'Inconnu',
      withImage: body.withImage ?? undefined,
      withNickname: body.withNickname ?? undefined,
      conversationId: body.conversationId ?? undefined,
    });
  }

  @Delete()
  async clearCallLog(@Req() req: Request) {
    const user = await getSessionUser(req);
    return this.callsService.clearCallLog(user.id);
  }

  @Delete(':id')
  async deleteCall(@Req() req: Request, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.callsService.deleteCall(user.id, id);
  }
}
