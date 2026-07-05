import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConversationsModule } from './conversations/conversations.module';
import { MessagesModule } from './messages/messages.module';
import { FriendsModule } from './friends/friends.module';
import { ChatModule } from './chat/chat.module';
import { UploadModule } from './upload/upload.module';
import { CommunitiesModule } from './communities/communities.module';
import { CallsModule } from './calls/calls.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
      serveStaticOptions: {
        // Les noms de fichiers sont uniques (timestamp-random) → cache long sans risque
        immutable: true,
        maxAge: '30d',
        index: false,
      },
    }),
    // Rate limiting global : 200 req/min par IP (défaut)
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 200 },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    FriendsModule,
    ConversationsModule,
    MessagesModule,
    ChatModule,
    UploadModule,
    CommunitiesModule,
    CallsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Guard de rate limiting actif sur toutes les routes
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
