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

    authClient.getSession().then(({ data }) => {
      if (!data?.session || !mounted) return;

      if (!socketSingleton) {
        socketSingleton = io('http://localhost:3001', { withCredentials: true });

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
        });
      }

      consumerCount++;
      setSocket(socketSingleton);
    });

    return () => {
      mounted = false;
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
