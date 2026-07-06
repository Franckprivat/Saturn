'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { WALLPAPER_PRESETS } from '@/lib/wallpapers';
import { BUBBLE_COLORS, bubbleGradient, getConvPrefs, setConvPrefs, type ConvPrefs } from '@/lib/convPrefs';
import { usePresenceStore, formatLastSeen } from '@/store/presenceStore';

interface ContactPanelProps {
  conversationId: string;
  currentUserId: string;
  /** L'autre participant du DM. */
  contact: { id: string; nickname?: string | null; email?: string | null; image?: string | null; avatarColor?: string | null };
  online: boolean;
  /** Surnom local actuel (alias). */
  alias: string;
  onAliasChange: (alias: string) => void;
  /** Notifie la page que les préférences (fond / couleur) ont changé. */
  onPrefsChange: (prefs: ConvPrefs) => void;
  onClose: () => void;
}

const SOCIAL_LABELS: Record<string, string> = {
  github: 'GitHub', twitter: 'X / Twitter', instagram: 'Instagram',
  linkedin: 'LinkedIn', website: 'Site web', youtube: 'YouTube',
};

/**
 * Panneau contact façon WhatsApp : ouvert en cliquant sur le profil dans un DM.
 * Bio publique + réglages LOCAUX (surnom, fond, couleur des bulles) qui
 * n'affectent que toi — jamais l'autre utilisateur.
 */
export function ContactPanel({
  conversationId, currentUserId, contact, online, alias, onAliasChange, onPrefsChange, onClose,
}: ContactPanelProps) {
  const router = useRouter();
  const lastSeenLive = usePresenceStore((s) => s.lastSeenById[contact.id]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [aliasInput, setAliasInput] = useState(alias);
  const [prefs, setPrefs] = useState<ConvPrefs>(() => getConvPrefs(currentUserId, conversationId));
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'block' | 'unfriend' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get(`/users/${contact.id}`)
      .then((r) => setProfile(r.data))
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));
  }, [contact.id]);

  const applyPrefs = (patch: Partial<ConvPrefs>) => {
    setConvPrefs(currentUserId, conversationId, patch);
    const next = getConvPrefs(currentUserId, conversationId);
    setPrefs(next);
    onPrefsChange(next);
  };

  const saveAlias = () => onAliasChange(aliasInput.trim());

  const handleWallpaperUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Choisis une image.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('Image trop lourde (10 Mo max).'); return; }
    setUploading(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd);
      applyPrefs({ wallpaper: `url:${res.data.url}` });
    } catch { setUploadError('Erreur lors de l\'upload.'); }
    finally { setUploading(false); }
  };

  const blockContact = async () => {
    try {
      await api.post(`/friends/block/${contact.id}`);
      router.push('/friends');
    } catch { /* ignore */ }
  };

  const unfriendContact = async () => {
    try {
      await api.delete(`/friends/${contact.id}`);
      router.push('/friends');
    } catch { /* ignore */ }
  };

  const displayName = alias || contact.nickname || contact.email?.split('@')[0] || 'Contact';
  const socials = (profile?.socialLinks ?? {}) as Record<string, string>;
  const socialEntries = Object.entries(socials).filter(([, v]) => v?.trim());

  const SECTION = 'text-[10px] font-bold uppercase tracking-widest mb-2';

  return (
    <aside className="flex flex-col flex-shrink-0 w-80 overflow-y-auto"
      style={{ background: 'var(--sat-panel)', borderLeft: '1px solid var(--sat-border)' }}>

      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
        <span className="text-sm font-bold" style={{ color: 'var(--sat-text)' }}>Infos du contact</span>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition"
          style={{ color: 'var(--sat-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sat-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>✕</button>
      </div>

      <div className="p-4 space-y-5">
        {/* Identité */}
        <div className="flex flex-col items-center text-center gap-2 py-2">
          <div className="relative">
            <Avatar user={contact} size="lg" className="w-20 h-20 text-2xl" />
            <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full"
              style={{ background: online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '2.5px solid var(--sat-panel)' }} />
          </div>
          <div>
            <p className="font-bold text-lg leading-tight" style={{ color: 'var(--sat-text)' }}>{displayName}</p>
            {alias && (
              <p className="text-[11px]" style={{ color: 'var(--sat-faint)' }}>@{contact.nickname || contact.email?.split('@')[0]}</p>
            )}
            <p className="text-xs mt-0.5" style={{ color: online ? 'var(--sat-online)' : 'var(--sat-muted)' }}>
              {online
                ? 'En ligne'
                : formatLastSeen(lastSeenLive ?? profile?.lastSeenAt) ?? 'Hors ligne'}
            </p>
          </div>
        </div>

        {/* Bio */}
        <div>
          <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Bio</p>
          {loading ? <Spinner size={14} /> : (
            <p className="text-sm leading-relaxed" style={{ color: profile?.bio ? 'var(--sat-text)' : 'var(--sat-faint)' }}>
              {profile?.bio || 'Aucune bio.'}
            </p>
          )}
          {socialEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {socialEntries.map(([k, url]) => (
                <a key={k} href={url} target="_blank" rel="noreferrer"
                  className="px-2 py-1 rounded-lg text-[11px] font-semibold transition hover:opacity-80"
                  style={{ background: 'var(--sat-hover)', color: 'var(--sat-accent)', border: '1px solid var(--sat-border-2)' }}>
                  {SOCIAL_LABELS[k] || k}
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Surnom local */}
        <div>
          <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Surnom (visible par toi uniquement)</p>
          <div className="flex gap-2">
            <input value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveAlias(); }}
              placeholder={contact.nickname || 'Surnom…'}
              className="flex-1 px-3 py-2 rounded-xl text-sm focus:outline-none min-w-0"
              style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            <button onClick={saveAlias}
              className="px-3 py-2 rounded-xl text-xs font-bold transition text-white flex-shrink-0"
              style={{ background: 'var(--sat-accent)' }}>OK</button>
          </div>
        </div>

        {/* Couleur de la conversation */}
        <div>
          <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Couleur de la conversation</p>
          <div className="grid grid-cols-5 gap-2">
            <button onClick={() => applyPrefs({ bubble: undefined })} title="Couleur du thème"
              className="h-9 rounded-xl text-[9px] font-bold transition"
              style={{
                background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))',
                border: !prefs.bubble ? '2px solid var(--sat-text)' : '1px solid var(--sat-border-2)',
                color: '#fff',
              }}>Auto</button>
            {BUBBLE_COLORS.map((c) => (
              <button key={c.id} onClick={() => applyPrefs({ bubble: c.value })} title={c.label}
                className="h-9 rounded-xl transition hover:scale-105"
                style={{
                  background: bubbleGradient(c.value),
                  border: prefs.bubble === c.value ? '2px solid var(--sat-text)' : '1px solid var(--sat-border-2)',
                }} />
            ))}
          </div>
        </div>

        {/* Fond d'écran de cette conversation */}
        <div>
          <p className={SECTION} style={{ color: 'var(--sat-muted)' }}>Fond de cette conversation</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={() => applyPrefs({ wallpaper: undefined })}
              className="h-12 rounded-xl text-[10px] font-semibold transition"
              style={{
                background: 'var(--sat-main)',
                border: prefs.wallpaper === undefined ? '2px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
                color: 'var(--sat-muted)',
              }}>Global</button>
            {WALLPAPER_PRESETS.map((p) => {
              const active = prefs.wallpaper === `preset:${p.id}`;
              return (
                <button key={p.id} onClick={() => applyPrefs({ wallpaper: `preset:${p.id}` })} title={p.label}
                  className="h-12 rounded-xl transition hover:scale-[1.03]"
                  style={{
                    background: p.css,
                    backgroundColor: 'var(--sat-main)',
                    border: active ? '2px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
                  }} />
              );
            })}
          </div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full mt-2 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
            style={{
              background: prefs.wallpaper?.startsWith('url:') ? 'rgba(160,22,217,0.12)' : 'var(--sat-hover)',
              border: prefs.wallpaper?.startsWith('url:') ? '1.5px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
              color: prefs.wallpaper?.startsWith('url:') ? 'var(--sat-accent)' : 'var(--sat-text)',
            }}>
            {uploading ? 'Envoi…' : prefs.wallpaper?.startsWith('url:') ? '✓ Image personnalisée — en changer' : 'Importer une image'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
          {uploadError && <p className="text-[11px] mt-1" style={{ color: '#EF4444' }}>{uploadError}</p>}
          <p className="text-[10px] mt-2" style={{ color: 'var(--sat-faint)' }}>
            Ces réglages ne sont visibles que par toi.
          </p>
        </div>

        {/* Zone dangereuse */}
        <div className="pt-1 space-y-2" style={{ borderTop: '1px solid var(--sat-border)' }}>
          {confirmAction ? (
            <div className="pt-3 space-y-2">
              <p className="text-xs font-semibold" style={{ color: 'var(--sat-text)' }}>
                {confirmAction === 'block'
                  ? `Bloquer ${displayName} ? Vous ne pourrez plus vous écrire.`
                  : `Retirer ${displayName} de tes amis ?`}
              </p>
              <div className="flex gap-2">
                <button onClick={confirmAction === 'block' ? blockContact : unfriendContact}
                  className="flex-1 py-2 rounded-xl text-xs font-bold text-white transition"
                  style={{ background: '#EF4444' }}>Confirmer</button>
                <button onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition"
                  style={{ background: 'var(--sat-hover)', color: 'var(--sat-text)' }}>Annuler</button>
              </div>
            </div>
          ) : (
            <div className="pt-3 space-y-2">
              <button onClick={() => setConfirmAction('unfriend')}
                className="w-full py-2 rounded-xl text-xs font-bold transition"
                style={{ background: 'var(--sat-hover)', color: 'var(--sat-text)', border: '1px solid var(--sat-border-2)' }}>
                Retirer des amis
              </button>
              <button onClick={() => setConfirmAction('block')}
                className="w-full py-2 rounded-xl text-xs font-bold transition"
                style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                Bloquer
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
