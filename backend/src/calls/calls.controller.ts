import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Req } from '@nestjs/common';
import { CallsService } from './calls.service';
import { getSessionUser } from '../auth/get-session-user';

const CALL_TYPES = ['audio', 'video'] as const;
const CALL_DIRECTIONS = ['incoming', 'outgoing'] as const;
const CALL_STATUSES = ['answered', 'missed'] as const;

@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Get()
  async getCallLog(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.callsService.getCallLog(user.id);
  }

  @Post()
  async saveCall(@Req() req: any, @Body() body: any) {
    const user = await getSessionUser(req);
    if (!CALL_TYPES.includes(body.type)) throw new BadRequestException('type invalide');
    if (!CALL_DIRECTIONS.includes(body.direction)) throw new BadRequestException('direction invalide');
    if (!CALL_STATUSES.includes(body.status)) throw new BadRequestException('status invalide');
    const duration = Number.isFinite(body.duration)
      ? Math.max(0, Math.floor(body.duration))
      : undefined;
    return this.callsService.saveCall(user.id, {
      type: body.type,
      direction: body.direction,
      status: body.status,
      duration,
      withName: String(body.withName ?? 'Inconnu').slice(0, 100),
      withImage: typeof body.withImage === 'string' ? body.withImage.slice(0, 2048) : undefined,
      withNickname: typeof body.withNickname === 'string' ? body.withNickname.slice(0, 100) : undefined,
      conversationId: typeof body.conversationId === 'string' ? body.conversationId.slice(0, 64) : undefined,
    });
  }

  @Delete()
  async clearCallLog(@Req() req: any) {
    const user = await getSessionUser(req);
    return this.callsService.clearCallLog(user.id);
  }

  @Delete(':id')
  async deleteCall(@Req() req: any, @Param('id') id: string) {
    const user = await getSessionUser(req);
    return this.callsService.deleteCall(user.id, id);
  }
}
