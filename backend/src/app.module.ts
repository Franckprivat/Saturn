import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { GatewayModule } from './gateway/gateway.module';
import { ChatGateway } from './chat/chat.gateway';
import { PrismaService } from './prisma/prisma.service';
import { JwtGuard } from './auth/jwt/jwt.guard';

@Module({
  imports: [AuthModule, UsersModule, ConversationsModule, MessagesModule, GatewayModule],
  controllers: [AppController],
  providers: [
    AppService,
    ChatGateway,
    PrismaService,
    {
      provide: APP_GUARD,
      useClass: JwtGuard,
    },
  ],
})
export class AppModule {}
