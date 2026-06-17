import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { getSessionUser } from '../auth/get-session-user';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(@Req() req: any, @Param('conversationId') conversationId: string) {
    const user = await getSessionUser(req);
    return this.messagesService.getMessagesForConversation(conversationId, user.id);
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
}
