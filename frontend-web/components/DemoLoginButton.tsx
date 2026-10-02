'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';

type DemoInfo = { enabled: boolean; email?: string; password?: string };

/**
 * Connexion en un clic au compte démo partagé (recruteurs, visiteurs).
 * Ne s'affiche que si le backend a activé la démo (DEMO_ACCOUNT_ENABLED=true).
 */
export function DemoLoginButton({ className = '' }: { className?: string }) {
  const [demo, setDemo] = useState<DemoInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<DemoInfo>('/demo').then((res) => setDemo(res.data)).catch(() => {});
  }, []);

  if (!demo?.enabled || !demo.email || !demo.password) return null;

  const handleClick = async () => {
    setError('');
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({
      email: demo.email!,
      password: demo.password!,
    });
    if (authError) {
      setError(authError.message || 'Connexion au compte démo impossible');
      setLoading(false);
      return;
    }
    // Navigation complète : le cache du routeur peut encore contenir la
    // redirection vers /login obtenue avant la connexion.
    window.location.assign('/chat');
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full py-3.5 rounded-xl font-bold text-[15px] text-[#C96442] bg-white border border-[#C96442]/30 transition-all hover:border-[#C96442] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
      >
        {loading ? 'Connexion…' : 'Essayer le compte démo'}
      </button>
      <p className="mt-2 text-xs text-center text-[#9C968B]">
        Sans inscription · {demo.email} / {demo.password}
      </p>
      {error && <p className="mt-2 text-sm text-center text-[#EF4444]">{error}</p>}
    </div>
  );
}
