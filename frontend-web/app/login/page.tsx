'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({ email, password });
    if (authError) {
      setError(authError.message || 'Email ou mot de passe incorrect');
      setLoading(false);
      return;
    }
    router.push(searchParams.get('redirect') || '/');
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>

      {/* ── Panneau gauche (branding) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[520px] flex-shrink-0 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 60%, #0f172a 100%)' }}>
        {/* Glow déco */}
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: 'rgba(37,99,235,0.25)' }} />
        <div className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full blur-[80px]" style={{ background: 'rgba(96,165,250,0.15)' }} />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #60a5fa)', boxShadow: '0 4px 20px rgba(37,99,235,0.4)' }}>
            S
          </div>
          <span className="text-xl font-black text-white">Saturn</span>
        </div>

        {/* Message principal */}
        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4">
              Discute sans<br />limites.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Messages privés, groupes, communautés et appels — tout en un.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-3.5">
            {[
              { icon: '💬', text: 'Messagerie instantanée & groupes' },
              { icon: '🏛️', text: 'Communautés style Discord' },
              { icon: '📞', text: 'Appels audio & vidéo WebRTC' },
              { icon: '🎨', text: 'Avatar personnalisé DiceBear' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <span className="text-slate-300 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-slate-600 text-xs">© 2026 Saturn · Messagerie moderne</p>
      </div>

      {/* ── Panneau droit (formulaire) ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-8">

          {/* Header mobile */}
          <div className="lg:hidden flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #60a5fa)' }}>S</div>
            <span className="text-xl font-black text-white">Saturn</span>
          </div>

          <div>
            <h1 className="text-3xl font-black text-white mb-2">Bon retour !</h1>
            <p className="text-slate-400">Connecte-toi pour reprendre la discussion</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="jean@exemple.com"
                className="w-full px-4 py-3.5 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', }} />
            </div>

            {/* Mot de passe */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Mot de passe</label>
                <Link href="/forgot-password" className="text-xs font-medium transition" style={{ color: '#60a5fa' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#93c5fd')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#60a5fa')}>
                  Oublié ?
                </Link>
              </div>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 pr-12 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none transition"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)' }} />
                <button type="button" onClick={() => setShowPwd((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    {showPwd
                      ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                      : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                  </svg>
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}>
              {loading ? (
                <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Connexion...</>
              ) : 'Se connecter'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500">
            Pas encore de compte ?{' '}
            <Link href="/signup" className="font-bold transition" style={{ color: '#60a5fa' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#93c5fd')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#60a5fa')}>
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
