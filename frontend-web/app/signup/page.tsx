'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { useAuthStore } from '@/store/authStore';

// Composant Input réutilisable
function Input({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  hint,
  required = true,
  minLength,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  minLength?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-[#B6B6B6]">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/10 text-white placeholder-[#B6B6B6]/50 focus:outline-none focus:ring-2 focus:ring-[#A016D9] transition"
      />
      {hint && (
        <p className="text-xs text-[#B6B6B6]/70">{hint}</p>
      )}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authApi.signup({ email, nickname, password });
      setAuth(response.access_token, response.user);
      router.push('/');
    } catch (err: any) {
      console.error('Erreur signup:', err);
      setError(
        err.response?.data?.message ||
        err.response?.data?.error ||
        err.message ||
        'Erreur lors de l\'inscription'
      );
      
      // Afficher plus de détails en développement
      if (process.env.NODE_ENV === 'development') {
        console.error('Détails de l\'erreur:', {
          status: err.response?.status,
          data: err.response?.data,
          config: err.config,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onMouseMove={(e) =>
        setMouse({ x: e.clientX, y: e.clientY })
      }
      className="relative min-h-screen overflow-hidden bg-[#0F0F14] flex items-center justify-center px-4"
    >
      {/* Glow souris */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(
            400px at ${mouse.x}px ${mouse.y}px,
            rgba(160,22,217,0.3),
            transparent 70%
          )`,
        }}
      />

      {/* Carte */}
      <div className="relative z-10 w-full max-w-md bg-[#0F0F14]/80 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">
            Inscription
          </h1>
          <p className="text-[#B6B6B6]">
            Créez votre compte et rejoins-nous !
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="votre.adresse@email.com"
          />

          <Input
            label="Nom d'utilisateur"
            value={nickname}
            onChange={setNickname}
            placeholder="Votre pseudonyme"
            minLength={3}
          />

          <Input
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            minLength={6}
          />

          {error && (
            <div className="bg-[#CF11BC]/10 border border-[#CF11BC]/40 text-[#CF11BC] px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#A016D9] hover:bg-[#CF11BC] disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg shadow-[#A016D9]/30"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin mr-3 h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Création...
              </span>
            ) : (
              'Créer mon compte'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-[#B6B6B6]">
          Déjà un compte ?{' '}
          <a
            href="/login"
            className="text-[#CF11BC] hover:underline font-semibold transition-colors"
          >
            Se connecter
          </a>
        </p>
      </div>
    </div>
  );
}
