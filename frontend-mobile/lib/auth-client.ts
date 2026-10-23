import { Platform } from 'react-native';
import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';
import { expoClient } from '@better-auth/expo/client';
import * as SecureStore from 'expo-secure-store';
import { APP_SCHEME, SERVER_URL } from './config';

/**
 * Client better-auth pour l'app mobile : le cookie de session est conservé dans
 * le stockage sécurisé du téléphone (SecureStore) et renvoyé à chaque requête.
 */
export const authClient = createAuthClient({
  baseURL: SERVER_URL,
  plugins: [
    // Version web (développement) : cookies gérés par le navigateur
    ...(Platform.OS === 'web'
      ? []
      : [expoClient({ scheme: APP_SCHEME, storagePrefix: 'saturn', storage: SecureStore })]),
    // Champs additionnels déclarés côté serveur (better-auth.instance.ts)
    inferAdditionalFields({
      user: {
        firstName: { type: 'string', required: false },
        lastName: { type: 'string', required: false },
        nickname: { type: 'string', required: false },
      },
    }),
  ],
});

/** En-tête Cookie à joindre aux appels REST et Socket.IO (vide si déconnecté). */
export async function sessionCookie(): Promise<string> {
  // Version web : pas de plugin Expo, le navigateur envoie le cookie lui-même
  if (Platform.OS === 'web') return '';
  return (await (authClient as unknown as { getCookie: () => Promise<string> }).getCookie()) || '';
}
