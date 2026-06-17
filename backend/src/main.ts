import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Augmenter la limite pour les uploads d'images en base64 (max ~5 Mo)
  app.use(require('express').json({ limit: '6mb' }));
  app.use(require('express').urlencoded({ extended: true, limit: '6mb' }));
  
  // Activer la validation globale pour les DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
    }),
  );

  // Activer CORS pour permettre les requêtes depuis le frontend
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
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
