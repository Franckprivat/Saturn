import { UnauthorizedException } from '@nestjs/common';
import { auth } from './better-auth.instance';

type SessionUser = NonNullable<
  Awaited<ReturnType<typeof auth.api.getSession>>
>['user'];

export type SessionRequest = {
  headers: { cookie?: string };
  user?: SessionUser;
};

/** Lit la session une seule fois par requête (le guard global l'a déjà fait). */
export async function resolveSession(
  req: SessionRequest,
): Promise<SessionUser | null> {
  if (req.user) return req.user;
  const session = await auth.api.getSession({
    headers: new Headers({ cookie: req.headers.cookie || '' }),
  });
  if (!session?.user) return null;
  req.user = session.user;
  return session.user;
}

export async function getSessionUser(req: SessionRequest) {
  const user = await resolveSession(req);
  if (!user) throw new UnauthorizedException();
  return user;
}
