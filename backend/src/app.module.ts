import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { extname, join } from 'path';
import { isInlineMedia } from './upload/file-types';
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
        // Un fichier uploadé ne doit jamais s'exécuter dans l'origine de l'app :
        // CSP « sandbox » neutralise tout HTML/SVG, même déposé avant ce correctif,
        // et ce qui n'est pas un média est forcé en téléchargement.
        setHeaders: (
          res: { setHeader(name: string, value: string): void },
          filePath: string,
        ) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; media-src 'self'; img-src 'self'; sandbox",
          );
          if (!isInlineMedia(extname(filePath))) {
            res.setHeader('Content-Disposition', 'attachment');
          }
        },
      },
    }),
    // Rate limiting global : 200 req/min par IP (défaut)
    ThrottlerModule.forRoot([{ name: 'global', ttl: 60_000, limit: 200 }]),
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
