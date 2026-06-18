'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import Link from 'next/link';

const DICEBEAR_STYLES = [
  { id: 'thumbs', label: 'Thumbs' },
  { id: 'lorelei', label: 'Lorelei' },
  { id: 'bottts', label: 'Bottts' },
  { id: 'fun-emoji', label: 'Fun' },
  { id: 'pixel-art', label: 'Pixel' },
  { id: 'identicon', label: 'Identicon' },
  { id: 'micah', label: 'Micah' },
  { id: 'adventurer-neutral', label: 'Aventurier' },
] as const;

function dicebearUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

export default function SignupPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'info' | 'avatar'>('info');

  const PWD_CRITERIA = [
    { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
    { label: 'Une majuscule (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Un chiffre (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Un caractère spécial (!@#$…)', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ];
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Avatar
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string>('thumbs');

  const avatarSeed = nickname.trim() || email.split('@')[0] || 'saturn';

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) { setError('Image trop lourde (max 3 Mo).'); return; }
    setError('');
    const reader = new FileReader();
    reader.onload = () => setPhotoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  const allCriteriaOk = PWD_CRITERIA.every((c) => c.test(password));

  const goToAvatar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !nickname.trim()) {
      setError('Remplis tous les champs.');
      return;
    }
    if (!allCriteriaOk) {
      setError('Le mot de passe ne remplit pas tous les critères de sécurité.');
      return;
    }
    setError('');
    setStep('avatar');
  };

  const handleSubmit = async () => {
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

    // Assigner l'avatar : photo uploadée ou DiceBear auto-assigné
    const finalImage = photoDataUrl ?? dicebearUrl(selectedStyle, avatarSeed);
    try {
      await api.patch('/users/me', { image: finalImage, avatarColor: null });
    } catch { /* non bloquant */ }

    router.push('/');
  };

  return (
    <div className="min-h-screen flex" style={{ background: '#0f172a' }}>

      {/* ── Panneau gauche (branding) ── */}
      <div className="hidden lg:flex flex-col justify-between w-[520px] flex-shrink-0 relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1e293b 60%, #0f172a 100%)' }}>
        <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] rounded-full blur-[100px]" style={{ background: 'rgba(37,99,235,0.25)' }} />
        <div className="absolute bottom-[-80px] right-[-80px] w-[300px] h-[300px] rounded-full blur-[80px]" style={{ background: 'rgba(96,165,250,0.15)' }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg text-white"
            style={{ background: 'linear-gradient(135deg, #2563eb, #60a5fa)', boxShadow: '0 4px 20px rgba(37,99,235,0.4)' }}>S</div>
          <span className="text-xl font-black text-white">Saturn</span>
        </div>

        <div className="relative z-10 space-y-6">
          <div>
            <h2 className="text-4xl font-black text-white leading-tight mb-4">
              Rejoins<br />la communauté.
            </h2>
            <p className="text-slate-400 text-lg leading-relaxed">
              Crée ton profil en quelques secondes et commence à discuter instantanément.
            </p>
          </div>
          <div className="space-y-3.5">
            {[
              { icon: '⚡', text: 'Inscription en moins d\'une minute' },
              { icon: '🎭', text: 'Avatar DiceBear unique & personnalisable' },
              { icon: '🔒', text: 'Chiffrement de bout en bout' },
              { icon: '🌍', text: 'Communautés publiques & privées' },
            ].map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <span className="text-slate-300 text-sm font-medium">{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">© 2026 Saturn · Messagerie moderne</p>
      </div>

      {/* ── Panneau droit ── */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md space-y-7">

          {/* Header mobile */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center font-black text-lg text-white"
              style={{ background: 'linear-gradient(135deg, #2563eb, #60a5fa)' }}>S</div>
            <span className="text-xl font-black text-white">Saturn</span>
          </div>

          {/* Indicateur d'étapes */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: '#2563eb' }}>1</div>
              <span className="text-sm font-semibold" style={{ color: step === 'info' ? '#fff' : 'rgba(255,255,255,0.4)' }}>Informations</span>
            </div>
            <div className="flex-1 h-px" style={{ background: step === 'avatar' ? 'rgba(37,99,235,0.6)' : 'rgba(255,255,255,0.1)' }} />
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: step === 'avatar' ? '#2563eb' : 'rgba(255,255,255,0.1)', color: step === 'avatar' ? '#fff' : 'rgba(255,255,255,0.3)' }}>2</div>
              <span className="text-sm font-semibold" style={{ color: step === 'avatar' ? '#fff' : 'rgba(255,255,255,0.4)' }}>Avatar</span>
            </div>
          </div>

          {/* ── Étape 1 : Informations ── */}
          {step === 'info' && (
            <>
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Créer un compte</h1>
                <p className="text-slate-400">Remplis tes informations pour commencer</p>
              </div>

              <form onSubmit={goToAvatar} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FieldGroup label="Prénom">
                    <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Jean"
                      className="field-input" style={inputStyle} />
                  </FieldGroup>
                  <FieldGroup label="Nom">
                    <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Dupont"
                      className="field-input" style={inputStyle} />
                  </FieldGroup>
                </div>

                <FieldGroup label="Nom d'utilisateur">
                  <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} required minLength={3} placeholder="@pseudo"
                    className="field-input" style={inputStyle} />
                </FieldGroup>

                <FieldGroup label="Email">
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jean@exemple.com"
                    className="field-input" style={inputStyle} />
                </FieldGroup>

                <FieldGroup label="Mot de passe">
                  <div className="relative">
                    <input type={showPwd ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="••••••••"
                      className="field-input pr-12" style={inputStyle} />
                    <button type="button" onClick={() => setShowPwd((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        {showPwd
                          ? <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                          : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                      </svg>
                    </button>
                  </div>
                  {password.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1">
                      {PWD_CRITERIA.map((c) => {
                        const ok = c.test(password);
                        return (
                          <div key={c.label} className="flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              {ok
                                ? <><circle cx="6" cy="6" r="6" fill="#22c55e" /><polyline points="3,6 5,8.5 9,3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></>
                                : <circle cx="6" cy="6" r="5.5" stroke="rgba(148,163,184,0.4)" fill="none" />}
                            </svg>
                            <span className="text-[11px]" style={{ color: ok ? '#22c55e' : 'rgba(148,163,184,0.5)' }}>{c.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </FieldGroup>

                {error && <ErrorBox>{error}</ErrorBox>}

                <PrimaryBtn loading={false}>Suivant →</PrimaryBtn>
              </form>

              <p className="text-center text-sm text-slate-500">
                Déjà un compte ?{' '}
                <Link href="/login" className="font-bold" style={{ color: '#60a5fa' }}>Se connecter</Link>
              </p>
            </>
          )}

          {/* ── Étape 2 : Avatar ── */}
          {step === 'avatar' && (
            <>
              <div>
                <h1 className="text-3xl font-black text-white mb-2">Ton avatar</h1>
                <p className="text-slate-400">Choisis un style DiceBear ou ajoute ta propre photo</p>
              </div>

              <div className="space-y-6">
                {/* Aperçu grand format */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center relative"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '2px solid rgba(255,255,255,0.1)' }}>
                    {photoDataUrl
                      ? <img src={photoDataUrl} alt="avatar" className="w-full h-full object-cover" />
                      : <img src={dicebearUrl(selectedStyle, avatarSeed)} alt="avatar" className="w-16 h-16" />
                    }
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={() => fileRef.current?.click()}
                      className="font-medium transition" style={{ color: '#60a5fa' }}>
                      {photoDataUrl ? 'Changer la photo' : '+ Ajouter ma photo'}
                    </button>
                    {photoDataUrl && (
                      <>
                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                        <button type="button" onClick={() => setPhotoDataUrl(null)}
                          className="font-medium transition" style={{ color: '#f87171' }}>Supprimer</button>
                      </>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                </div>

                {/* Grille styles DiceBear */}
                {!photoDataUrl && (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'rgba(148,163,184,0.7)' }}>
                      Styles disponibles
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {DICEBEAR_STYLES.map((s) => (
                        <button key={s.id} type="button" onClick={() => setSelectedStyle(s.id)}
                          className="flex flex-col items-center gap-1.5 p-2.5 rounded-2xl transition"
                          style={{
                            background: selectedStyle === s.id ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.04)',
                            border: selectedStyle === s.id ? '1.5px solid #2563eb' : '1.5px solid rgba(255,255,255,0.08)',
                          }}>
                          <img src={dicebearUrl(s.id, avatarSeed)} alt={s.label} className="w-10 h-10" />
                          <span className="text-[10px] font-semibold text-slate-400">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!photoDataUrl && (
                  <p className="text-xs text-center" style={{ color: 'rgba(148,163,184,0.5)' }}>
                    Tu pourras changer ton avatar à tout moment dans les paramètres
                  </p>
                )}

                {error && <ErrorBox>{error}</ErrorBox>}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep('info')}
                    className="px-5 py-3.5 rounded-xl font-bold text-sm transition"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    ← Retour
                  </button>
                  <PrimaryBtn loading={loading} onClick={handleSubmit} type="button">
                    Créer mon compte
                  </PrimaryBtn>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .field-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border-radius: 0.75rem;
          font-size: 0.875rem;
          color: white;
          background: rgba(255,255,255,0.06);
          border: 1.5px solid rgba(255,255,255,0.1);
          outline: none;
          transition: border-color 0.15s;
        }
        .field-input::placeholder { color: #475569; }
        .field-input:focus { border-color: #2563eb; }
        .field-input.pr-12 { padding-right: 3rem; }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(148,163,184,0.8)' }}>{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-sm"
      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#f87171' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
      <span>{children}</span>
    </div>
  );
}

function PrimaryBtn({ children, loading, onClick, type = 'submit' }: {
  children: React.ReactNode; loading: boolean; onClick?: () => void; type?: 'submit' | 'button';
}) {
  return (
    <button type={type} onClick={onClick} disabled={loading}
      className="flex-1 py-3.5 rounded-xl font-bold text-white transition disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ background: 'linear-gradient(135deg, #2563eb, #3b82f6)', boxShadow: '0 4px 20px rgba(37,99,235,0.35)' }}>
      {loading
        ? <><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Création...</>
        : children}
    </button>
  );
}
