'use client';

import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';

interface CreateCommunityModalProps {
  onClose: () => void;
  onCreated: (communityId: string) => void;
}

export function CreateCommunityModal({ onClose, onCreated }: CreateCommunityModalProps) {
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast('Image trop lourde (max 5 Mo)', 'error'); return; }
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form);
      setImage(res.data.url);
    } catch { toast('Erreur upload', 'error'); }
    e.target.value = '';
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/communities', { name: name.trim(), description: description.trim() || undefined, image: image || undefined });
      toast('Communauté créée 🚀', 'success');
      onCreated(res.data.id);
    } catch { toast('Erreur lors de la création', 'error'); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    const t = token.trim().replace(/.*\/join\//, '');
    if (!t) return;
    setLoading(true);
    try {
      const res = await api.post(`/communities/join/${t}`);
      toast(`Tu as rejoint ${res.data.name} 🎉`, 'success');
      onCreated(res.data.id);
    } catch { toast('Invitation invalide ou expirée', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl overflow-hidden"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', boxShadow: '0 20px 60px rgba(15,23,42,0.3)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          {(['create', 'join'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="flex-1 py-3.5 text-sm font-bold transition relative"
              style={{ color: tab === t ? 'var(--sat-accent)' : 'var(--sat-muted)' }}>
              {t === 'create' ? 'Créer' : 'Rejoindre'}
              {tab === t && <span className="absolute bottom-0 left-0 right-0 h-0.5" style={{ background: 'var(--sat-accent)' }} />}
            </button>
          ))}
          <button onClick={onClose} className="px-4 text-lg" style={{ color: 'var(--sat-muted)' }}>✕</button>
        </div>

        {tab === 'create' ? (
          <div className="p-5 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden transition"
                style={{ background: image ? 'transparent' : 'var(--sat-hover)', border: '2px dashed var(--sat-border-2)' }}>
                {image
                  ? <img src={mediaUrl(image)} className="w-full h-full object-cover" alt="" />
                  : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--sat-muted)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>}
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
              <p className="text-[11px]" style={{ color: 'var(--sat-faint)' }}>Icône de la communauté</p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sat-muted)' }}>Nom</label>
              <input autoFocus type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Ma super communauté"
                className="w-full mt-1.5 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sat-muted)' }}>Description (optionnel)</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="De quoi parle ta communauté ?" rows={2}
                className="w-full mt-1.5 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            </div>

            <button onClick={handleCreate} disabled={loading || !name.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--sat-accent)' }}>
              {loading ? <Spinner size={16} /> : 'Créer la communauté'}
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-3xl" style={{ background: 'var(--sat-hover)' }}>🔗</div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--sat-muted)' }}>Lien ou code d'invitation</label>
              <input autoFocus type="text" value={token} onChange={(e) => setToken(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleJoin(); }}
                placeholder="ex: a1b2c3d4 ou un lien complet"
                className="w-full mt-1.5 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            </div>
            <button onClick={handleJoin} disabled={loading || !token.trim()}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40 flex items-center justify-center gap-2"
              style={{ background: 'var(--sat-accent)' }}>
              {loading ? <Spinner size={16} /> : 'Rejoindre la communauté'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
