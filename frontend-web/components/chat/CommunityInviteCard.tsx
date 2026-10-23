'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ChatMessage } from '@/store/chatStore';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { toast } from '@/components/Toast';
import { apiErrorMessage } from '@/lib/errors';

export function CommunityInviteCard({ msg }: { msg: ChatMessage }) {
  const router = useRouter();
  const meta = msg.metadata as { communityId: string; communityName: string; communityImage?: string | null; token?: string | null } | null;
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'refused'>('idle');

  if (!meta?.communityName) return <div className="px-3.5 py-2 text-sm rounded-2xl" style={{ background: 'var(--sat-surface)', color: 'var(--sat-text)' }}>{msg.content}</div>;

  const handleJoin = async () => {
    if (!meta.token) return;
    setStatus('joining');
    try {
      const res = await api.post(`/communities/join/${meta.token}`);
      if (res.data.requested) {
        // Communauté sur approbation : la demande attend un modérateur
        setStatus('idle');
        toast('Demande envoyée, un modérateur doit l\'accepter', 'success');
        return;
      }
      setStatus('joined');
      setTimeout(() => router.push(`/communities/${res.data.id}`), 600);
    } catch (err) {
      setStatus('idle');
      toast(apiErrorMessage(err, 'Impossible de rejoindre la communauté'), 'error');
    }
  };

  return (
    <div className="rounded-2xl overflow-hidden shadow-sm w-64" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
      {/* Banner */}
      <div className="h-16 flex items-center justify-center relative overflow-hidden"
        style={{ background: meta.communityImage ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
        {meta.communityImage
          ? <img src={mediaUrl(meta.communityImage)} alt="" loading="lazy" className="w-full h-full object-cover" />
          : <span className="text-3xl font-black text-white">{meta.communityName.charAt(0)}</span>}
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
      </div>
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: 'var(--sat-faint)' }}>Invitation à rejoindre</p>
        <p className="font-bold text-[15px] mb-3 truncate" style={{ color: 'var(--sat-text)' }}>{meta.communityName}</p>
        {status === 'joined' ? (
          <p className="text-sm text-center font-semibold py-1.5" style={{ color: 'var(--sat-online)' }}>✓ Rejoint !</p>
        ) : status === 'refused' ? (
          <p className="text-sm text-center font-semibold py-1.5" style={{ color: 'var(--sat-faint)' }}>Invitation refusée</p>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setStatus('refused')}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-80"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}>
              Refuser
            </button>
            <button onClick={handleJoin} disabled={status === 'joining'}
              className="flex-1 py-1.5 rounded-xl text-xs font-bold transition hover:opacity-90 disabled:opacity-60"
              style={{ background: 'var(--sat-accent)', color: '#fff' }}>
              {status === 'joining' ? '...' : 'Rejoindre'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
