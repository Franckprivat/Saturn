import { Platform } from 'react-native';
import { API_URL } from './config';
import { sessionCookie } from './auth-client';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Envoi multipart (upload de fichier) */
  form?: FormData;
};

let onUnauthorized: (() => void) | null = null;

/** Appelé quand le backend répond 401 (session expirée) : l'app renvoie au login. */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/** Message lisible depuis une réponse d'erreur NestJS ({ message: string | string[] }). */
function errorMessage(data: unknown, status: number): string {
  const msg = (data as { message?: unknown } | null)?.message;
  if (Array.isArray(msg)) return msg.join('\n');
  if (typeof msg === 'string' && msg) return msg;
  if (status === 0) return 'Serveur injoignable';
  return `Erreur ${status}`;
}

/**
 * Appel REST vers le backend NestJS, authentifié par le cookie better-auth
 * conservé dans SecureStore.
 */
export async function api<T = unknown>(path: string, options: Options = {}): Promise<T> {
  const cookie = await sessionCookie();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (cookie) headers.Cookie = cookie;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
      headers,
      body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
      // Sur téléphone le cookie est géré à la main (SecureStore) ; en version
      // web (expo start --web, pratique en développement) c'est le navigateur.
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
    });
  } catch {
    throw new ApiError('Serveur injoignable. Vérifie ta connexion.', 0);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    throw new ApiError(errorMessage(data, res.status), res.status);
  }
  return data as T;
}

export interface UploadResult {
  url: string;
  name: string;
  type: string;
  size: number;
}

/** Envoie un fichier local (URI renvoyée par l'image picker) sur POST /upload. */
export function uploadFile(file: { uri: string; name: string; type: string }) {
  const form = new FormData();
  // React Native accepte { uri, name, type } comme fichier multipart
  form.append('file', file as unknown as Blob);
  return api<UploadResult>('/upload', { method: 'POST', form });
}
