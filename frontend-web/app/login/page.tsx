'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  minLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        minLength={minLength}
        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all duration-200 text-sm"
      />
      {hint && <p className="text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await authClient.signIn.email({
      email,
      password,
    });

    if (authError) {
      setError(authError.message || 'Erreur lors de la connexion');
      setLoading(false);
      return;
    }

    router.push(searchParams.get('redirect') || '/');
  };

  return (
    <div
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(900px circle at 15% 0%, rgba(37,99,235,0.12), transparent 45%), radial-gradient(800px circle at 90% 100%, rgba(96,165,250,0.15), transparent 45%), #F8FAFC' }}
    >
      {/* Glow de fond fixe */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] bg-[#2563EB]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-[#60A5FA]/15 rounded-full blur-[100px]" />
      </div>

      {/* Glow souris */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(350px at ${mouse.x}px ${mouse.y}px, rgba(37,99,235,0.1), transparent 70%)`,
        }}
      />

      {/* Grille décorative */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(#1E293B 1px, transparent 1px), linear-gradient(90deg, #1E293B 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center shadow-2xl shadow-[#2563EB]/40 mb-4">
            <img src="/logo.png" alt="Saturn" className="w-9 h-9 object-contain" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; (e.currentTarget.parentElement as HTMLElement).textContent = 'S'; }} />
          </div>
          <h1 className="text-3xl font-black text-[#1E293B] tracking-tight">Bon retour !</h1>
          <p className="text-sm text-[#64748B] mt-1">Connecte-toi pour reprendre la discussion</p>
        </div>

        {/* Carte */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="jean@exemple.com"
            />
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">
                  Mot de passe
                </label>
                <a href="/forgot-password" className="text-xs text-[#2563EB] hover:text-[#60A5FA] transition">
                  Mot de passe oublié ?
                </a>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
                className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-[#1E293B] text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
              />
            </div>

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-[#EF4444] px-4 py-3 rounded-xl text-sm">
                <span className="mt-0.5">⚠</span>
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#2563EB] to-[#60A5FA] hover:from-[#3B82F6] hover:to-[#93C5FD] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all duration-300 shadow-lg shadow-[#2563EB]/30 hover:shadow-[#2563EB]/50 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Connexion...
                </span>
              ) : (
                'Se connecter'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Pas encore de compte ?{' '}
          <a href="/signup" className="text-[#60A5FA] hover:text-[#2563EB] font-semibold transition-colors">
            S'inscrire
          </a>
        </p>
      </div>
    </div>
  );
}
