import 'dotenv/config'; // doit être en premier — charge backend/.env avant tout
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/better-auth.instance';

async function bootstrap() {
  const expressApp = express();

  // ── CORS en tout premier — avant better-auth et body parser ───────────────
  // NestJS app.enableCors() vient trop tard (après better-auth dans la stack)
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost'];

  expressApp.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin as string | undefined;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Cookie,Set-Cookie');
    // Chrome Private Network Access — requis quand localhost:3000 appelle localhost:3001
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ── Better-auth avant NestJS et avant body parser ─────────────────────────
  //    /auth     → via Nginx (strip /api/ → /auth/...)
  //    /api/auth → accès direct local (npm run dev)
  const authHandler = toNodeHandler(auth);
  expressApp.use('/auth', authHandler);
  expressApp.use('/api/auth', authHandler);

  // ── Body parser pour les routes NestJS ────────────────────────────────────
  expressApp.use(express.json({ limit: '6mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '6mb' }));

  // ── NestJS sur l'Express app existante ────────────────────────────────────
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bodyParser: false,
  });

  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
      // Les fichiers uploadés (:3001/uploads) sont affichés par le front (:3000) :
      // le "same-origin" par défaut bloque l'embarquement <img>/<audio> cross-port.
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // CORS NestJS en redondance pour les routes NestJS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
