import { All, Controller, Req, Res } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './better-auth.instance';
import { Public } from './jwt/jwt.guard';

@Public()
@Controller('/api/auth')
export class AuthController {
  @All('*')
  handler(@Req() req: any, @Res() res: any) {
    return toNodeHandler(auth)(req, res);
  }
}
