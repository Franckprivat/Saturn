import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { FriendsModule } from '../friends/friends.module';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [FriendsModule, ChatModule],
  providers: [ConversationsService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
