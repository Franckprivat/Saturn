import { Platform } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import { SERVER_URL } from './config';
import { sessionCookie } from './auth-client';

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;

/**
 * Connexion Socket.IO unique pour toute l'app. Le backend authentifie la
 * connexion avec le cookie better-auth reçu dans le handshake : sur mobile on
 * le passe explicitement en en-tête (transport WebSocket uniquement).
 */
export function connectSocket(): Promise<Socket | null> {
  if (socket) return Promise.resolve(socket);
  if (connecting) return connecting;
  connecting = (async () => {
    const web = Platform.OS === 'web';
    const cookie = await sessionCookie();
    if (!cookie && !web) return null;
    socket = io(SERVER_URL, {
      transports: ['websocket'],
      // Version web : cookie envoyé par le navigateur
      ...(web ? { withCredentials: true } : { extraHeaders: { Cookie: cookie } }),
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    return socket;
  })().finally(() => {
    connecting = null;
  });
  return connecting;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

/** Émet un évènement et attend la réponse du serveur (accusé Socket.IO). */
export function emitWithAck<T = unknown>(event: string, payload: unknown, timeoutMs = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!socket?.connected) {
      reject(new Error('Connexion temps réel indisponible'));
      return;
    }
    socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: T) => {
      if (err) reject(new Error("Le serveur n'a pas répondu"));
      else if (res && typeof res === 'object' && 'status' in res && (res as { status: string }).status === 'error') {
        reject(new Error((res as { message?: string }).message || 'Erreur'));
      } else resolve(res);
    });
  });
}
