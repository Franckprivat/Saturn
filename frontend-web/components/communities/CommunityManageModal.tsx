'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Avatar } from '@/components/Avatar';
import { Spinner } from '@/components/Spinner';
import { toast } from '@/components/Toast';

interface CommunityManageModalProps {
  communityId: string;
  communityName: string;
  onClose: () => void;
}

type Tab = 'links' | 'invites' | 'requests' | 'bans' | 'audit' | 'permissions';

const TABS: { key: Tab; label: string }[] = [
  { key: 'links', label: 'Liens' },
  { key: 'invites', label: 'Invitations' },
  { key: 'requests', label: 'Demandes' },
  { key: 'bans', label: 'Bannis' },
  { key: 'audit', label: 'Journal' },
  { key: 'permissions', label: 'Permissions' },
];

const INVITE_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'En attente', color: '#F59E0B' },
  ACCEPTED: { label: 'Acceptée', color: '#10B981' },
  DECLINED: { label: 'Refusée', color: '#EF4444' },
  CANCELLED: { label: 'Annulée', color: 'var(--sat-faint)' },
  EXPIRED: { label: 'Expirée', color: 'var(--sat-faint)' },
};

const LINK_STATE_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: '#10B981' },
  expired: { label: 'Expiré', color: 'var(--sat-faint)' },
  disabled: { label: 'Désactivé', color: '#EF4444' },
  exhausted: { label: 'Épuisé', color: '#F59E0B' },
};

const AUDIT_LABELS: Record<string, string> = {
  invite_sent: 'a invité',
  invite_accepted: 'a accepté l\'invitation de',
  invite_declined: 'a refusé l\'invitation de',
  invite_cancelled: 'a annulé l\'invitation de',
  link_created: 'a créé un lien d\'invitation',
  link_disabled: 'a désactivé un lien',
  link_enabled: 'a réactivé un lien',
  link_regenerated: 'a régénéré un lien',
  link_deleted: 'a supprimé un lien',
  joined_via_link: 'a rejoint via un lien',
  join_requested: 'a demandé à rejoindre',
  request_approved: 'a approuvé la demande de',
  request_rejected: 'a refusé la demande de',
  member_banned: 'a banni',
  member_unbanned: 'a débanni',
  settings_updated: 'a modifié les réglages d\'invitation',
};

const PERMISSION_LABELS: Record<string, string> = {
  invite: 'Inviter des membres',
  createLink: 'Créer des liens d\'invitation',
  manageLinks: 'Gérer / supprimer les liens',
  approveRequests: 'Approuver les demandes d\'adhésion',
  kick: 'Exclure des membres',
  ban: 'Bannir des membres',
  promote: 'Promouvoir / rétrograder',
};

const ROLE_OPTIONS = [
  { value: 'MEMBER', label: 'Membre et +' },
  { value: 'MODERATOR', label: 'Modérateur et +' },
  { value: 'ADMIN', label: 'Admin uniquement' },
] as const;

function fmtDate(d: string) {
  return new Date(d).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function dn(u: any) {
  return u?.nickname?.trim() || u?.email?.split('@')[0] || 'Inconnu';
}

/**
 * Tableau de bord d'administration des invitations :
 * liens (état, usages, membres recrutés), invitations envoyées,
 * demandes d'adhésion, bannis, journal d'audit et permissions par rôle.
 */
export function CommunityManageModal({ communityId, communityName, onClose }: CommunityManageModalProps) {
  const [tab, setTab] = useState<Tab>('links');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [expandedLink, setExpandedLink] = useState<string | null>(null);

  const load = useCallback(async (which: Tab) => {
    setLoading(true);
    try {
      const url = {
        links: `/communities/${communityId}/invite-links`,
        invites: `/communities/${communityId}/invitations`,
        requests: `/communities/${communityId}/join-requests`,
        bans: `/communities/${communityId}/bans`,
        audit: `/communities/${communityId}/audit-log`,
        permissions: `/communities/${communityId}/invite-settings`,
      }[which];
      const res = await api.get(url);
      setData(res.data);
    } catch (e: any) {
      setData(null);
      toast(e?.response?.data?.message || 'Accès refusé', 'error');
    } finally {
      setLoading(false);
    }
  }, [communityId]);

  useEffect(() => { load(tab); }, [tab, load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const linkAction = async (linkId: string, action: 'disable' | 'enable' | 'regenerate' | 'delete') => {
    try {
      if (action === 'delete') {
        if (!window.confirm('Supprimer définitivement ce lien ?')) return;
        await api.delete(`/communities/${communityId}/invite-links/${linkId}`);
      } else {
        await api.patch(`/communities/${communityId}/invite-links/${linkId}`, { action });
      }
      load('links');
    } catch (e: any) { toast(e?.response?.data?.message || 'Action refusée', 'error'); }
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      await api.delete(`/communities/${communityId}/invitations/${inviteId}`);
      load('invites');
    } catch (e: any) { toast(e?.response?.data?.message || 'Action refusée', 'error'); }
  };

  const respondRequest = async (requestId: string, approve: boolean) => {
    try {
      await api.post(`/communities/${communityId}/join-requests/${requestId}/${approve ? 'approve' : 'reject'}`);
      load('requests');
    } catch (e: any) { toast(e?.response?.data?.message || 'Action refusée', 'error'); }
  };

  const unban = async (userId: string) => {
    try {
      await api.delete(`/communities/${communityId}/bans/${userId}`);
      load('bans');
    } catch (e: any) { toast(e?.response?.data?.message || 'Action refusée', 'error'); }
  };

  const setPermission = async (action: string, role: string) => {
    try {
      const res = await api.patch(`/communities/${communityId}/invite-settings`, {
        permissions: { [action]: role },
      });
      setData(res.data);
    } catch (e: any) { toast(e?.response?.data?.message || 'Réservé aux administrateurs', 'error'); }
  };

  const setJoinPolicy = async (joinPolicy: 'OPEN' | 'APPROVAL') => {
    try {
      const res = await api.patch(`/communities/${communityId}/invite-settings`, { joinPolicy });
      setData(res.data);
    } catch (e: any) { toast(e?.response?.data?.message || 'Réservé aux administrateurs', 'error'); }
  };

  const copyLink = async (token: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/communities/join/${token}`);
    toast('Lien copié', 'success');
  };

  const Chip = ({ label, color }: { label: string; color: string }) => (
    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0"
      style={{ background: 'var(--sat-hover)', color }}>{label}</span>
  );

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(5px)' }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', height: 'min(640px, 90vh)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--sat-text)' }}>Gestion des invitations</h2>
              <p className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>{communityName}</p>
            </div>
            <button onClick={onClose} aria-label="Fermer"
              className="w-7 h-7 rounded-lg flex items-center justify-center transition"
              style={{ color: 'var(--sat-faint)', background: 'var(--sat-hover)' }}>✕</button>
          </div>
          <div className="flex gap-0.5 overflow-x-auto">
            {TABS.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)}
                className="px-3.5 py-2.5 text-[13px] font-semibold transition whitespace-nowrap"
                style={{
                  color: tab === key ? 'var(--sat-accent)' : 'var(--sat-muted)',
                  borderBottom: tab === key ? '2px solid var(--sat-accent)' : '2px solid transparent',
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size={24} /></div>
          ) : !data ? (
            <p className="text-sm text-center py-16" style={{ color: 'var(--sat-muted)' }}>
              Tu n'as pas la permission de consulter cette section.
            </p>
          ) : (
            <>
              {/* ── Liens ── */}
              {tab === 'links' && (
                <div className="space-y-2">
                  {data.length === 0 && (
                    <p className="text-sm text-center py-12" style={{ color: 'var(--sat-muted)' }}>
                      Aucun lien d'invitation. Crée-en un depuis « Inviter des gens ».
                    </p>
                  )}
                  {data.map((l: any) => {
                    const state = LINK_STATE_LABELS[l.state] ?? LINK_STATE_LABELS.active;
                    return (
                      <div key={l.id} className="rounded-xl p-3"
                        style={{ background: 'var(--sat-hover)', border: '1px solid var(--sat-border)' }}>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold truncate" style={{ color: 'var(--sat-text)' }}>{l.token}</span>
                              <Chip label={state.label} color={state.color} />
                            </div>
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--sat-muted)' }}>
                              Par {dn(l.creator)} · {fmtDate(l.createdAt)}
                              {l.expiresAt ? ` · expire ${fmtDate(l.expiresAt)}` : ' · sans expiration'}
                            </p>
                            <p className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>
                              <button className="underline" onClick={() => setExpandedLink(expandedLink === l.id ? null : l.id)}>
                                {l.uses}{l.maxUses ? `/${l.maxUses}` : ''} utilisation{l.uses > 1 ? 's' : ''} — voir les membres
                              </button>
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <button onClick={() => copyLink(l.token)}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-bold transition"
                              style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--sat-accent)' }}>Copier</button>
                            <div className="flex gap-1">
                              {l.state === 'disabled' ? (
                                <button onClick={() => linkAction(l.id, 'enable')}
                                  className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--sat-surface)', color: '#10B981' }}>Activer</button>
                              ) : (
                                <button onClick={() => linkAction(l.id, 'disable')}
                                  className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--sat-surface)', color: '#F59E0B' }}>Désactiver</button>
                              )}
                              <button onClick={() => linkAction(l.id, 'regenerate')} title="Nouveau token, mêmes réglages"
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--sat-surface)', color: 'var(--sat-muted)' }}>Régénérer</button>
                              <button onClick={() => linkAction(l.id, 'delete')}
                                className="px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'var(--sat-surface)', color: '#EF4444' }}>Suppr.</button>
                            </div>
                          </div>
                        </div>
                        {expandedLink === l.id && (
                          <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid var(--sat-border)' }}>
                            {l.joins.length === 0 && <p className="text-[11px]" style={{ color: 'var(--sat-faint)' }}>Personne n'a encore rejoint via ce lien.</p>}
                            {l.joins.map((j: any) => (
                              <div key={j.id} className="flex items-center gap-2">
                                <Avatar user={j.user} size="xs" />
                                <span className="text-xs font-semibold" style={{ color: 'var(--sat-text)' }}>{dn(j.user)}</span>
                                <span className="text-[10px] ml-auto" style={{ color: 'var(--sat-faint)' }}>{fmtDate(j.joinedAt)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Invitations ── */}
              {tab === 'invites' && (
                <div className="space-y-1.5">
                  {data.length === 0 && (
                    <p className="text-sm text-center py-12" style={{ color: 'var(--sat-muted)' }}>Aucune invitation envoyée.</p>
                  )}
                  {data.map((i: any) => {
                    const st = INVITE_STATUS_LABELS[i.status] ?? INVITE_STATUS_LABELS.PENDING;
                    return (
                      <div key={i.id} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                        style={{ background: 'var(--sat-hover)' }}>
                        <Avatar user={i.invitee} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{dn(i.invitee)}</p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>
                            Invité par {dn(i.inviter)} · {fmtDate(i.createdAt)}
                          </p>
                        </div>
                        <Chip label={st.label} color={st.color} />
                        {i.status === 'PENDING' && (
                          <button onClick={() => cancelInvite(i.id)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex-shrink-0 transition"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>Annuler</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Demandes d'adhésion ── */}
              {tab === 'requests' && (
                <div className="space-y-2">
                  {data.length === 0 && (
                    <p className="text-sm text-center py-12" style={{ color: 'var(--sat-muted)' }}>
                      Aucune demande en attente.<br />
                      <span className="text-xs">Les demandes apparaissent quand la politique d'adhésion est « sur approbation ».</span>
                    </p>
                  )}
                  {data.map((r: any) => (
                    <div key={r.id} className="rounded-xl p-3" style={{ background: 'var(--sat-hover)', border: '1px solid var(--sat-border)' }}>
                      <div className="flex items-center gap-3">
                        <Avatar user={r.user} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate" style={{ color: 'var(--sat-text)' }}>{dn(r.user)}</p>
                          <p className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>
                            Compte créé le {new Date(r.user.createdAt).toLocaleDateString('fr-FR')}
                            {r.mutualFriendsCount > 0 && (
                              <> · <strong style={{ color: 'var(--sat-accent)' }}>{r.mutualFriendsCount} ami{r.mutualFriendsCount > 1 ? 's' : ''} en commun</strong>
                                {r.mutualFriends.length > 0 && ` (${r.mutualFriends.map(dn).join(', ')})`}</>
                            )}
                          </p>
                          {r.user.bio && <p className="text-[11px] truncate" style={{ color: 'var(--sat-faint)' }}>{r.user.bio}</p>}
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => respondRequest(r.id, true)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white transition hover:opacity-90"
                            style={{ background: '#10B981' }}>Accepter</button>
                          <button onClick={() => respondRequest(r.id, false)}
                            className="px-3 py-1.5 rounded-lg text-xs font-bold transition"
                            style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>Refuser</button>
                        </div>
                      </div>
                      {r.message && (
                        <p className="mt-2 px-3 py-2 rounded-lg text-xs italic"
                          style={{ background: 'var(--sat-surface)', color: 'var(--sat-text)' }}>
                          « {r.message} »
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ── Bannis ── */}
              {tab === 'bans' && (
                <div className="space-y-1.5">
                  {data.length === 0 && (
                    <p className="text-sm text-center py-12" style={{ color: 'var(--sat-muted)' }}>Aucun membre banni.</p>
                  )}
                  {data.map((b: any) => (
                    <div key={b.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--sat-hover)' }}>
                      <Avatar user={b.user} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{dn(b.user)}</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>
                          {fmtDate(b.createdAt)}{b.reason ? ` · ${b.reason}` : ''}
                        </p>
                      </div>
                      <button onClick={() => unban(b.user.id)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex-shrink-0"
                        style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>Débannir</button>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Journal ── */}
              {tab === 'audit' && (
                <div className="space-y-1">
                  {data.length === 0 && (
                    <p className="text-sm text-center py-12" style={{ color: 'var(--sat-muted)' }}>Journal vide.</p>
                  )}
                  {data.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg" style={{ background: 'var(--sat-hover)' }}>
                      <Avatar user={e.actor ?? {}} size="xs" />
                      <p className="flex-1 text-xs min-w-0" style={{ color: 'var(--sat-text)' }}>
                        <strong>{dn(e.actor)}</strong>{' '}
                        {AUDIT_LABELS[e.action] ?? e.action}
                        {e.target && <> <strong>{dn(e.target)}</strong></>}
                      </p>
                      <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>{fmtDate(e.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Permissions ── */}
              {tab === 'permissions' && (
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--sat-muted)' }}>
                      Politique d'adhésion via lien
                    </p>
                    <div className="flex gap-2">
                      {([['OPEN', 'Entrée directe', 'Un lien valide suffit pour rejoindre'], ['APPROVAL', 'Sur approbation', 'Le lien crée une demande à valider']] as const).map(([value, label, hint]) => (
                        <button key={value} onClick={() => setJoinPolicy(value)}
                          className="flex-1 p-3 rounded-xl text-left transition"
                          style={{
                            background: data.joinPolicy === value ? 'rgba(37,99,235,0.08)' : 'var(--sat-hover)',
                            border: `1.5px solid ${data.joinPolicy === value ? 'var(--sat-accent)' : 'transparent'}`,
                          }}>
                          <p className="text-sm font-bold" style={{ color: data.joinPolicy === value ? 'var(--sat-accent)' : 'var(--sat-text)' }}>{label}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--sat-muted)' }}>{hint}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--sat-muted)' }}>
                      Rôle minimal par action
                    </p>
                    <div className="space-y-1.5">
                      {Object.entries(PERMISSION_LABELS).map(([action, label]) => (
                        <div key={action} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: 'var(--sat-hover)' }}>
                          <span className="flex-1 text-sm" style={{ color: 'var(--sat-text)' }}>{label}</span>
                          <select
                            value={data.permissions[action]}
                            onChange={(e) => setPermission(action, e.target.value)}
                            className="text-xs font-semibold rounded-lg px-2 py-1.5 focus:outline-none"
                            style={{ background: 'var(--sat-surface)', color: 'var(--sat-accent)', border: '1px solid var(--sat-border-2)' }}>
                            {ROLE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] mt-2" style={{ color: 'var(--sat-faint)' }}>
                      Le propriétaire dispose toujours de toutes les permissions.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
