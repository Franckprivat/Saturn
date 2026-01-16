'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <>{children}</>;
}
