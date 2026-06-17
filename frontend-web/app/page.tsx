'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/Spinner';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/chat');
  }, []);

  return <PageLoader label="Bienvenue sur Saturn..." />;
}
