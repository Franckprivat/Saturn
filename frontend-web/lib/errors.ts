import axios from 'axios';

/** Message d'erreur renvoyé par l'API (NestJS), ou `fallback` à défaut. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string | string[] }>(err)) {
    const message = err.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ') || fallback;
    if (message) return message;
  }
  return fallback;
}
