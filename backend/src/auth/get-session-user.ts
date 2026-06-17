import { UnauthorizedException } from '@nestjs/common';
import { auth } from './better-auth.instance';

export async function getSessionUser(req: any) {
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: req.headers.cookie || '' }),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  return session.user;
}
