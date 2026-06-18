import { All, Controller, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './better-auth.instance';
import { Public } from './jwt/jwt.guard';

@Public()
@Controller('/api/auth')
// Auth : max 20 tentatives/min par IP (brute-force protection)
@Throttle({ global: { ttl: 60_000, limit: 20 } })
export class AuthController {
  @All('*')
  handler(@Req() req: any, @Res() res: any) {
    return toNodeHandler(auth)(req, res);
  }
}
