'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : 3;
  const strengthLabel = ['', 'Trop court', 'Moyen', 'Solide'];
  const strengthColor = ['', 'bg-[#EF4444]', 'bg-yellow-500', 'bg-[#10B981]'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit faire au moins 8 caractères.'); return; }
    if (!token) { setError('Lien invalide ou expiré.'); return; }
    setLoading(true);
    setError('');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newPassword: password, token }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch {
      setError('Lien invalide ou expiré. Recommence depuis "Mot de passe oublié".');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
        <div className="text-4xl">⚠️</div>
        <p className="text-[#EF4444] font-semibold text-sm">Lien invalide</p>
        <p className="text-[#64748B] text-xs">Ce lien de réinitialisation est invalide ou a expiré.</p>
        <Link href="/forgot-password" className="block text-xs text-[#2563EB] hover:underline mt-2">
          Demander un nouveau lien
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
        <div className="text-4xl">✅</div>
        <p className="text-[#10B981] font-semibold text-sm">Mot de passe mis à jour !</p>
        <p className="text-[#64748B] text-xs">Redirection vers la connexion dans 3 secondes...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xl shadow-slate-200/60">
      {/* Nouveau mot de passe */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">
          Nouveau mot de passe
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 caractères"
            required
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm text-[#1E293B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#1E293B] transition text-xs"
          >
            {showPass ? '🙈' : '👁'}
          </button>
        </div>
        {/* Barre de force */}
        {password.length > 0 && (
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-all ${i <= strength ? strengthColor[strength] : 'bg-slate-200'}`}
                />
              ))}
            </div>
            <p className={`text-[10px] ${strength === 1 ? 'text-[#EF4444]' : strength === 2 ? 'text-yellow-500' : 'text-[#10B981]'}`}>
              {strengthLabel[strength]}
            </p>
          </div>
        )}
      </div>

      {/* Confirmer */}
      <div className="space-y-1.5">
        <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">
          Confirmer le mot de passe
        </label>
        <input
          type={showPass ? 'text' : 'password'}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Répète le mot de passe"
          required
          className={`w-full bg-white border rounded-xl px-4 py-3 text-sm text-[#1E293B] focus:outline-none transition placeholder:text-slate-400 ${
            confirm && confirm !== password ? 'border-[#EF4444]' : 'border-slate-200 focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20'
          }`}
        />
        {confirm && confirm !== password && (
          <p className="text-[10px] text-[#EF4444]">Les mots de passe ne correspondent pas</p>
        )}
      </div>

      {error && <p className="text-xs text-[#EF4444] text-center">{error}</p>}

      <button
        type="submit"
        disabled={loading || !password || !confirm || password !== confirm}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#60A5FA] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition shadow-lg shadow-[#2563EB]/20"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            Mise à jour...
          </span>
        ) : (
          'Mettre à jour le mot de passe'
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[30%] w-[700px] h-[700px] bg-[#2563EB]/6 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-[#2563EB]/25">
            S
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1E293B]">Nouveau mot de passe</h1>
          <p className="text-sm text-[#64748B] text-center">Choisis un nouveau mot de passe sécurisé.</p>
        </div>

        <Suspense fallback={<div className="text-center text-[#64748B] text-sm">Chargement...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
