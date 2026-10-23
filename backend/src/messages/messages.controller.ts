import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { MessagesService } from './messages.service';
import { getSessionUser } from '../auth/get-session-user';
import type { Request } from 'express';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.getMessagesForConversation(
      conversationId,
      user.id,
      cursor,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('search')
  async searchMessages(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Query('q') q: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.searchMessages(
      conversationId,
      user.id,
      q || '',
    );
  }

  @Get('pinned')
  async getPinned(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.getPinnedMessages(conversationId, user.id);
  }

  @Post('read')
  async markRead(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.markAsRead(conversationId, user.id);
  }

  @Post(':messageId/pin')
  async pin(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.pinMessage(conversationId, messageId, user.id);
  }

  @Delete(':messageId/pin')
  async unpin(
    @Req() req: Request,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.unpinMessage(
      conversationId,
      messageId,
      user.id,
    );
  }

  // L'envoi et l'édition passent par le socket (send_message / edit_message) :
  // des routes REST équivalentes créaient des messages jamais diffusés en temps réel.
}
