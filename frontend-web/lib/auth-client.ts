import { createAuthClient } from "better-auth/react";

// Important: Better Auth exige une baseURL ABSOLUE.
// On crée le client à la demande (évite les erreurs SSR).
let _client: ReturnType<typeof createAuthClient> | null = null;

export function getAuthClient() {
  if (_client) return _client;

  const base =
    process.env.NEXT_PUBLIC_AUTH_BASE_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  if (!base) {
    // En pratique, cette erreur ne doit pas arriver car getAuthClient()
    // est appelée depuis un event handler côté client.
    throw new Error(
      "Missing NEXT_PUBLIC_AUTH_BASE_URL (or window.location.origin).",
    );
  }

  _client = createAuthClient({
    baseURL: new URL("/api/auth", base).toString(),
  });

  return _client;
}

