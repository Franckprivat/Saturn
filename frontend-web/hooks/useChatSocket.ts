'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { authClient } from '@/lib/auth-client';
import { usePresenceStore } from '@/store/presenceStore';
import { useNotificationStore } from '@/store/notificationStore';

let socketSingleton: Socket | null = null;
let consumerCount = 0;

export function useChatSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { setOnlineUsers, setOnline, setOffline } = usePresenceStore.getState();

  useEffect(() => {
    let mounted = true;
    let counted = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      // Si l'API est momentanément indisponible (redémarrage du backend),
      // on réessaie au lieu de rester définitivement sans temps réel.
      const { data } = await authClient.getSession().catch(() => ({ data: null as any }));
      if (!mounted) return;
      if (!data?.session) {
        retryTimer = setTimeout(connect, 4000);
        return;
      }

      if (!socketSingleton) {
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
        socketSingleton = io(socketUrl, { withCredentials: true });

        socketSingleton.on('online_users', ({ userIds }: { userIds: string[] }) => {
          setOnlineUsers(userIds);
        });

        socketSingleton.on('user_online', ({ userId }: { userId: string }) => {
          setOnline(userId);
        });

        socketSingleton.on('user_offline', ({ userId }: { userId: string }) => {
          setOffline(userId);
        });

        socketSingleton.on('notification', (data: any) => {
          useNotificationStore.getState().add(data);
          // Notification système quand l'onglet n'est pas visible (façon WhatsApp Web)
          if (
            typeof Notification !== 'undefined' &&
            Notification.permission === 'granted' &&
            document.hidden
          ) {
            try {
              const n = new Notification(data.title || 'Saturn', {
                body: data.body || '',
                icon: '/logo.png',
                tag: data.conversationId || data.type, // regroupe les notifs d'une même conversation
              });
              n.onclick = () => { window.focus(); if (data.href) window.location.href = data.href; n.close(); };
            } catch { /* API indisponible */ }
          }
        });
      }

      consumerCount++;
      counted = true;
      setSocket(socketSingleton);
    };

    connect();

    return () => {
      mounted = false;
      if (retryTimer) clearTimeout(retryTimer);
      if (!counted) return; // jamais connecté → rien à décompter
      consumerCount--;
      // Only disconnect when the last consumer unmounts (AppShell keeps count ≥ 1 throughout the session)
      if (consumerCount <= 0 && socketSingleton) {
        socketSingleton.disconnect();
        socketSingleton = null;
        consumerCount = 0;
      }
    };
  }, []);

  return socket;
}
