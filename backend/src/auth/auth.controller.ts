import { Controller } from '@nestjs/common';

// Routes /api/auth/* gérées dans main.ts via toNodeHandler(auth) — avant le body parser NestJS.
@Controller()
export class AuthController {}
