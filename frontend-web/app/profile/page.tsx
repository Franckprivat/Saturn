'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { useThemeStore, THEMES, ACCENTS, type ThemeName, type AccentColor } from '@/store/themeStore';
import { PageLoader } from '@/components/Spinner';

type Tab = 'profil' | 'liens' | 'parametres';

const AVATAR_COLORS = [
  'from-[#2563EB] to-[#60A5FA]',
  'from-[#2563EB] to-[#2563EB]',
  'from-[#0EA5E9] to-[#6366F1]',
  'from-[#10B981] to-[#0EA5E9]',
  'from-[#F59E0B] to-[#EF4444]',
  'from-[#EF4444] to-[#EC4899]',
  'from-[#8B5CF6] to-[#06B6D4]',
  'from-[#F97316] to-[#EAB308]',
];

const DICEBEAR_STYLES = [
  { key: 'adventurer', label: 'Aventurier' },
  { key: 'avataaars', label: 'Avataaars' },
  { key: 'big-smile', label: 'Sourire' },
  { key: 'bottts', label: 'Robots' },
  { key: 'croodles', label: 'Croodles' },
  { key: 'fun-emoji', label: 'Emoji' },
  { key: 'lorelei', label: 'Lorelei' },
  { key: 'micah', label: 'Micah' },
  { key: 'miniavs', label: 'Mini' },
  { key: 'notionists', label: 'Notion' },
  { key: 'open-peeps', label: 'Peeps' },
  { key: 'personas', label: 'Personas' },
  { key: 'pixel-art', label: 'Pixel' },
  { key: 'thumbs', label: 'Thumbs' },
  { key: 'big-ears', label: 'Big Ears' },
  { key: 'dylan', label: 'Dylan' },
];

function dicebearUrl(style: string, seed: string) {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&backgroundColor=transparent`;
}

function makeSeeds(count = 11) {
  return Array.from({ length: count }, () => Math.random().toString(36).slice(2, 10));
}

const SOCIAL_FIELDS = [
  { key: 'github', label: 'GitHub', placeholder: 'https://github.com/username', icon: '⌂' },
  { key: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/username', icon: '𝕏' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/username', icon: '◎' },
  { key: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/in/username', icon: '⊞' },
  { key: 'website', label: 'Site web', placeholder: 'https://monsite.com', icon: '⊙' },
  { key: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@channel', icon: '▶' },
];

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

// Classes réutilisables (thématisées)
const CARD = 'bg-[var(--sat-surface)] border border-[var(--sat-border)] shadow-sm rounded-2xl';
const LABEL = 'text-[10px] uppercase tracking-widest text-[var(--sat-muted)] font-semibold';
const FIELD = 'w-full bg-[var(--sat-hover)] border border-[var(--sat-border-2)] rounded-xl px-4 py-2.5 text-sm text-[var(--sat-text)] focus:outline-none focus:border-[var(--sat-accent)] transition placeholder-[var(--sat-faint)]';
const BTN_PRIMARY = 'w-full py-3 rounded-2xl bg-[var(--sat-accent)] hover:bg-[var(--sat-accent2)] text-white disabled:opacity-50 text-sm font-semibold transition';
const BTN_DANGER = 'w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-[#EF4444] text-sm font-semibold transition';

export default function ProfilePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('profil');
  const [user, setUser] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  // Profil fields
  const [nickname, setNickname] = useState('');
  const [bio, setBio] = useState('');
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [image, setImage] = useState<string | null>(null);

  // Sélecteur DiceBear
  const [diceStyle, setDiceStyle] = useState(DICEBEAR_STYLES[0].key);
  const [diceSeeds, setDiceSeeds] = useState<string[]>(() => makeSeeds());

  // Social links
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({});

  // Paramètres — création de groupe
  const [friends, setFriends] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupMessage, setGroupMessage] = useState('');

  // Theme
  const { theme, accent, setTheme, setAccent } = useThemeStore();
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) return router.push('/login');
      // Fetch full profile from our API (includes bio, socialLinks, etc.)
      api.get('/users/me').then((res) => {
        const u = res.data;
        setUser({ ...data.user, ...u });
        setNickname(u.nickname || '');
        setBio(u.bio || '');
        setAvatarColor(u.avatarColor || AVATAR_COLORS[0]);
        setImage(u.image || null);
        setSocialLinks((u.socialLinks as Record<string, string>) || {});
      }).catch(() => {
        setUser(data.user);
      });
    });

    api.get('/friends').then((res) => setFriends(res.data)).catch(() => {});
  }, []);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setMessage('Image trop lourde (max 2 Mo).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfil = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/users/me', { nickname, bio, avatarColor, image });
      setMessage('Profil mis à jour !');
    } catch {
      setMessage('Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLiens = async () => {
    setSaving(true);
    setMessage('');
    try {
      await api.patch('/users/me', { socialLinks });
      setMessage('Liens mis à jour !');
    } catch {
      setMessage('Erreur lors de la mise à jour.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) {
      setGroupMessage('Donne un nom et sélectionne au moins un ami.');
      return;
    }
    setCreatingGroup(true);
    setGroupMessage('');
    try {
      const res = await api.post('/conversations/group', {
        name: groupName.trim(),
        memberIds: selectedFriends,
      });
      setGroupMessage(`Groupe "${res.data.name}" créé !`);
      setGroupName('');
      setSelectedFriends([]);
    } catch {
      setGroupMessage('Erreur lors de la création du groupe.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push('/login');
  };

  const toggleFriend = (id: string) => {
    setSelectedFriends((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  if (!user) {
    return <PageLoader label="Chargement du profil..." />;
  }

  const initial = (user.nickname || user.name || user.email).charAt(0).toUpperCase();
  const displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.name;
  const seedName = nickname || user.email?.split('@')[0] || 'saturn';
  const isDicebear = !!image && image.includes('api.dicebear.com');
  const diceList = [seedName, ...diceSeeds];

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 py-8 text-[var(--sat-text)]">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[40%] w-[600px] h-[600px] rounded-full blur-[140px]" style={{ background: 'var(--sat-accent-glow)' }} />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6">

        {/* Header card */}
        <div className={`${CARD} p-6 flex flex-col items-center gap-4`}>
          {/* Avatar */}
          <div className="relative">
            <div
              className={classNames(
                'w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-black text-white shadow-2xl shadow-[#2563EB]/20 overflow-hidden',
                !image ? `bg-gradient-to-br ${avatarColor}` : '',
              )}
            >
              {image ? (
                <img src={image} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[var(--sat-accent)] hover:bg-[var(--sat-accent2)] text-white flex items-center justify-center text-sm transition shadow-lg"
              title="Changer la photo"
            >
              +
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-[var(--sat-text)]">{user.nickname || displayName || user.email}</h1>
            <p className="text-sm text-[var(--sat-muted)]">{user.email}</p>
            {user.bio && <p className="text-sm text-[var(--sat-muted)] mt-1 max-w-xs">{user.bio}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className={`flex ${CARD} p-1 gap-1`}>
          {(['profil', 'liens', 'parametres'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(''); setGroupMessage(''); }}
              className={classNames(
                'flex-1 py-2 rounded-xl text-xs font-semibold transition capitalize',
                tab === t ? 'bg-[var(--sat-accent)] text-white' : 'text-[var(--sat-muted)] hover:text-[var(--sat-text)]',
              )}
            >
              {t === 'profil' ? 'Profil' : t === 'liens' ? 'Liens' : 'Paramètres'}
            </button>
          ))}
        </div>

        {/* ── TAB PROFIL ── */}
        {tab === 'profil' && (
          <div className="space-y-4">
            {/* Couleur avatar */}
            {!image && (
              <div className={`${CARD} p-4 space-y-3`}>
                <p className={LABEL}>Couleur de l'avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAvatarColor(c)}
                      className={classNames(
                        `w-8 h-8 rounded-xl bg-gradient-to-br ${c} transition ring-2`,
                        avatarColor === c ? 'ring-[var(--sat-accent)] scale-110' : 'ring-transparent hover:scale-105',
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {image && (
              <div className={`${CARD} p-4 flex items-center justify-between`}>
                <span className="text-xs text-[var(--sat-muted)]">
                  {isDicebear ? 'Avatar DiceBear sélectionné' : 'Photo de profil uploadée'}
                </span>
                <button onClick={() => setImage(null)} className="text-xs text-[#EF4444] hover:text-red-300 transition">
                  Supprimer
                </button>
              </div>
            )}

            {/* Avatars DiceBear */}
            <div className={`${CARD} p-4 space-y-3`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={LABEL}>Avatar généré</p>
                  <p className="text-xs text-[var(--sat-faint)] mt-0.5">Choisis un style, puis une variante.</p>
                </div>
                <button
                  onClick={() => setDiceSeeds(makeSeeds())}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--sat-hover)] hover:bg-[var(--sat-active)] border border-[var(--sat-border-2)] rounded-xl text-xs font-semibold text-[var(--sat-accent)] transition flex-shrink-0"
                  title="Générer de nouvelles variantes"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                  </svg>
                  Régénérer
                </button>
              </div>

              {/* Styles (chips défilantes) */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {DICEBEAR_STYLES.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setDiceStyle(key)}
                    className={classNames(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex-shrink-0',
                      diceStyle === key ? 'bg-[var(--sat-accent)] text-white' : 'bg-[var(--sat-hover)] text-[var(--sat-muted)] hover:bg-[var(--sat-active)]',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Grille de variantes */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {diceList.map((seed, i) => {
                  const url = dicebearUrl(diceStyle, seed);
                  const active = image === url;
                  return (
                    <button
                      key={`${diceStyle}-${seed}-${i}`}
                      onClick={() => setImage(url)}
                      title={i === 0 ? 'Basé sur ton pseudo' : 'Variante aléatoire'}
                      className={classNames(
                        'relative aspect-square rounded-2xl p-1.5 flex items-center justify-center transition ring-2',
                        active ? 'ring-[var(--sat-accent)] bg-[var(--sat-hover)] scale-105' : 'ring-transparent bg-[var(--sat-hover)] hover:bg-[var(--sat-active)] hover:scale-105',
                      )}
                    >
                      <img src={url} alt={`Avatar ${i + 1}`} className="w-full h-full object-contain" loading="lazy" />
                      {active && (
                        <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-[var(--sat-accent)] flex items-center justify-center">
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Infos */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--sat-border)]">
                <p className={LABEL}>Informations</p>
              </div>
              <div className="divide-y divide-[var(--sat-border)]">
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[var(--sat-muted)]">Prénom</span>
                  <span className="text-sm font-medium">{user.firstName || '—'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[var(--sat-muted)]">Nom</span>
                  <span className="text-sm font-medium">{user.lastName || '—'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[var(--sat-muted)]">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[var(--sat-muted)]">Membre depuis</span>
                  <span className="text-sm font-medium">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Pseudonyme */}
            <div className={`${CARD} p-4 space-y-2`}>
              <label className={LABEL}>Pseudonyme</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ton pseudo affiché..."
                className={FIELD}
              />
            </div>

            {/* Bio */}
            <div className={`${CARD} p-4 space-y-2`}>
              <label className={LABEL}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Parle de toi en quelques mots..."
                rows={3}
                maxLength={280}
                className={`${FIELD} resize-none`}
              />
              <p className="text-right text-[10px] text-[var(--sat-faint)]">{bio.length}/280</p>
            </div>

            {/* QR Code profil */}
            <div className={`${CARD} p-4 space-y-3`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={LABEL}>QR Code profil</p>
                  <p className="text-xs text-[var(--sat-faint)] mt-0.5">Partage ton profil Saturn</p>
                </div>
                <button
                  onClick={() => setShowQR((v) => !v)}
                  className="px-3 py-1.5 bg-[var(--sat-hover)] hover:bg-[var(--sat-active)] border border-[var(--sat-border-2)] rounded-xl text-xs text-[var(--sat-muted)] hover:text-[var(--sat-text)] transition"
                >
                  {showQR ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showQR && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  {/* Fond blanc volontaire : nécessaire pour la lisibilité du QR */}
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <QRCodeSVG
                      value={`saturn://user/${user.id}`}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-[10px] text-[var(--sat-faint)]">ID : {user.id}</p>
                </div>
              )}
            </div>

            {message && (
              <p className={`text-xs text-center ${message.includes('Erreur') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {message}
              </p>
            )}

            <button onClick={handleSaveProfil} disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
            </button>

            <button onClick={handleLogout} className={BTN_DANGER}>
              Se déconnecter
            </button>
          </div>
        )}

        {/* ── TAB LIENS ── */}
        {tab === 'liens' && (
          <div className="space-y-4">
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--sat-border)]">
                <p className={LABEL}>Réseaux sociaux</p>
                <p className="text-xs text-[var(--sat-faint)] mt-0.5">Tes liens seront visibles sur ton profil public.</p>
              </div>
              <div className="divide-y divide-[var(--sat-border)]">
                {SOCIAL_FIELDS.map(({ key, label, placeholder, icon }) => (
                  <div key={key} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-lg w-6 text-center text-[var(--sat-muted)] flex-shrink-0">{icon}</span>
                    <div className="flex-1">
                      <p className="text-[10px] text-[var(--sat-muted)] mb-1">{label}</p>
                      <input
                        type="url"
                        value={socialLinks[key] || ''}
                        onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-transparent text-sm text-[var(--sat-text)] placeholder-[var(--sat-faint)] focus:outline-none transition"
                      />
                    </div>
                    {socialLinks[key] && (
                      <button
                        onClick={() => setSocialLinks((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                        className="text-[var(--sat-faint)] hover:text-[#EF4444] transition text-xs flex-shrink-0"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {message && (
              <p className={`text-xs text-center ${message.includes('Erreur') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {message}
              </p>
            )}

            <button onClick={handleSaveLiens} disabled={saving} className={BTN_PRIMARY}>
              {saving ? 'Sauvegarde...' : 'Sauvegarder les liens'}
            </button>
          </div>
        )}

        {/* ── TAB PARAMÈTRES ── */}
        {tab === 'parametres' && (
          <div className="space-y-4">

            {/* Thème */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--sat-border)]">
                <p className={LABEL}>Apparence</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-[var(--sat-muted)] mb-2">Thème</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        style={{ background: t.bg, border: `2px solid ${theme === key ? 'var(--sat-accent)' : t.border}` }}
                        className="rounded-xl py-2 px-3 text-left transition hover:scale-[1.02]"
                      >
                        <div className="w-6 h-1.5 rounded-full mb-1.5" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                        <p className="text-[11px] font-semibold" style={{ color: t.text }}>{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[var(--sat-muted)] mb-2">Couleur d'accent</p>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(ACCENTS) as [AccentColor, typeof ACCENTS[AccentColor]][]).map(([key, a]) => (
                      <button
                        key={key}
                        onClick={() => setAccent(key)}
                        title={a.label}
                        style={{ background: `linear-gradient(135deg, ${a.primary}, ${a.secondary})` }}
                        className={classNames(
                          'w-8 h-8 rounded-xl transition ring-2 ring-offset-2 ring-offset-[var(--sat-surface)]',
                          accent === key ? 'ring-[var(--sat-accent)] scale-110' : 'ring-transparent hover:scale-105',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Créer un groupe */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--sat-border)]">
                <p className={LABEL}>Créer un groupe</p>
                <p className="text-xs text-[var(--sat-faint)] mt-0.5">Sélectionne des amis pour démarrer une conversation de groupe.</p>
              </div>

              <div className="p-4 space-y-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nom du groupe..."
                  className={FIELD}
                />

                {friends.length === 0 ? (
                  <p className="text-xs text-[var(--sat-muted)] py-2">Aucun ami disponible. Ajoute des amis d'abord.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {friends.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f.id)}
                        className={classNames(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left border',
                          selectedFriends.includes(f.id)
                            ? 'bg-[var(--sat-accent-glow)] border-[var(--sat-accent)]'
                            : 'bg-[var(--sat-surface)] border-[var(--sat-border)] hover:bg-[var(--sat-hover)]',
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                          {(f.nickname || f.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{f.nickname || f.email}</p>
                        </div>
                        <div className={classNames(
                          'w-4 h-4 rounded-full border-2 flex-shrink-0 transition',
                          selectedFriends.includes(f.id) ? 'bg-[var(--sat-accent)] border-[var(--sat-accent)]' : 'border-[var(--sat-border-2)]',
                        )} />
                      </button>
                    ))}
                  </div>
                )}

                {selectedFriends.length > 0 && (
                  <p className="text-xs text-[var(--sat-muted)]">{selectedFriends.length} ami(s) sélectionné(s)</p>
                )}

                {groupMessage && (
                  <p className={`text-xs ${groupMessage.includes('Erreur') || groupMessage.includes('nom') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                    {groupMessage}
                  </p>
                )}

                <button onClick={handleCreateGroup} disabled={creatingGroup} className={`${BTN_PRIMARY} !py-2.5 !rounded-xl`}>
                  {creatingGroup ? 'Création...' : 'Créer le groupe'}
                </button>
              </div>
            </div>

            {/* Compte */}
            <div className={`${CARD} overflow-hidden`}>
              <div className="px-4 py-3 border-b border-[var(--sat-border)]">
                <p className={LABEL}>Compte</p>
              </div>
              <div className="p-4">
                <button onClick={handleLogout} className={`${BTN_DANGER} !rounded-xl`}>
                  Se déconnecter
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
