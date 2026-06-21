import { Module } from '@nestjs/common';

// Les routes /api/auth/* sont gérées dans main.ts via toNodeHandler(auth)
// avant le body parser NestJS — aucun controller NestJS nécessaire ici.
@Module({})
export class AuthModule {}
