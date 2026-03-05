'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/authStore';

let socketSingleton: Socket | null = null;

export function useChatSocket() {
  const token = useAuthStore((s) => s.token);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    if (!socketSingleton) {
      socketSingleton = io('http://localhost:3001', {
        auth: { token },
      });
    }

    setSocket(socketSingleton);
  }, [token]);

  return socket;
}

