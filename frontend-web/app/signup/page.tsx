'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';

const AVATAR_COLORS = [
  'from-[#2563EB] to-[#60A5FA]',
  'from-[#2563EB] to-[#3B82F6]',
  'from-[#0EA5E9] to-[#6366F1]',
  'from-[#10B981] to-[#0EA5E9]',
  'from-[#F59E0B] to-[#EF4444]',
  'from-[#EF4444] to-[#EC4899]',
];

function Input({
  label, type = 'text', value, onChange, placeholder, hint, minLength,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string; minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest text-[#64748B]">{label}</label>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required minLength={minLength}
        className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all text-sm"
      />
      {hint && <p className="text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

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
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  // Avatar
  const [image, setImage] = useState<string | null>(null);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const initial = (nickname || firstName || '?').charAt(0).toUpperCase();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Image trop lourde (max 3 Mo).'); return; }
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result as string); setShowColorPicker(false); };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await authClient.signUp.email({
      email, password, name: nickname, firstName, lastName, nickname,
    } as any);

    if (authError) {
      setError(authError.message || "Erreur lors de l'inscription");
      setLoading(false);
      return;
    }

    // Enregistrer la photo et/ou la couleur d'avatar
    try {
      await api.patch('/users/me', {
        image: image || null,
        avatarColor: image ? null : avatarColor,
      });
    } catch { /* non bloquant */ }

    router.push('/');
  };

  return (
    <div
      onMouseMove={(e) => setMouse({ x: e.clientX, y: e.clientY })}
      className="relative min-h-screen w-full overflow-hidden bg-[#F8FAFC] flex items-center justify-center px-4 py-12"
    >
      {/* Glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-20%] left-[30%] w-[600px] h-[600px] bg-[#2563EB]/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] bg-[#60A5FA]/15 rounded-full blur-[100px]" />
      </div>
      <div className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ background: `radial-gradient(350px at ${mouse.x}px ${mouse.y}px, rgba(37,99,235,0.1), transparent 70%)` }} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: 'linear-gradient(#1E293B 1px, transparent 1px), linear-gradient(90deg, #1E293B 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-2xl font-black text-white shadow-2xl shadow-[#2563EB]/30 mb-4">S</div>
          <h1 className="text-3xl font-black text-[#1E293B] tracking-tight">Créer un compte</h1>
          <p className="text-sm text-[#64748B] mt-1">Rejoins Saturn et commence à discuter</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ── Sélecteur de photo ── */}
            <div className="flex flex-col items-center gap-3">
              <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Photo de profil</p>

              <div className="relative group">
                {/* Avatar preview */}
                <div
                  className={`w-20 h-20 rounded-3xl overflow-hidden flex items-center justify-center text-3xl font-black cursor-pointer ring-2 ring-transparent group-hover:ring-[#2563EB] transition-all shadow-xl ${!image ? `bg-gradient-to-br ${avatarColor}` : ''}`}
                  onClick={() => fileRef.current?.click()}
                >
                  {image
                    ? <img src={image} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-white select-none">{initial}</span>
                  }
                </div>

                {/* Bouton caméra */}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-[#2563EB] hover:bg-[#60A5FA] flex items-center justify-center shadow-lg transition"
                  title="Ajouter une photo"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                </button>

                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
              </div>

              {/* Actions sous l'avatar */}
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[#64748B] hover:text-[#2563EB] transition font-medium"
                >
                  {image ? 'Changer la photo' : 'Ajouter une photo'}
                </button>

                {image && (
                  <>
                    <span className="text-slate-300">·</span>
                    <button type="button" onClick={() => setImage(null)} className="text-[#64748B] hover:text-[#EF4444] transition font-medium">
                      Supprimer
                    </button>
                  </>
                )}

                {!image && (
                  <>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => setShowColorPicker((v) => !v)}
                      className="text-[#64748B] hover:text-[#2563EB] transition font-medium"
                    >
                      Choisir une couleur
                    </button>
                  </>
                )}
              </div>

              {/* Color picker */}
              {showColorPicker && !image && (
                <div className="flex gap-2 flex-wrap justify-center">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setAvatarColor(c)}
                      className={`w-7 h-7 rounded-xl bg-gradient-to-br ${c} transition ring-2 ${avatarColor === c ? 'ring-[#2563EB] scale-110' : 'ring-transparent hover:scale-105'}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Séparateur */}
            <div className="h-px bg-slate-200" />

            {/* Champs */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Prénom" value={firstName} onChange={setFirstName} placeholder="Jean" minLength={2} />
              <Input label="Nom" value={lastName} onChange={setLastName} placeholder="Dupont" minLength={2} />
            </div>
            <Input label="Nom d'utilisateur" value={nickname} onChange={setNickname} placeholder="@pseudo" minLength={3} />
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="jean@exemple.com" />
            <Input label="Mot de passe" type="password" value={password} onChange={setPassword} placeholder="••••••••" hint="Minimum 6 caractères" minLength={6} />

            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-[#EF4444] px-4 py-3 rounded-xl text-sm">
                <span className="mt-0.5">⚠</span><span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-[#2563EB] to-[#60A5FA] hover:from-[#3B82F6] hover:to-[#93C5FD] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-[#2563EB]/30 hover:shadow-[#2563EB]/50 hover:scale-[1.01] active:scale-[0.99]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Création en cours...
                </span>
              ) : 'Créer mon compte'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-[#64748B] mt-6">
          Déjà un compte ?{' '}
          <a href="/login" className="text-[#60A5FA] hover:text-[#2563EB] font-semibold transition-colors">Se connecter</a>
        </p>
      </div>
    </div>
  );
}
