import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AiController } from './ai.controller';

@Module({
  providers: [MessagesService],
  controllers: [MessagesController, AiController],
  exports: [MessagesService],
})
export class MessagesModule {}
