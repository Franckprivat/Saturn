'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { useThemeStore, THEMES, ACCENTS, type ThemeName, type AccentColor } from '@/store/themeStore';
import { PageLoader } from '@/components/Spinner';

type Tab = 'profil' | 'avatar' | 'liens' | 'parametres';

const AVATAR_COLORS = [
  'from-[#2563EB] to-[#60A5FA]',
  'from-[#7C3AED] to-[#2563EB]',
  'from-[#0EA5E9] to-[#6366F1]',
  'from-[#10B981] to-[#0EA5E9]',
  'from-[#F59E0B] to-[#EF4444]',
  'from-[#EF4444] to-[#EC4899]',
  'from-[#8B5CF6] to-[#06B6D4]',
  'from-[#F97316] to-[#EAB308]',
];

const DICEBEAR_STYLES = [
  { id: 'thumbs', label: 'Thumbs', bg: '#dbeafe' },
  { id: 'lorelei', label: 'Lorelei', bg: '#fce7f3' },
  { id: 'bottts', label: 'Robots', bg: '#f0fdf4' },
  { id: 'fun-emoji', label: 'Fun', bg: '#fef9c3' },
  { id: 'pixel-art', label: 'Pixel', bg: '#ede9fe' },
  { id: 'identicon', label: 'Code', bg: '#f1f5f9' },
  { id: 'micah', label: 'Micah', bg: '#fff7ed' },
  { id: 'adventurer-neutral', label: 'Aventurier', bg: '#ecfdf5' },
];

function dicebearUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

const SOCIAL_FIELDS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
  { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/username' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username' },
  { key: 'website', label: 'Site web', placeholder: 'https://monsite.com' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel' },
];

function cx(...cs: (string | false | null | undefined)[]) { return cs.filter(Boolean).join(' '); }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 space-y-2" style={{ borderBottom: '1px solid var(--sat-border)' }}>
      <label className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: 'var(--sat-muted)' }}>{label}</label>
      {children}
    </div>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl overflow-hidden', className)}
      style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border)' }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-hover)' }}>
      <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--sat-muted)' }}>{children}</p>
    </div>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('profil');
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [image, setImage] = useState<string | null>(null);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMessage, setPwdMessage] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);

  const { theme, accent, setTheme, setAccent } = useThemeStore();
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) return router.push('/login');
      api.get('/users/me').then((res) => {
        const u = res.data;
        setUser({ ...data.user, ...u });
        setNickname(u.nickname || '');
        setBio(u.bio || '');
        setAvatarColor(u.avatarColor || AVATAR_COLORS[0]);
        setImage(u.image || null);
        setSocialLinks((u.socialLinks as Record<string, string>) || {});
      }).catch(() => { setUser(data.user); });
    });
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setMessage('Image trop lourde (max 2 Mo).'); return; }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async (patch: Record<string, any>) => {
    setSaving(true); setMessage('');
    try {
      await api.patch('/users/me', patch);
      setMessage('Sauvegardé !');
    } catch { setMessage('Erreur lors de la mise à jour.'); }
    finally { setSaving(false); }
  };

  const pickDicebear = (style: string) => {
    const seed = nickname || user?.email?.split('@')[0] || 'saturn';
    const url = dicebearUrl(style, seed);
    setImage(url);
  };

  const handleLogout = async () => { await authClient.signOut(); router.push('/login'); };

  const PWD_CRITERIA = [
    { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
    { label: 'Une majuscule (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { label: 'Un chiffre (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { label: 'Un caractère spécial', test: (p: string) => /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(p) },
  ];

  const handleChangePassword = async () => {
    setPwdMessage('');
    if (!currentPassword || !newPassword) { setPwdMessage('Remplis tous les champs.'); return; }
    if (newPassword !== confirmPassword) { setPwdMessage('Les mots de passe ne correspondent pas.'); return; }
    if (!PWD_CRITERIA.every((c) => c.test(newPassword))) { setPwdMessage('Le nouveau mot de passe ne respecte pas les critères.'); return; }
    setSavingPwd(true);
    try {
      await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: false });
      setPwdMessage('Mot de passe modifié avec succès !');
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err: any) {
      setPwdMessage(err?.message || 'Erreur lors du changement de mot de passe.');
    } finally {
      setSavingPwd(false);
    }
  };

  if (!user) return <PageLoader label="Chargement du profil..." />;

  const seedName = nickname || user.email?.split('@')[0] || 'saturn';
  const initial = seedName.charAt(0).toUpperCase();
  const isDicebear = image?.includes('api.dicebear.com');

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profil', label: 'Profil' },
    { key: 'avatar', label: 'Avatar' },
    { key: 'liens', label: 'Liens' },
    { key: 'parametres', label: 'Paramètres' },
  ];

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 py-8" style={{ background: 'var(--sat-main)' }}>
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[40%] w-[600px] h-[600px] rounded-full blur-[140px]" style={{ background: 'var(--sat-accent-glow)', opacity: 0.08 }} />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-4">

        {/* ── Header card ── */}
        <Card>
          <div className="flex items-center gap-4 p-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center font-black text-3xl text-white shadow-lg"
                style={{ background: image ? 'transparent' : undefined }}>
                {image ? (
                  <img src={image} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${avatarColor}`}>
                    {initial}
                  </div>
                )}
              </div>
              <button onClick={() => fileRef.current?.click()}
                className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow transition"
                style={{ background: 'var(--sat-accent)' }}
                title="Photo personnalisée">
                +
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-black truncate" style={{ color: 'var(--sat-text)' }}>
                {nickname || user.name || user.email?.split('@')[0]}
              </h1>
              <p className="text-xs truncate mt-0.5" style={{ color: 'var(--sat-muted)' }}>{user.email}</p>
              {user.bio && <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--sat-muted)' }}>{user.bio}</p>}
            </div>

            {/* Logout button */}
            <button onClick={handleLogout}
              className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition"
              style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
              title="Se déconnecter"
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </Card>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border)' }}>
          {TABS.map((t) => (
            <button key={t.key} onClick={() => { setTab(t.key); setMessage(''); }}
              className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
              style={{
                background: tab === t.key ? 'var(--sat-accent)' : 'transparent',
                color: tab === t.key ? '#fff' : 'var(--sat-muted)',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Feedback */}
        {message && (
          <p className="text-xs text-center font-medium"
            style={{ color: message.includes('Erreur') ? '#EF4444' : '#10B981' }}>
            {message}
          </p>
        )}

        {/* ── TAB PROFIL ── */}
        {tab === 'profil' && (
          <div className="space-y-3">
            <Card>
              <SectionTitle>Informations</SectionTitle>
              {[
                { label: 'Prénom', value: user.firstName || '—' },
                { label: 'Nom', value: user.lastName || '—' },
                { label: 'Email', value: user.email },
                { label: 'Membre depuis', value: new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) },
              ].map((row) => (
                <div key={row.label} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sat-border)' }}>
                  <span className="text-xs" style={{ color: 'var(--sat-muted)' }}>{row.label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--sat-text)' }}>{row.value}</span>
                </div>
              ))}
            </Card>

            <Card>
              <Field label="Pseudonyme">
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)}
                  placeholder="Ton pseudo affiché partout…"
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition"
                  style={{ background: 'var(--sat-hover)', border: '1.5px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
              </Field>
              <Field label="Bio">
                <textarea value={bio} onChange={(e) => setBio(e.target.value)}
                  placeholder="Parle de toi en quelques mots…"
                  rows={3} maxLength={280}
                  className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none resize-none transition"
                  style={{ background: 'var(--sat-hover)', border: '1.5px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                <p className="text-right text-[10px]" style={{ color: 'var(--sat-faint)' }}>{bio.length}/280</p>
              </Field>
            </Card>

            {/* QR Code */}
            <Card>
              <div className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--sat-text)' }}>QR Code profil</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sat-muted)' }}>Partage ton profil Saturn</p>
                  </div>
                  <button onClick={() => setShowQR((v) => !v)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium transition"
                    style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)', border: '1px solid var(--sat-border-2)' }}>
                    {showQR ? 'Masquer' : 'Afficher'}
                  </button>
                </div>
                {showQR && (
                  <div className="flex flex-col items-center gap-3 mt-4">
                    <div className="p-3 bg-white rounded-2xl shadow-lg">
                      <QRCodeSVG value={`saturn://user/${user.id}`} size={160} level="M" includeMargin={false} />
                    </div>
                    <p className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>ID : {user.id}</p>
                  </div>
                )}
              </div>
            </Card>

            <button onClick={() => handleSave({ nickname, bio, avatarColor, image })} disabled={saving}
              className="w-full py-3 rounded-2xl text-sm font-bold transition disabled:opacity-50"
              style={{ background: 'var(--sat-accent)', color: '#fff' }}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder le profil'}
            </button>
          </div>
        )}

        {/* ── TAB AVATAR ── */}
        {tab === 'avatar' && (
          <div className="space-y-3">
            {/* Preview */}
            <Card>
              <div className="p-5 flex flex-col items-center gap-4">
                <div className="w-24 h-24 rounded-3xl overflow-hidden flex items-center justify-center font-black text-4xl text-white shadow-xl"
                  style={{ boxShadow: '0 8px 32px var(--sat-accent-glow)' }}>
                  {image ? (
                    <img src={image} alt="aperçu" className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${avatarColor}`}>
                      {initial}
                    </div>
                  )}
                </div>
                <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>Aperçu de ton avatar</p>
                {(image) && (
                  <button onClick={() => setImage(null)}
                    className="text-xs transition px-3 py-1 rounded-lg"
                    style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}>
                    Supprimer {isDicebear ? 'l\'avatar DiceBear' : 'la photo'}
                  </button>
                )}
              </div>
            </Card>

            {/* Photo perso */}
            <Card>
              <SectionTitle>Photo personnalisée</SectionTitle>
              <div className="p-4">
                <button onClick={() => fileRef.current?.click()}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                  style={{ background: 'var(--sat-hover)', border: '1.5px dashed var(--sat-border-2)', color: 'var(--sat-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--sat-accent)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--sat-border-2)')}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                  </svg>
                  Choisir une photo (max 2 Mo)
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </div>
            </Card>

            {/* DiceBear styles */}
            <Card>
              <SectionTitle>Avatars DiceBear</SectionTitle>
              <div className="p-4">
                <p className="text-xs mb-3" style={{ color: 'var(--sat-muted)' }}>
                  Choisis un style généré depuis ton pseudo « <strong style={{ color: 'var(--sat-text)' }}>{seedName}</strong> »
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {DICEBEAR_STYLES.map((s) => {
                    const url = dicebearUrl(s.id, seedName);
                    const active = image === url;
                    return (
                      <button key={s.id} onClick={() => pickDicebear(s.id)}
                        className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition"
                        style={{
                          background: active ? 'var(--sat-accent)' : 'var(--sat-hover)',
                          border: `2px solid ${active ? 'var(--sat-accent)' : 'var(--sat-border-2)'}`,
                          transform: active ? 'scale(1.05)' : 'scale(1)',
                        }}
                        onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--sat-accent)'; }}
                        onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = 'var(--sat-border-2)'; }}>
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center"
                          style={{ background: s.bg }}>
                          <img src={url} alt={s.label} className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[10px] font-semibold" style={{ color: active ? '#fff' : 'var(--sat-muted)' }}>{s.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Couleur gradient (si pas d'image) */}
            {!image && (
              <Card>
                <SectionTitle>Couleur de l'initiale</SectionTitle>
                <div className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    {AVATAR_COLORS.map((c) => (
                      <button key={c} onClick={() => setAvatarColor(c)}
                        className={`w-9 h-9 rounded-xl bg-gradient-to-br ${c} transition`}
                        style={{
                          outline: avatarColor === c ? '2px solid var(--sat-accent)' : '2px solid transparent',
                          outlineOffset: 2,
                          transform: avatarColor === c ? 'scale(1.12)' : 'scale(1)',
                        }} />
                    ))}
                  </div>
                </div>
              </Card>
            )}

            <button onClick={() => handleSave({ avatarColor, image })} disabled={saving}
              className="w-full py-3 rounded-2xl text-sm font-bold transition disabled:opacity-50"
              style={{ background: 'var(--sat-accent)', color: '#fff' }}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder l\'avatar'}
            </button>
          </div>
        )}

        {/* ── TAB LIENS ── */}
        {tab === 'liens' && (
          <div className="space-y-3">
            <Card>
              <SectionTitle>Réseaux sociaux</SectionTitle>
              {SOCIAL_FIELDS.map(({ key, label, placeholder }) => (
                <div key={key} className="px-5 py-3 flex items-center gap-3" style={{ borderBottom: '1px solid var(--sat-border)' }}>
                  <div className="flex-1">
                    <p className="text-[10px] uppercase tracking-wider font-semibold mb-1" style={{ color: 'var(--sat-muted)' }}>{label}</p>
                    <input type="url" value={socialLinks[key] || ''}
                      onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full text-sm bg-transparent focus:outline-none"
                      style={{ color: 'var(--sat-text)' }} />
                  </div>
                  {socialLinks[key] && (
                    <button onClick={() => setSocialLinks((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                      className="text-xs transition" style={{ color: 'var(--sat-faint)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#EF4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-faint)')}>✕</button>
                  )}
                </div>
              ))}
            </Card>
            <button onClick={() => handleSave({ socialLinks })} disabled={saving}
              className="w-full py-3 rounded-2xl text-sm font-bold transition disabled:opacity-50"
              style={{ background: 'var(--sat-accent)', color: '#fff' }}>
              {saving ? 'Sauvegarde…' : 'Sauvegarder les liens'}
            </button>
          </div>
        )}

        {/* ── TAB PARAMÈTRES ── */}
        {tab === 'parametres' && (
          <div className="space-y-3">
            <Card>
              <SectionTitle>Apparence</SectionTitle>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--sat-muted)' }}>Thème</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([key, t]) => (
                      <button key={key} onClick={() => setTheme(key)}
                        style={{ background: t.bg, border: `2px solid ${theme === key ? 'var(--sat-accent)' : t.border}` }}
                        className="rounded-xl py-2 px-3 text-left transition hover:scale-[1.02]">
                        <div className="w-6 h-1.5 rounded-full mb-1.5" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                        <p className="text-[11px] font-semibold" style={{ color: t.text }}>{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-2" style={{ color: 'var(--sat-muted)' }}>Couleur d'accent</p>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(ACCENTS) as [AccentColor, typeof ACCENTS[AccentColor]][]).map(([key, a]) => (
                      <button key={key} onClick={() => setAccent(key)} title={a.label}
                        style={{ background: `linear-gradient(135deg, ${a.primary}, ${a.secondary})`, outline: accent === key ? '3px solid var(--sat-accent)' : '2px solid transparent', outlineOffset: 2, transform: accent === key ? 'scale(1.1)' : 'scale(1)' }}
                        className="w-8 h-8 rounded-xl transition" />
                    ))}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle>Changer le mot de passe</SectionTitle>
              <div className="p-4 space-y-3">
                {(['Mot de passe actuel', 'Nouveau mot de passe', 'Confirmer'] as const).map((label, i) => {
                  const vals = [currentPassword, newPassword, confirmPassword];
                  const setters = [setCurrentPassword, setNewPassword, setConfirmPassword];
                  return (
                    <input key={label} type="password" placeholder={label} value={vals[i]}
                      onChange={(e) => setters[i](e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl text-sm focus:outline-none transition"
                      style={{ background: 'var(--sat-hover)', border: '1.5px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                  );
                })}
                {newPassword && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                    {PWD_CRITERIA.map((c) => {
                      const ok = c.test(newPassword);
                      return (
                        <span key={c.label} className="flex items-center gap-1 text-[11px]" style={{ color: ok ? '#10B981' : 'var(--sat-faint)' }}>
                          {ok ? '✓' : '○'} {c.label}
                        </span>
                      );
                    })}
                  </div>
                )}
                {pwdMessage && (
                  <p className="text-xs font-medium" style={{ color: pwdMessage.includes('succès') ? '#10B981' : '#EF4444' }}>{pwdMessage}</p>
                )}
                <button onClick={handleChangePassword} disabled={savingPwd}
                  className="w-full py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-50"
                  style={{ background: 'var(--sat-accent)', color: '#fff' }}>
                  {savingPwd ? 'Modification…' : 'Changer le mot de passe'}
                </button>
              </div>
            </Card>

            <Card>
              <SectionTitle>Compte</SectionTitle>
              <div className="p-4">
                <button onClick={handleLogout}
                  className="w-full py-3 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  Se déconnecter
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
