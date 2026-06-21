import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as express from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './auth/better-auth.instance';

async function bootstrap() {
  // 1. On crée l'Express app manuellement
  const expressApp = express();

  // 2. Better-auth en PREMIER — avant tout body parser, avant NestJS
  //    /auth      → via Nginx (Nginx rewrite strip /api/ → /auth/...)
  //    /api/auth  → accès direct local (npm run dev, sans Nginx)
  const authHandler = toNodeHandler(auth);
  expressApp.use('/auth', authHandler);
  expressApp.use('/api/auth', authHandler);

  // 3. Body parser pour tous les autres endpoints NestJS
  expressApp.use(express.json({ limit: '6mb' }));
  expressApp.use(express.urlencoded({ extended: true, limit: '6mb' }));

  // 4. NestJS s'installe SUR cette Express app — ses routes viennent après better-auth
  const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp), {
    bodyParser: false, // on gère le body parser nous-mêmes ci-dessus
  });

  // ── Helmet ────────────────────────────────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: false,
    }),
  );

  // ── Validation globale des DTOs ───────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // ── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000', 'http://localhost'];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
