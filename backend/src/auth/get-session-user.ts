import { UnauthorizedException } from '@nestjs/common';
import { auth } from './better-auth.instance';

export async function getSessionUser(req: { headers: { cookie?: string } }) {
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: req.headers.cookie || '' }),
  });

  if (!session?.user) {
    throw new UnauthorizedException();
  }

  return session.user;
}
