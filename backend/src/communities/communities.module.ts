import { Module } from '@nestjs/common';
import { CommunitiesService } from './communities.service';
import { CommunitiesController } from './communities.controller';
import { InvitationsService } from './invitations.service';
import { CommunityAdminController, InvitationsController } from './invitations.controller';
import { ConversationsModule } from '../conversations/conversations.module';
import { ChatModule } from '../chat/chat.module';
import { MessagesModule } from '../messages/messages.module';

@Module({
  imports: [ConversationsModule, ChatModule, MessagesModule],
  providers: [CommunitiesService, InvitationsService],
  // InvitationsController avant CommunitiesController : ses routes fixes
  // (community-invitations/…) ne doivent pas être absorbées par /communities/:id
  controllers: [InvitationsController, CommunityAdminController, CommunitiesController],
  exports: [CommunitiesService, InvitationsService],
})
export class CommunitiesModule {}
