import { toNextJsHandler } from "better-auth/next-js";
import { auth, ensureAuthMigrations } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export async function GET(...args: any[]) {
  await ensureAuthMigrations();
  // @ts-expect-error - signature dépend de better-auth/next-js
  return handler.GET(...args);
}

export async function POST(...args: any[]) {
  await ensureAuthMigrations();
  // @ts-expect-error - signature dépend de better-auth/next-js
  return handler.POST(...args);
}

