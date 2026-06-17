import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { getSessionUser } from '../auth/get-session-user';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Req() req: any,
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
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query('q') q: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.searchMessages(conversationId, user.id, q || '');
  }

  @Get('pinned')
  async getPinned(@Req() req: any, @Param('conversationId') conversationId: string) {
    const user = await getSessionUser(req);
    return this.messagesService.getPinnedMessages(conversationId, user.id);
  }

  @Post()
  async sendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body('content') content: string,
    @Body('fileUrl') fileUrl?: string,
    @Body('fileName') fileName?: string,
    @Body('fileType') fileType?: string,
  ) {
    const user = await getSessionUser(req);
    const file = fileUrl ? { fileUrl, fileName: fileName || 'fichier', fileType: fileType || 'application/octet-stream' } : undefined;
    return this.messagesService.createMessage(user.id, conversationId, content || '', file);
  }

  @Post('read')
  async markRead(@Req() req: any, @Param('conversationId') conversationId: string) {
    const user = await getSessionUser(req);
    return this.messagesService.markAsRead(conversationId, user.id);
  }

  @Post(':messageId/pin')
  async pin(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.pinMessage(conversationId, messageId, user.id);
  }

  @Delete(':messageId/pin')
  async unpin(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.unpinMessage(conversationId, messageId, user.id);
  }

  @Patch(':messageId')
  async editMessage(
    @Req() req: any,
    @Param('messageId') messageId: string,
    @Body('content') content: string,
  ) {
    const user = await getSessionUser(req);
    return this.messagesService.editMessage(messageId, user.id, content);
  }
}
