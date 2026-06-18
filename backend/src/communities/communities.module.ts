import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChatModule } from '../chat/chat.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [ConversationsModule, ChatModule, MessagesModule],
  providers: [CommunitiesService],
  controllers: [CommunitiesController],
  exports: [CommunitiesService],
})
export class CommunitiesModule {}
