'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { AuthLayout, AuthInput, AuthButton, AuthError } from '@/components/AuthLayout';
import { DemoLoginButton } from '@/components/DemoLoginButton';

// N'accepte que les chemins internes (« //site.com » mènerait hors de l'app)
function safeRedirect(target: string | null) {
  return target && target.startsWith('/') && !target.startsWith('//') ? target : '/chat';
}

export default function LoginPage() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await authClient.signIn.email({ email, password });
    if (authError) {
      setError(authError.message || 'Erreur lors de la connexion');
      setLoading(false);
      return;
    }
    // Navigation complète : le cache du routeur peut encore contenir la
    // redirection vers /login obtenue avant la connexion.
    window.location.assign(safeRedirect(searchParams.get('redirect')));
  };

  return (
    <AuthLayout tagline={['Tes conversations,', 'en un seul endroit.']}>
      <div className="mb-7">
        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#2B2A27] mb-1">Bon retour !</h1>
        <p className="text-sm text-[#6B655C]">Connecte-toi pour reprendre la discussion</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <AuthInput
          label="Email" type="email" value={email} onChange={setEmail}
          placeholder="jean@exemple.com" autoComplete="email"
        />
        <AuthInput
          label="Mot de passe" type="password" value={password} onChange={setPassword}
          placeholder="••••••••" minLength={6} autoComplete="current-password"
          action={<a href="/forgot-password" className="text-xs font-medium text-[#C96442] hover:text-[#DA8A6A] transition-colors">Oublié ?</a>}
        />

        <AuthError message={error} />
        <AuthButton loading={loading}>Se connecter</AuthButton>
      </form>

      <DemoLoginButton className="mt-4" />

      <p className="text-center text-sm mt-7 text-[#6B655C]">
        Pas encore de compte ?{' '}
        <a href="/signup" className="font-semibold text-[#C96442] hover:text-[#DA8A6A] transition-colors">Créer un compte</a>
      </p>
    </AuthLayout>
  );
}
