'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import { Spinner } from '@/components/Spinner';

export default function JoinCommunityPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;
  const [state, setState] = useState<'loading' | 'ready' | 'joining' | 'error' | 'success'>('loading');
  const [error, setError] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!token) return;
    authClient.getSession().then(({ data }) => {
      if (!data?.user) { router.push(`/login?redirect=/communities/join/${token}`); return; }
      setState('ready');
    });
  }, [token, router]);

  const handleJoin = async () => {
    setState('joining');
    try {
      const res = await api.post(`/communities/join/${token}`);
      setName(res.data?.name || 'la communauté');
      setState('success');
      setTimeout(() => router.push(`/communities/${res.data?.id}`), 1400);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Lien invalide ou expiré.');
      setState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sat-void)' }}>
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', boxShadow: '0 8px 32px rgba(37,99,235,0.08)' }}>
          <div className="w-20 h-20 rounded-3xl mx-auto mb-5 flex items-center justify-center text-4xl" style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>🌍</div>
          {state === 'loading' && <><h1 className="text-xl font-bold mb-2" style={{ color: 'var(--sat-text)' }}>Vérification...</h1><div className="flex justify-center mt-4"><Spinner size={24} /></div></>}
          {state === 'ready' && (
            <>
              <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--sat-text)' }}>Rejoindre la communauté</h1>
              <p className="text-sm mb-6" style={{ color: 'var(--sat-muted)' }}>Tu as été invité à rejoindre une communauté Saturn.</p>
              <button onClick={handleJoin} className="w-full py-3 rounded-xl font-bold text-white transition hover:opacity-90" style={{ background: 'linear-gradient(135deg,#2563EB,#60A5FA)' }}>
                Rejoindre
              </button>
            </>
          )}
          {state === 'joining' && <><h1 className="text-xl font-bold mb-2" style={{ color: 'var(--sat-text)' }}>Connexion...</h1><div className="flex justify-center mt-4"><Spinner size={24} /></div></>}
          {state === 'success' && (
            <><div className="text-5xl mb-3">🎉</div><h1 className="text-xl font-bold mb-2" style={{ color: 'var(--sat-text)' }}>Bienvenue !</h1><p className="text-sm" style={{ color: 'var(--sat-muted)' }}>Tu as rejoint <strong>{name}</strong>. Redirection...</p></>
          )}
          {state === 'error' && (
            <><div className="text-5xl mb-3">⚠️</div><h1 className="text-xl font-bold mb-2" style={{ color: '#EF4444' }}>Invitation invalide</h1><p className="text-sm mb-5" style={{ color: 'var(--sat-muted)' }}>{error}</p>
              <button onClick={() => router.push('/communities')} className="text-sm font-bold" style={{ color: 'var(--sat-accent)' }}>Voir mes communautés →</button></>
          )}
        </div>
      </div>
    </div>
  );
}
