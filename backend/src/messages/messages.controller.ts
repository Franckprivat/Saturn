import { Controller, Get, Param } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('conversations/:conversationId/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  async getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: any,
  ) {
    return this.messagesService.getMessagesForConversation(conversationId, user.id);
  }
}
