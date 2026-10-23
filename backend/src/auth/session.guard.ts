import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from './public.decorator';
import { resolveSession, type SessionRequest } from './get-session-user';

/**
 * Guard global : toute route HTTP exige une session better-auth, sauf celles
 * marquées `@Public()`. Oublier un contrôle dans un handler n'ouvre donc plus
 * la route. L'utilisateur est mis en cache sur la requête (`req.user`).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<SessionRequest>();
    const user = await resolveSession(req);
    if (!user) throw new UnauthorizedException();
    return true;
  }
}
