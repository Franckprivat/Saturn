import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from '../friends/friends.service';

@Module({
  providers: [ConversationsService, PrismaService, FriendsService],
  controllers: [ConversationsController],
})
export class ConversationsModule {}
