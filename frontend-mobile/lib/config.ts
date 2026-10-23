import Constants from 'expo-constants';

/**
 * Adresses du backend.
 *
 * - EXPO_PUBLIC_SERVER_URL : origine du serveur (auth better-auth sous /api/auth,
 *   Socket.IO, fichiers /uploads). Ex. https://saturn.example.com
 * - EXPO_PUBLIC_API_URL : base des routes NestJS. Derrière Nginx c'est
 *   `<origine>/api` ; en local (npm run start:dev) c'est l'origine elle-même.
 *
 * Sans configuration, en développement, on vise le port 3001 de la machine qui
 * sert le bundle Expo : le téléphone (Expo Go) atteint ainsi le backend local.
 */
function devServerOrigin(): string {
  const hostUri = Constants.expoConfig?.hostUri; // ex. 192.168.1.20:8081
  const host = hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:3001`;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const SERVER_URL = trimSlash(process.env.EXPO_PUBLIC_SERVER_URL || devServerOrigin());

export const API_URL = trimSlash(process.env.EXPO_PUBLIC_API_URL || SERVER_URL);

/** Schéma de l'app (app.json → expo.scheme), déclaré comme origine de confiance côté backend. */
export const APP_SCHEME = 'saturn';
