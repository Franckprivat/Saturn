'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { authClient } from '@/lib/auth-client';
import { Spinner } from '@/components/Spinner';

type Step =
  | 'loading'      // vérification session + aperçu
  | 'preview'      // communauté valide, bouton rejoindre / demander
  | 'joining'
  | 'requested'    // demande d'adhésion déposée
  | 'success'
  | 'invalid';     // lien mort (expiré / désactivé / épuisé / inconnu) ou banni

const STATE_MESSAGES: Record<string, string> = {
  expired: 'Ce lien d\'invitation a expiré.',
  disabled: 'Ce lien d\'invitation a été désactivé.',
  exhausted: 'Ce lien a atteint son nombre maximal d\'utilisations.',
  not_found: 'Ce lien d\'invitation n\'existe pas ou a été supprimé.',
};

export default function JoinCommunityPage() {
  const params = useParams();
  const router = useRouter();
  const token = params?.token as string;

  const [step, setStep] = useState<Step>('loading');
  const [preview, setPreview] = useState<any>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) return;
    authClient.getSession().then(async ({ data }) => {
      if (!data?.user) { router.push(`/login?redirect=/communities/join/${token}`); return; }
      try {
        const res = await api.get(`/community-invitations/link/${token}`);
        const p = res.data;
        setPreview(p);
        if (p.state === 'not_found' || p.banned) {
          setError(p.banned ? 'Tu as été banni de cette communauté.' : STATE_MESSAGES.not_found);
          setStep('invalid');
        } else if (p.alreadyMember) {
          router.push(`/communities/${p.community.id}`);
        } else if (p.state !== 'active') {
          setError(STATE_MESSAGES[p.state] ?? 'Lien invalide.');
          setStep('invalid');
        } else if (p.requestPending) {
          setStep('requested');
        } else {
          setStep('preview');
        }
      } catch {
        setError('Impossible de vérifier ce lien pour le moment.');
        setStep('invalid');
      }
    }).catch(() => {});
  }, [token, router]);

  const handleJoin = async () => {
    setStep('joining');
    try {
      const res = await api.post(`/community-invitations/link/${token}/join`, {
        message: message.trim() || undefined,
      });
      if (res.data.requested) {
        setStep('requested');
      } else {
        setStep('success');
        setTimeout(() => router.push(`/communities/${res.data.id}`), 1400);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Lien invalide ou expiré.');
      setStep('invalid');
    }
  };

  const community = preview?.community;
  const needsApproval = preview?.joinPolicy === 'APPROVAL';

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--sat-void)' }}>
      <div className="w-full max-w-sm mx-4">
        <div className="rounded-2xl overflow-hidden text-center"
          style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', boxShadow: '0 8px 32px rgba(37,99,235,0.08)' }}>

          {/* Bandeau communauté */}
          <div className="h-24 flex items-center justify-center relative"
            style={{ background: community?.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
            {community?.image && <img src={mediaUrl(community.image)} alt="" className="absolute inset-0 w-full h-full object-cover" />}
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.25)' }} />
            {community && (
              <span className="relative text-4xl font-black text-white drop-shadow">{community.name.charAt(0).toUpperCase()}</span>
            )}
          </div>

          <div className="p-7">
            {step === 'loading' && (
              <>
                <h1 className="text-lg font-bold mb-3" style={{ color: 'var(--sat-text)' }}>Vérification du lien…</h1>
                <div className="flex justify-center"><Spinner size={24} /></div>
              </>
            )}

            {(step === 'preview' || step === 'joining') && community && (
              <>
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--sat-faint)' }}>
                  Tu es invité à rejoindre
                </p>
                <h1 className="text-xl font-bold" style={{ color: 'var(--sat-text)' }}>{community.name}</h1>
                <p className="text-xs mt-1 mb-1" style={{ color: 'var(--sat-muted)' }}>
                  {community.memberCount} membre{community.memberCount > 1 ? 's' : ''}
                </p>
                {community.description && (
                  <p className="text-sm mt-2 mb-1" style={{ color: 'var(--sat-muted)' }}>{community.description}</p>
                )}

                {needsApproval && (
                  <div className="mt-4 text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: 'var(--sat-muted)' }}>
                      Message de présentation (optionnel)
                    </p>
                    <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={300}
                      placeholder="Présente-toi aux modérateurs…"
                      className="w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none resize-none"
                      style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                  </div>
                )}

                <button onClick={handleJoin} disabled={step === 'joining'}
                  className="w-full mt-5 py-3 rounded-xl font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                  {step === 'joining' ? 'Un instant…' : needsApproval ? 'Demander à rejoindre' : 'Rejoindre la communauté'}
                </button>
                {needsApproval && (
                  <p className="text-[10px] mt-2" style={{ color: 'var(--sat-faint)' }}>
                    Cette communauté valide les nouveaux membres : ta demande sera examinée par un modérateur.
                  </p>
                )}
              </>
            )}

            {step === 'requested' && (
              <>
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.12)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--sat-text)' }}>Demande envoyée</h1>
                <p className="text-sm mb-5" style={{ color: 'var(--sat-muted)' }}>
                  Les modérateurs de <strong>{community?.name}</strong> vont examiner ta demande. Tu recevras une notification.
                </p>
                <button onClick={() => router.push('/communities')} className="text-sm font-bold" style={{ color: 'var(--sat-accent)' }}>
                  Retour aux communautés →
                </button>
              </>
            )}

            {step === 'success' && (
              <>
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.12)' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth={2.5} strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <h1 className="text-lg font-bold mb-1" style={{ color: 'var(--sat-text)' }}>Bienvenue !</h1>
                <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>Tu as rejoint <strong>{community?.name}</strong>. Redirection…</p>
              </>
            )}

            {step === 'invalid' && (
              <>
                <div className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.1)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
                <h1 className="text-lg font-bold mb-1" style={{ color: '#EF4444' }}>Lien inutilisable</h1>
                <p className="text-sm mb-5" style={{ color: 'var(--sat-muted)' }}>{error}</p>
                <button onClick={() => router.push('/communities')} className="text-sm font-bold" style={{ color: 'var(--sat-accent)' }}>
                  Voir mes communautés →
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
