import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { FriendsModule } from './friends/friends.module';
import { ChatModule } from './chat/chat.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
