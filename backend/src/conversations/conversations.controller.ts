import { Body, Controller, Get, Post } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  async getMyConversations(@CurrentUser() user: any) {
    return this.conversationsService.getUserConversations(user.id);
  }

  @Post()
  async createConversation(
    @CurrentUser() user: any,
    @Body('participantIds') participantIds: string[],
  ) {
    return this.conversationsService.createConversation(user.id, participantIds ?? []);
  }

  @Post('dm')
  async createOrGetDm(
    @CurrentUser() user: any,
    @Body('userId') userId: string,
  ) {
    return this.conversationsService.getOrCreateDmConversation(user.id, userId);
  }
}
