'use client';

import { useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';

function dn(u: { nickname?: string | null; email?: string | null }) {
  return u?.nickname?.trim() || u?.email?.split('@')[0] || 'Inconnu';
}

interface Friend { id: string; nickname?: string | null; email?: string | null; image?: string | null; avatarColor?: string | null; }

interface CreateGroupModalProps {
  friends: Friend[];
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export function CreateGroupModal({ friends, onClose, onCreated }: CreateGroupModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [image, setImage] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => friends.filter((f) => dn(f).toLowerCase().includes(search.toLowerCase())),
    [friends, search],
  );

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image trop lourde (max 5 Mo)', 'error'); return; }
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImage(res.data.url);
    } catch { toast('Erreur upload image', 'error'); }
    e.target.value = '';
  };

  const handleCreate = async () => {
    if (!name.trim() || selected.length === 0) return;
    setCreating(true);
    try {
      const res = await api.post('/conversations/group', { name: name.trim(), memberIds: selected, image: image || undefined });
      // image est posée à la création via PATCH si nécessaire
      if (image) await api.patch(`/conversations/${res.data.id}`, { image }).catch(() => {});
      toast('Groupe créé 🎉', 'success');
      onCreated(res.data.id);
    } catch { toast('Erreur lors de la création', 'error'); }
    finally { setCreating(false); }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', boxShadow: '0 20px 60px rgba(15,23,42,0.3)', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>👥</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold" style={{ color: 'var(--sat-text)' }}>Nouveau groupe</h2>
            <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>
              {step === 1 ? 'Choisis un nom et une photo' : `${selected.length} membre(s) sélectionné(s)`}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ color: 'var(--sat-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>✕</button>
        </div>

        {step === 1 ? (
          <div className="p-5 space-y-4">
            {/* Photo + nom */}
            <div className="flex items-center gap-4">
              <button onClick={() => fileRef.current?.click()}
                className="w-16 h-16 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 transition relative group"
                style={{ background: image ? 'transparent' : 'var(--sat-hover)', border: '2px dashed var(--sat-border-2)' }}>
                {image
                  ? <img src={image} className="w-full h-full object-cover" alt="" />
                  : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--sat-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                    </svg>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              <div className="flex-1">
                <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) setStep(2); }}
                  placeholder="Nom du groupe"
                  className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                  style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                <p className="text-[11px] mt-1.5" style={{ color: 'var(--sat-faint)' }}>La photo est optionnelle</p>
              </div>
            </div>

            <button onClick={() => name.trim() && setStep(2)} disabled={!name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
              style={{ background: 'var(--sat-accent)' }}>
              Continuer →
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2">
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un ami..."
                className="w-full rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            </div>

            {/* Sélection résumée */}
            {selected.length > 0 && (
              <div className="px-5 pb-2 flex gap-2 flex-wrap">
                {selected.map((id) => {
                  const f = friends.find((x) => x.id === id);
                  if (!f) return null;
                  return (
                    <button key={id} onClick={() => toggle(id)}
                      className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full text-xs transition"
                      style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--sat-accent)' }}>
                      <Avatar user={f} size="xs" className="w-4 h-4" />
                      {dn(f)} <span className="opacity-60">✕</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Liste amis */}
            <div className="flex-1 overflow-y-auto px-3 pb-2" style={{ minHeight: 180 }}>
              {filtered.length === 0 && (
                <p className="text-center text-sm py-8" style={{ color: 'var(--sat-faint)' }}>Aucun ami trouvé</p>
              )}
              {filtered.map((f) => {
                const isSel = selected.includes(f.id);
                return (
                  <button key={f.id} onClick={() => toggle(f.id)}
                    className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-left transition mb-0.5"
                    style={{ background: isSel ? 'rgba(37,99,235,0.08)' : 'transparent' }}
                    onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = 'var(--sat-hover)'; }}
                    onMouseLeave={(e) => { if (!isSel) e.currentTarget.style.background = 'transparent'; }}>
                    <Avatar user={f} size="sm" className="w-9 h-9" />
                    <span className="flex-1 text-sm font-medium truncate" style={{ color: 'var(--sat-text)' }}>{dn(f)}</span>
                    <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 transition"
                      style={{ border: `2px solid ${isSel ? 'var(--sat-accent)' : 'var(--sat-border-2)'}`, background: isSel ? 'var(--sat-accent)' : 'transparent' }}>
                      {isSel && <span className="text-[9px] font-black text-white">✓</span>}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="p-4 flex gap-2" style={{ borderTop: '1px solid var(--sat-border)' }}>
              <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl text-sm font-medium transition"
                style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>← Retour</button>
              <button onClick={handleCreate} disabled={creating || selected.length === 0}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ background: 'var(--sat-accent)' }}>
                {creating ? <Spinner size={16} /> : `Créer le groupe (${selected.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
