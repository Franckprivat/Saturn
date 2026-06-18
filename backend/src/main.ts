import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ── Limite de taille des requêtes ─────────────────────────────────────────
  app.use(require('express').json({ limit: '6mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '6mb' }));

  // ── Helmet : headers de sécurité HTTP ────────────────────────────────────
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false, // nécessaire pour les uploads et socket.io
      contentSecurityPolicy: false,     // géré côté frontend (Next.js)
    }),
  );

  // ── Validation globale des DTOs ───────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,          // supprime les champs inconnus silencieusement
      forbidNonWhitelisted: false, // ne casse pas les controllers sans DTO
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
