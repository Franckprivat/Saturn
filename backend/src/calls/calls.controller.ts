import {
  BadRequestException,
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

const CALL_TYPES = ['audio', 'video'] as const;
const CALL_DIRECTIONS = ['incoming', 'outgoing'] as const;
const CALL_STATUSES = ['answered', 'missed'] as const;

interface SaveCallBody {
  type?: unknown;
  direction?: unknown;
  status?: unknown;
  duration?: unknown;
  withName?: unknown;
  withImage?: unknown;
  withNickname?: unknown;
  conversationId?: unknown;
}

function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v);
}

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  async getCallLog(@Req() req: Request) {
    const user = await getSessionUser(req);
    return this.callsService.getCallLog(user.id);
  }

  @Post()
  async saveCall(@Req() req: Request, @Body() body: SaveCallBody) {
    const user = await getSessionUser(req);
    if (!isOneOf(CALL_TYPES, body.type))
      throw new BadRequestException('type invalide');
    if (!isOneOf(CALL_DIRECTIONS, body.direction))
      throw new BadRequestException('direction invalide');
    if (!isOneOf(CALL_STATUSES, body.status))
      throw new BadRequestException('status invalide');
    const duration =
      typeof body.duration === 'number' && Number.isFinite(body.duration)
        ? Math.max(0, Math.floor(body.duration))
        : undefined;
    return this.callsService.saveCall(user.id, {
      type: body.type,
      direction: body.direction,
      status: body.status,
      duration,
      withName:
        typeof body.withName === 'string'
          ? body.withName.slice(0, 100)
          : 'Inconnu',
      withImage:
        typeof body.withImage === 'string'
          ? body.withImage.slice(0, 2048)
          : undefined,
      withNickname:
        typeof body.withNickname === 'string'
          ? body.withNickname.slice(0, 100)
          : undefined,
      conversationId:
        typeof body.conversationId === 'string'
          ? body.conversationId.slice(0, 64)
          : undefined,
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
