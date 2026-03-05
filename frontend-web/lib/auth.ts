import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { Pool } from "pg";
import { getMigrations } from "better-auth/db";

declare global {
  // eslint-disable-next-line no-var
  var __betterAuthPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __betterAuthMigrate: Promise<void> | undefined;
}

function getPool() {
  if (!globalThis.__betterAuthPool) {
    const connectionString = process.env.BETTER_AUTH_DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "Missing BETTER_AUTH_DATABASE_URL. Set it in your environment.",
      );
    }
    globalThis.__betterAuthPool = new Pool({ connectionString });
  }
  return globalThis.__betterAuthPool;
}

export const auth = betterAuth({
  database: getPool(),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [nextCookies()],
});

export function ensureAuthMigrations() {
  if (!globalThis.__betterAuthMigrate) {
    globalThis.__betterAuthMigrate = (async () => {
      const { runMigrations } = await getMigrations(auth.options);
      await runMigrations();
    })();
  }
  return globalThis.__betterAuthMigrate;
}

