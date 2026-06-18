'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Spinner } from '@/components/Spinner';
import { ToastHost } from '@/components/Toast';
import { CreateCommunityModal } from '@/components/communities/CreateCommunityModal';
import { useCommunityStore, type CommunitySummary } from '@/store/communityStore';

export default function CommunitiesHomePage() {
  const router = useRouter();
  const { communities, setCommunities } = useCommunityStore();
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    api.get('/communities')
      .then((res) => setCommunities(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
                  {c.image ? <img src={c.image} className="w-full h-full object-cover" alt="" /> : c.name.charAt(0).toUpperCase()}
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
