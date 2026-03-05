import { Module } from '@nestjs/common';
import { FriendsService } from './friends.service';
import { FriendsController } from './friends.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [FriendsService, PrismaService],
  controllers: [FriendsController],
})
export class FriendsModule {}

