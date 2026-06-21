import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  // NEXT_PUBLIC_AUTH_URL = origine du serveur (sans /api)
  // better-auth append automatiquement /api/auth → /api/auth/sign-in/email etc.
  baseURL: process.env.NEXT_PUBLIC_AUTH_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
});
