'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const res = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: email.trim(),
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      });
      if (!res.ok) throw new Error();
      setSent(true);
    } catch {
      setError("Une erreur est survenue. Vérifie l'adresse email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[30%] w-[700px] h-[700px] bg-[#2563EB]/10 rounded-full blur-[160px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[500px] h-[500px] bg-[#60A5FA]/10 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-[#2563EB]/25">
            S
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#1E293B]">Mot de passe oublié</h1>
          <p className="text-sm text-[#64748B] text-center">
            Entre ton adresse email, on t'envoie un lien pour réinitialiser ton mot de passe.
          </p>
        </div>

        {sent ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
            <svg className="mx-auto" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
            <p className="text-[#10B981] font-semibold text-sm">Email envoyé !</p>
            <p className="text-[#64748B] text-xs">
              Vérifie ta boîte mail (et tes spams). Le lien expire dans 1 heure.
            </p>
            <Link href="/login" className="block text-xs text-[#2563EB] hover:text-[#60A5FA] mt-2">
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-xl shadow-slate-200/60">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">
                Adresse email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ton@email.com"
                required
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm text-[#1E293B] focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition placeholder:text-slate-400"
              />
            </div>

            {error && (
              <p className="text-xs text-[#EF4444] text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#60A5FA] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-bold text-white transition shadow-lg shadow-[#2563EB]/20"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Envoi...
                </span>
              ) : (
                'Envoyer le lien de réinitialisation'
              )}
            </button>

            <p className="text-center text-xs text-[#64748B]">
              <Link href="/login" className="hover:text-[#2563EB] transition">
                ← Retour à la connexion
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
