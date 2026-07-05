'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { Spinner } from '@/components/Spinner';
import { ToastHost } from '@/components/Toast';
import { CreateCommunityModal } from '@/components/communities/CreateCommunityModal';
import { useCommunityStore, type CommunitySummary } from '@/store/communityStore';

export default function CommunitiesHomePage() {
  const router = useRouter();
  const { communities, setCommunities } = useCommunityStore();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  // Invitations directes reçues (Accepter / Refuser)
  const [invites, setInvites] = useState<any[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Rejoindre avec un code saisi manuellement
  const [code, setCode] = useState('');

  const loadInvites = () => {
    api.get('/community-invitations/me').then((r) => setInvites(r.data)).catch(() => {});
  };

  useEffect(() => {
    api.get('/communities')
      .then((res) => setCommunities(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    loadInvites();
  }, []);

  const respondInvite = async (inviteId: string, accept: boolean) => {
    setRespondingId(inviteId);
    try {
      const res = await api.post(`/community-invitations/${inviteId}/${accept ? 'accept' : 'decline'}`);
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      if (accept && res.data.communityId) router.push(`/communities/${res.data.communityId}`);
    } catch { loadInvites(); }
    finally { setRespondingId(null); }
  };

  const joinWithCode = () => {
    const trimmed = code.trim();
    if (trimmed) router.push(`/communities/join/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="flex-1 overflow-y-auto" style={{ background: 'var(--sat-main)' }}>
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--sat-text)' }}>Communautés</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--sat-muted)' }}>Tes serveurs et espaces communautaires.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
            + Créer / Rejoindre
          </button>
        </div>

        {/* ── Invitations reçues ── */}
        {invites.length > 0 && (
          <div className="mb-8 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
              Invitations reçues — {invites.length}
            </p>
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-2xl"
                style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-accent)', boxShadow: '0 4px 16px var(--sat-accent-glow)' }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white flex-shrink-0 overflow-hidden"
                  style={{ background: inv.community.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                  {inv.community.image
                    ? <img src={mediaUrl(inv.community.image)} className="w-full h-full object-cover" alt="" />
                    : inv.community.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate" style={{ color: 'var(--sat-text)' }}>{inv.community.name}</p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>
                    {(inv.inviter?.nickname || inv.inviter?.email?.split('@')[0] || 'Quelqu\'un')} t'invite
                    · {inv.community._count?.members ?? '?'} membre{(inv.community._count?.members ?? 0) > 1 ? 's' : ''}
                    {inv.message ? ` · « ${inv.message} »` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => respondInvite(inv.id, true)} disabled={respondingId === inv.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                    style={{ background: '#10B981' }}>Accepter</button>
                  <button onClick={() => respondInvite(inv.id, false)} disabled={respondingId === inv.id}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                    style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>Refuser</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Rejoindre avec un code ── */}
        <div className="mb-8 flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') joinWithCode(); }}
            placeholder="Rejoindre avec un code d'invitation…"
            className="flex-1 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none"
            style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
          <button onClick={joinWithCode} disabled={!code.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition disabled:opacity-40"
            style={{ background: 'var(--sat-hover)', color: 'var(--sat-accent)', border: '1px solid var(--sat-border-2)' }}>
            Rejoindre
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Spinner size={26} /></div>
        ) : communities.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-24 h-24 rounded-3xl mx-auto mb-5 flex items-center justify-center text-5xl" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border)' }}>🌍</div>
            <p className="text-lg font-bold" style={{ color: 'var(--sat-text)' }}>Aucune communauté pour l'instant</p>
            <p className="text-sm mt-1 mb-6" style={{ color: 'var(--sat-muted)' }}>Crée ta propre communauté ou rejoins-en une avec un lien d'invitation.</p>
            <button onClick={() => setShowCreate(true)}
              className="px-5 py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
              Commencer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {communities.map((c: CommunitySummary) => (
              <button key={c.id} onClick={() => router.push(`/communities/${c.id}`)}
                className="flex flex-col items-center gap-3 p-5 rounded-2xl transition hover:scale-[1.03]"
                style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border)' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold overflow-hidden text-white"
                  style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                  {c.image ? <img src={mediaUrl(c.image)} loading="lazy" className="w-full h-full object-cover" alt="" /> : c.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold truncate max-w-[140px]" style={{ color: 'var(--sat-text)' }}>{c.name}</p>
                  <p className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>{c.memberCount} membre{c.memberCount > 1 ? 's' : ''}</p>
                </div>
              </button>
            ))}
            <button onClick={() => setShowCreate(true)}
              className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl transition hover:scale-[1.03]"
              style={{ background: 'transparent', border: '2px dashed var(--sat-border-2)', minHeight: 140 }}>
              <span className="text-3xl" style={{ color: 'var(--sat-accent)' }}>+</span>
              <span className="text-xs font-bold" style={{ color: 'var(--sat-muted)' }}>Ajouter</span>
            </button>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateCommunityModal
          onClose={() => setShowCreate(false)}
          onCreated={(id) => { setShowCreate(false); router.push(`/communities/${id}`); }}
        />
      )}
      <ToastHost />
    </div>
  );
}
