import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [MessagesService, PrismaService],
  controllers: [MessagesController],
  exports: [MessagesService],
})
export class MessagesModule {}
