import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/public.decorator';
import {
  emailEnabled,
  requireEmailVerification,
} from './auth/better-auth.instance';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  /** Options visibles par le frontend (ex. prévenir que le reset par e-mail est désactivé). */
  @Get('public-config')
  publicConfig() {
    return { emailEnabled, requireEmailVerification };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
