import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { PushModule } from '../push/push.module';

@Module({
  imports: [MessagesModule, PushModule],
  providers: [ChatGateway],
  exports: [ChatGateway],
})
export class ChatModule {}
