'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { AuthLayout, AuthInput, AuthButton, AuthError } from '@/components/AuthLayout';

// Format Tailwind attendu par <Avatar /> (bg-gradient-to-br ${color})
const AVATAR_COLORS = [
  'from-[#C96442] to-[#DA8A6A]',
  'from-[#0EA5E9] to-[#38BDF8]',
  'from-[#10B981] to-[#34D399]',
  'from-[#F59E0B] to-[#FBBF24]',
  'from-[#EF4444] to-[#F97316]',
  'from-[#EC4899] to-[#F43F5E]',
];

export default function SignupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [image, setImage] = useState<string | null>(null);
  const [color, setColor] = useState(AVATAR_COLORS[0]);
  const [showColors, setShowColors] = useState(false);

  const initial = (nickname || firstName || '?').charAt(0).toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Image trop lourde (max 3 Mo).'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setShowColors(false); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await authClient.signUp.email({
      email, password, name: nickname, firstName, lastName, nickname,
    } as any);
    if (authError) { setError(authError.message || "Erreur lors de l'inscription"); setLoading(false); return; }
    try {
      await api.patch('/users/me', { image: image || null, avatarColor: image ? null : color });
    } catch { /* non bloquant */ }
    router.push('/');
  };

  return (
    <AuthLayout tagline={['Rejoins la communauté,', "c'est gratuit."]}>
      <div className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-[#2B2A27] mb-1">Créer un compte</h1>
        <p className="text-sm text-[#6B655C]">Rejoins Saturn et commence à discuter</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        {/* Sélecteur d'avatar */}
        <div className="flex items-center gap-4 p-3 rounded-2xl bg-[#F5F4EE] border border-[rgba(60,52,40,0.10)]">
          <div className="relative flex-shrink-0">
            <button
              type="button" onClick={() => fileRef.current?.click()}
              className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center text-xl font-black text-white transition-transform hover:scale-105 ${image ? '' : `bg-gradient-to-br ${color}`}`}
            >
              {image ? <img src={image} alt="avatar" className="w-full h-full object-cover" /> : <span className="select-none">{initial}</span>}
            </button>
            <button
              type="button" onClick={() => fileRef.current?.click()}
              className="absolute -bottom-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-[#C96442] to-[#DA8A6A]"
              title="Ajouter une photo"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#6B655C] mb-1.5">Photo de profil</p>
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <button type="button" onClick={() => fileRef.current?.click()} className="font-semibold text-[#C96442] hover:text-[#DA8A6A] transition-colors">
                {image ? 'Changer' : 'Ajouter'}
              </button>
              {image ? (
                <><span className="text-[#CBD5E1]">·</span>
                <button type="button" onClick={() => setImage(null)} className="font-medium text-[#6B655C] hover:text-[#EF4444] transition-colors">Supprimer</button></>
              ) : (
                <><span className="text-[#CBD5E1]">·</span>
                <button type="button" onClick={() => setShowColors((v) => !v)} className="font-medium text-[#6B655C] hover:text-[#C96442] transition-colors">Couleur</button></>
              )}
            </div>
            {showColors && !image && (
              <div className="flex gap-1.5 mt-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c} type="button" onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-lg bg-gradient-to-br ${c} ring-2 transition-all ${color === c ? 'ring-[#C96442] scale-110' : 'ring-transparent hover:scale-105'}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <AuthInput label="Prénom" value={firstName} onChange={setFirstName} placeholder="Jean" minLength={2} autoComplete="given-name" />
          <AuthInput label="Nom" value={lastName} onChange={setLastName} placeholder="Dupont" minLength={2} autoComplete="family-name" />
        </div>
        <AuthInput label="Nom d'utilisateur" value={nickname} onChange={setNickname} placeholder="@pseudo" minLength={3} autoComplete="username" />
        <AuthInput label="Email" type="email" value={email} onChange={setEmail} placeholder="jean@exemple.com" autoComplete="email" />
        <AuthInput label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" hint="Minimum 6 caractères" minLength={6} autoComplete="new-password" />

        <AuthError message={error} />
        <AuthButton loading={loading}>Créer mon compte</AuthButton>
      </form>

      <p className="text-center text-sm mt-6 text-[#6B655C]">
        Déjà un compte ?{' '}
        <a href="/login" className="font-semibold text-[#C96442] hover:text-[#DA8A6A] transition-colors">Se connecter</a>
      </p>
    </AuthLayout>
  );
}
