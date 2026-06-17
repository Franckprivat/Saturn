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

  return (
    <div className="flex-1 flex flex-col items-center overflow-y-auto px-4 py-8">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[40%] w-[600px] h-[600px] bg-[#2563EB]/8 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg space-y-6">

        {/* Header card */}
        <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-3xl p-6 flex flex-col items-center gap-4">
          {/* Avatar */}
          <div className="relative">
            <div
              className={classNames(
                'w-24 h-24 rounded-3xl flex items-center justify-center text-4xl font-black shadow-2xl shadow-[#2563EB]/20 overflow-hidden',
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
              className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-[#2563EB] hover:bg-[#60A5FA] flex items-center justify-center text-sm transition shadow-lg"
              title="Changer la photo"
            >
              +
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-[#1E293B]">{user.nickname || displayName || user.email}</h1>
            <p className="text-sm text-[#64748B]">{user.email}</p>
            {user.bio && <p className="text-sm text-[#475569] mt-1 max-w-xs">{user.bio}</p>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-1 gap-1">
          {(['profil', 'liens', 'parametres'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setMessage(''); setGroupMessage(''); }}
              className={classNames(
                'flex-1 py-2 rounded-xl text-xs font-semibold transition capitalize',
                tab === t ? 'bg-[#2563EB] text-white' : 'text-[#475569] hover:text-[#1E293B]',
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
              <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-4 space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Couleur de l'avatar</p>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAvatarColor(c)}
                      className={classNames(
                        `w-8 h-8 rounded-xl bg-gradient-to-br ${c} transition ring-2`,
                        avatarColor === c ? 'ring-[#2563EB] scale-110' : 'ring-transparent hover:scale-105',
                      )}
                    />
                  ))}
                </div>
                {image && (
                  <button onClick={() => setImage(null)} className="text-xs text-[#EF4444] hover:text-red-300 transition">
                    Supprimer la photo
                  </button>
                )}
              </div>
            )}

            {image && (
              <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-4 flex items-center justify-between">
                <span className="text-xs text-[#475569]">Photo de profil uploadée</span>
                <button onClick={() => setImage(null)} className="text-xs text-[#EF4444] hover:text-red-300 transition">
                  Supprimer
                </button>
              </div>
            )}

            {/* Infos */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2563EB]/12">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Informations</p>
              </div>
              <div className="divide-y divide-[#2563EB]/12">
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[#475569]">Prénom</span>
                  <span className="text-sm font-medium">{user.firstName || '—'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[#475569]">Nom</span>
                  <span className="text-sm font-medium">{user.lastName || '—'}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[#475569]">Email</span>
                  <span className="text-sm font-medium">{user.email}</span>
                </div>
                <div className="px-4 py-3 flex justify-between items-center">
                  <span className="text-xs text-[#475569]">Membre depuis</span>
                  <span className="text-sm font-medium">
                    {new Date(user.createdAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Pseudonyme */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-4 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Pseudonyme</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ton pseudo affiché..."
                className="w-full bg-[#EFF6FF] border border-[#2563EB]/25 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB] transition placeholder-[#94A3B8]"
              />
            </div>

            {/* Bio */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-4 space-y-2">
              <label className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Parle de toi en quelques mots..."
                rows={3}
                maxLength={280}
                className="w-full bg-[#EFF6FF] border border-[#2563EB]/25 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB] transition placeholder-[#94A3B8] resize-none"
              />
              <p className="text-right text-[10px] text-[#94A3B8]">{bio.length}/280</p>
            </div>

            {/* QR Code profil */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">QR Code profil</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">Partage ton profil Saturn</p>
                </div>
                <button
                  onClick={() => setShowQR((v) => !v)}
                  className="px-3 py-1.5 bg-[#EFF6FF] hover:bg-[#DBEAFE] border border-[#2563EB]/25 rounded-xl text-xs text-[#475569] hover:text-[#1E293B] transition"
                >
                  {showQR ? 'Masquer' : 'Afficher'}
                </button>
              </div>
              {showQR && (
                <div className="flex flex-col items-center gap-3 pt-2">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <QRCodeSVG
                      value={`saturn://user/${user.id}`}
                      size={160}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-[10px] text-[#94A3B8]">ID : {user.id}</p>
                </div>
              )}
            </div>

            {message && (
              <p className={`text-xs text-center ${message.includes('Erreur') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                {message}
              </p>
            )}

            <button
              onClick={handleSaveProfil}
              disabled={saving}
              className="w-full py-3 rounded-2xl bg-[#2563EB] hover:bg-[#60A5FA] disabled:opacity-50 text-sm font-semibold transition"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder le profil'}
            </button>

            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-2xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-[#EF4444] text-sm font-semibold transition"
            >
              Se déconnecter
            </button>
          </div>
        )}

        {/* ── TAB LIENS ── */}
        {tab === 'liens' && (
          <div className="space-y-4">
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2563EB]/12">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Réseaux sociaux</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">Tes liens seront visibles sur ton profil public.</p>
              </div>
              <div className="divide-y divide-[#2563EB]/12">
                {SOCIAL_FIELDS.map(({ key, label, placeholder, icon }) => (
                  <div key={key} className="px-4 py-3 flex items-center gap-3">
                    <span className="text-lg w-6 text-center text-[#475569] flex-shrink-0">{icon}</span>
                    <div className="flex-1">
                      <p className="text-[10px] text-[#64748B] mb-1">{label}</p>
                      <input
                        type="url"
                        value={socialLinks[key] || ''}
                        onChange={(e) => setSocialLinks((prev) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="w-full bg-transparent text-sm text-[#1E293B] placeholder-[#94A3B8] focus:outline-none focus:text-[#1E293B] transition"
                      />
                    </div>
                    {socialLinks[key] && (
                      <button
                        onClick={() => setSocialLinks((prev) => { const n = { ...prev }; delete n[key]; return n; })}
                        className="text-[#94A3B8] hover:text-[#EF4444] transition text-xs flex-shrink-0"
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

            <button
              onClick={handleSaveLiens}
              disabled={saving}
              className="w-full py-3 rounded-2xl bg-[#2563EB] hover:bg-[#60A5FA] disabled:opacity-50 text-sm font-semibold transition"
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder les liens'}
            </button>
          </div>
        )}

        {/* ── TAB PARAMÈTRES ── */}
        {tab === 'parametres' && (
          <div className="space-y-4">

            {/* Thème */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2563EB]/12">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Apparence</p>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs text-[#475569] mb-2">Thème</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(THEMES) as [ThemeName, typeof THEMES[ThemeName]][]).map(([key, t]) => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        style={{ background: t.bg, border: `2px solid ${theme === key ? '#2563EB' : t.border}` }}
                        className="rounded-xl py-2 px-3 text-left transition hover:scale-[1.02]"
                      >
                        <div className="w-6 h-1.5 rounded-full mb-1.5" style={{ background: t.surface, border: `1px solid ${t.border}` }} />
                        <p className="text-[11px] font-semibold" style={{ color: t.text }}>{t.label}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-[#475569] mb-2">Couleur d'accent</p>
                  <div className="flex gap-2 flex-wrap">
                    {(Object.entries(ACCENTS) as [AccentColor, typeof ACCENTS[AccentColor]][]).map(([key, a]) => (
                      <button
                        key={key}
                        onClick={() => setAccent(key)}
                        title={a.label}
                        style={{ background: `linear-gradient(135deg, ${a.primary}, ${a.secondary})` }}
                        className={classNames(
                          'w-8 h-8 rounded-xl transition ring-2 ring-offset-2 ring-offset-white',
                          accent === key ? 'ring-[#2563EB] scale-110' : 'ring-transparent hover:scale-105',
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Créer un groupe */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2563EB]/12">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Créer un groupe</p>
                <p className="text-xs text-[#94A3B8] mt-0.5">Sélectionne des amis pour démarrer une conversation de groupe.</p>
              </div>

              <div className="p-4 space-y-3">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nom du groupe..."
                  className="w-full bg-[#EFF6FF] border border-[#2563EB]/25 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#2563EB] transition placeholder-[#94A3B8]"
                />

                {friends.length === 0 ? (
                  <p className="text-xs text-[#64748B] py-2">Aucun ami disponible. Ajoute des amis d'abord.</p>
                ) : (
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {friends.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => toggleFriend(f.id)}
                        className={classNames(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left',
                          selectedFriends.includes(f.id)
                            ? 'bg-[#2563EB]/20 border border-[#2563EB]/40'
                            : 'bg-white border border-[#2563EB]/12 hover:bg-[#EFF6FF]',
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {(f.nickname || f.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{f.nickname || f.email}</p>
                        </div>
                        <div className={classNames(
                          'w-4 h-4 rounded-full border-2 flex-shrink-0 transition',
                          selectedFriends.includes(f.id) ? 'bg-[#2563EB] border-[#2563EB]' : 'border-[#2563EB]/30',
                        )} />
                      </button>
                    ))}
                  </div>
                )}

                {selectedFriends.length > 0 && (
                  <p className="text-xs text-[#475569]">{selectedFriends.length} ami(s) sélectionné(s)</p>
                )}

                {groupMessage && (
                  <p className={`text-xs ${groupMessage.includes('Erreur') || groupMessage.includes('nom') ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                    {groupMessage}
                  </p>
                )}

                <button
                  onClick={handleCreateGroup}
                  disabled={creatingGroup}
                  className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#60A5FA] disabled:opacity-50 text-sm font-semibold transition"
                >
                  {creatingGroup ? 'Création...' : 'Créer le groupe'}
                </button>
              </div>
            </div>

            {/* Compte */}
            <div className="bg-white border border-[#2563EB]/15 shadow-sm rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-[#2563EB]/12">
                <p className="text-[10px] uppercase tracking-widest text-[#64748B] font-semibold">Compte</p>
              </div>
              <div className="p-4">
                <button
                  onClick={handleLogout}
                  className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-[#EF4444] text-sm font-semibold transition"
                >
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
