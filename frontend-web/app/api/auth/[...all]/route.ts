import { toNextJsHandler } from "better-auth/next-js";
import { auth, ensureAuthMigrations } from "@/lib/auth";

const handler = toNextJsHandler(auth);

export async function GET(request: Request) {
  await ensureAuthMigrations();
  return handler.GET(request);
}

export async function POST(request: Request) {
  await ensureAuthMigrations();
  return handler.POST(request);
}
