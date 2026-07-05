'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { mediaUrl } from '@/lib/media';
import { authClient } from '@/lib/auth-client';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import {
  useCommunityStore, canManage, canAdmin, ROLE_LABELS, ROLE_COLORS,
  type CommunityDetail, type Channel, type CommunityRole,
} from '@/store/communityStore';
import { Avatar } from '@/components/Avatar';
import { Spinner, PageLoader } from '@/components/Spinner';
import { ToastHost, toast } from '@/components/Toast';
import { ChannelChat } from '@/components/communities/ChannelChat';
import { CreateCommunityModal } from '@/components/communities/CreateCommunityModal';
import { InvitePeopleModal } from '@/components/communities/InvitePeopleModal';
import { CommunityManageModal } from '@/components/communities/CommunityManageModal';
import { MicIcon, MicOffIcon, PhoneOffIcon, SpeakerIcon } from '@/components/Icons';

function dn(u: { nickname?: string | null; email?: string | null } | null | undefined) {
  if (!u) return 'Inconnu';
  return u.nickname?.trim() || u.email?.split('@')[0] || 'Inconnu';
}
const RANK: Record<CommunityRole, number> = { OWNER: 3, ADMIN: 2, MODERATOR: 1, MEMBER: 0 };

export default function CommunityPage() {
  const params = useParams();
  const router = useRouter();
  const communityId = params?.id as string;
  const socket = useChatSocket();
  const { communities, setCommunities } = useCommunityStore();

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [detail, setDetail] = useState<CommunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const [voiceUsers, setVoiceUsers] = useState<Record<string, string[]>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [addChannel, setAddChannel] = useState<null | { categoryId: string | null }>(null);
  const [memberMenu, setMemberMenu] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);

  const voice = useVoiceChannel(socket);

  // ── Chargement ──
  useEffect(() => {
    authClient.getSession().then(({ data }) => { if (data?.user) setCurrentUser(data.user); }).catch(() => {});
    api.get('/communities').then((r) => setCommunities(r.data)).catch(() => {});
    api.get('/friends').then((r) => setFriends(r.data)).catch(() => {});
  }, []);

  const loadDetail = useCallback(async () => {
    try {
      const res = await api.get(`/communities/${communityId}`);
      setDetail(res.data);
      return res.data as CommunityDetail;
    } catch { router.push('/communities'); return null; }
  }, [communityId, router]);

  useEffect(() => {
    setLoading(true);
    loadDetail().then((d) => {
      if (d) {
        const firstText = [...d.categories.flatMap((c) => c.channels), ...d.channels].find((ch) => ch.type === 'TEXT');
        setCurrentChannel(firstText ?? null);
      }
      setLoading(false);
    });
  }, [communityId]);

  // ── Socket : présence de la communauté + état vocal ──
  // (messages, réactions et éditions sont gérés par le pont global dans AppShell)
  useEffect(() => {
    if (!socket || !communityId) return;
    const onVoiceState = ({ channelId, users }: any) => setVoiceUsers((prev) => ({ ...prev, [channelId]: users }));
    socket.on('voice_state', onVoiceState);

    // Rejoindre la room de la communauté et récupérer l'occupation vocale actuelle
    const joinCommunity = () => {
      socket.emit('join_community', { communityId }, (res: any) => {
        if (res?.voiceStates) setVoiceUsers((prev) => ({ ...prev, ...res.voiceStates }));
      });
    };
    joinCommunity();
    socket.on('connect', joinCommunity); // re-join après reconnexion

    return () => {
      socket.off('voice_state', onVoiceState);
      socket.off('connect', joinCommunity);
    };
  }, [socket, communityId]);

  const myRole = detail?.myRole ?? 'MEMBER';
  const userById = useMemo(() => {
    const m: Record<string, any> = {};
    detail?.members.forEach((mem) => { m[mem.user.id] = mem.user; });
    return m;
  }, [detail]);

  // ── Actions ──
  const selectChannel = (ch: Channel) => {
    if (ch.type === 'VOICE') {
      voice.join(ch.id);
      setCurrentChannel(ch);
    } else {
      setCurrentChannel(ch);
    }
  };

  const openInvite = () => { setSettingsOpen(false); setShowInvite(true); };

  const renameCommunity = async () => {
    const name = window.prompt('Nouveau nom de la communauté', detail?.name);
    if (!name?.trim()) return;
    await api.patch(`/communities/${communityId}`, { name: name.trim() }).then(loadDetail).catch(() => {});
    setSettingsOpen(false);
  };

  const leaveCommunity = async () => {
    await api.post(`/communities/${communityId}/leave`).catch(() => {});
    router.push('/communities');
  };

  const deleteCommunity = async () => {
    await api.delete(`/communities/${communityId}`).catch(() => {});
    router.push('/communities');
  };

  const createChannel = async (name: string, type: 'TEXT' | 'VOICE', categoryId: string | null) => {
    if (!name.trim()) return;
    await api.post(`/communities/${communityId}/channels`, { name: name.trim(), type, categoryId: categoryId ?? undefined })
      .then((r) => setDetail(r.data)).catch(() => toast('Erreur', 'error'));
    setAddChannel(null);
  };

  const addCategory = async () => {
    const name = window.prompt('Nom de la catégorie');
    if (!name?.trim()) return;
    await api.post(`/communities/${communityId}/categories`, { name: name.trim() }).then((r) => setDetail(r.data)).catch(() => {});
  };

  const deleteChannel = async (ch: Channel) => {
    if (!confirm(`Supprimer le salon « ${ch.name} » ?`)) return;
    await api.delete(`/communities/${communityId}/channels/${ch.id}`).then((r) => setDetail(r.data)).catch(() => {});
  };

  const setMemberRole = async (userId: string, role: CommunityRole) => {
    await api.patch(`/communities/${communityId}/members/${userId}/role`, { role }).then((r) => setDetail(r.data)).catch(() => toast('Action refusée', 'error'));
    setMemberMenu(null);
  };
  const kickMember = async (userId: string) => {
    if (!confirm('Exclure ce membre ? Il pourra revenir via une invitation.')) return;
    await api.delete(`/communities/${communityId}/members/${userId}`).then(loadDetail).catch(() => toast('Action refusée', 'error'));
    setMemberMenu(null);
  };

  const banMember = async (userId: string) => {
    const reason = window.prompt('Bannir ce membre ? Il ne pourra plus rejoindre, même avec un lien.\nRaison (optionnelle) :');
    if (reason === null) return;
    await api.post(`/communities/${communityId}/bans`, { userId, reason: reason || undefined })
      .then(loadDetail).catch(() => toast('Action refusée', 'error'));
    setMemberMenu(null);
  };

  const handleAddMember = async (userId: string) => {
    try {
      const res = await api.post(`/communities/${communityId}/members`, { userId });
      setDetail(res.data);
      toast('Membre ajouté !', 'success');
    } catch { toast('Impossible d\'ajouter ce membre', 'error'); }
    setShowAddMember(false);
  };

  if (loading) return <PageLoader label="Chargement de la communauté..." />;
  if (!detail) return null;

  const orphanChannels = detail.channels;
  const membersByRole = (['OWNER', 'ADMIN', 'MODERATOR', 'MEMBER'] as CommunityRole[])
    .map((role) => ({ role, list: detail.members.filter((m) => m.role === role) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="flex flex-1 overflow-hidden" style={{ color: 'var(--sat-text)' }}>

      {/* ── Rail serveurs ── */}
      <div className="flex flex-col items-center py-3 gap-2 flex-shrink-0 overflow-y-auto scrollbar-none"
        style={{ width: 64, background: 'var(--sat-void)', borderRight: '1px solid var(--sat-border)' }}>
        {communities.map((c) => {
          const active = c.id === communityId;
          return (
            <button key={c.id} onClick={() => router.push(`/communities/${c.id}`)} title={c.name}
              className="relative w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-bold overflow-hidden transition-all text-white flex-shrink-0"
              style={{ background: c.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))', borderRadius: active ? '32%' : '50%', boxShadow: active ? '0 0 0 2px var(--sat-accent)' : 'none' }}>
              {c.image ? <img src={mediaUrl(c.image)} className="w-full h-full object-cover" alt="" /> : c.name.charAt(0).toUpperCase()}
            </button>
          );
        })}
        <button onClick={() => setShowCreate(true)} title="Ajouter une communauté"
          className="w-11 h-11 rounded-full flex items-center justify-center text-xl flex-shrink-0 transition"
          style={{ background: 'var(--sat-hover)', color: 'var(--sat-accent)' }}>+</button>
      </div>

      {/* ── Sidebar salons ── */}
      <div className="flex flex-col flex-shrink-0" style={{ width: 240, background: 'var(--sat-panel)', borderRight: '1px solid var(--sat-border)' }}>
        {/* Header communauté */}
        <div className="relative">
          <button onClick={() => setSettingsOpen((v) => !v)}
            className="w-full h-12 px-4 flex items-center justify-between transition"
            style={{ borderBottom: '1px solid var(--sat-border)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
            <span className="font-bold text-[15px] truncate" style={{ color: 'var(--sat-text)' }}>{detail.name}</span>
            <span className="text-xs" style={{ color: 'var(--sat-muted)' }}>{settingsOpen ? '▲' : '▼'}</span>
          </button>
          {settingsOpen && (
            <div className="absolute top-12 left-2 right-2 z-30 rounded-xl py-1.5 shadow-xl"
              style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
              <button onClick={openInvite} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition hover:bg-[var(--sat-hover)]" style={{ color: 'var(--sat-accent)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Inviter des gens
              </button>
              {canManage(myRole) && (
                <button onClick={() => { setSettingsOpen(false); setShowManage(true); }}
                  className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition"
                  style={{ color: 'var(--sat-text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  Gestion des invitations
                </button>
              )}
              <button onClick={() => { setSettingsOpen(false); setShowSettings(true); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition"
                style={{ color: 'var(--sat-text)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                Paramètres
              </button>
            </div>
          )}
        </div>

        {/* Liste salons */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-3">
          {detail.categories.map((cat) => (
            <div key={cat.id}>
              <div className="flex items-center justify-between px-2 mb-1 group">
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sat-muted)' }}>{cat.name}</span>
                {canManage(myRole) && (
                  <button onClick={() => setAddChannel({ categoryId: cat.id })} title="Ajouter un salon"
                    className="text-sm opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--sat-muted)' }}>+</button>
                )}
              </div>
              {cat.channels.map((ch) => (
                <ChannelRow key={ch.id} ch={ch} active={currentChannel?.id === ch.id}
                  voiceUsers={voiceUsers[ch.id] ?? []} userById={userById}
                  canManage={canManage(myRole)} onSelect={() => selectChannel(ch)} onDelete={() => deleteChannel(ch)} />
              ))}
            </div>
          ))}

          {orphanChannels.length > 0 && (
            <div>
              {orphanChannels.map((ch) => (
                <ChannelRow key={ch.id} ch={ch} active={currentChannel?.id === ch.id}
                  voiceUsers={voiceUsers[ch.id] ?? []} userById={userById}
                  canManage={canManage(myRole)} onSelect={() => selectChannel(ch)} onDelete={() => deleteChannel(ch)} />
              ))}
            </div>
          )}

          {canAdmin(myRole) && (
            <button onClick={addCategory} className="w-full text-left px-2 py-1 text-[11px] font-bold uppercase tracking-wider transition hover:opacity-80" style={{ color: 'var(--sat-faint)' }}>
              + Catégorie
            </button>
          )}
        </div>

        {/* Barre vocale (si connecté) */}
        {voice.activeChannelId && (
          <div className="px-3 py-2.5 flex items-center gap-2" style={{ borderTop: '1px solid var(--sat-border)', background: 'var(--sat-surface)' }}>
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform" style={{ background: 'var(--sat-online)', transform: voice.selfSpeaking ? 'scale(1.4)' : 'scale(1)', boxShadow: voice.selfSpeaking ? '0 0 0 3px rgba(34,197,94,0.3)' : 'none' }} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold" style={{ color: 'var(--sat-online)' }}>{voice.selfSpeaking ? 'Tu parles…' : 'Vocal connecté'}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--sat-muted)' }}>
                {[...detail.categories.flatMap((c) => c.channels), ...detail.channels].find((c) => c.id === voice.activeChannelId)?.name}
              </p>
            </div>
            <button onClick={voice.toggleMute} title={voice.selfMuted ? 'Activer le micro' : 'Couper le micro'}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
              style={{ background: voice.selfMuted ? 'rgba(239,68,68,0.12)' : 'var(--sat-hover)', color: voice.selfMuted ? '#EF4444' : 'var(--sat-text)' }}>
              {voice.selfMuted ? <MicOffIcon size={16} /> : <MicIcon size={16} />}
            </button>
            <button onClick={voice.toggleDeafen} title={voice.deafened ? 'Réactiver le son' : 'Se rendre sourd'}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition"
              style={{ background: voice.deafened ? 'rgba(239,68,68,0.12)' : 'var(--sat-hover)', color: voice.deafened ? '#EF4444' : 'var(--sat-text)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 14v-2a9 9 0 0 1 18 0v2" />
                <path d="M21 16a2 2 0 0 1-2 2h-1v-6h1a2 2 0 0 1 2 2zM3 16a2 2 0 0 0 2 2h1v-6H5a2 2 0 0 0-2 2z" />
                {voice.deafened && <line x1="2" y1="2" x2="22" y2="22" />}
              </svg>
            </button>
            <button onClick={voice.leave} title="Se déconnecter"
              className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              <PhoneOffIcon size={16} />
            </button>
          </div>
        )}
      </div>

      {/* ── Zone principale ── */}
      {currentChannel?.type === 'VOICE' ? (
        <VoiceStage channel={currentChannel} voice={voice} userById={userById} currentUserId={currentUser?.id} />
      ) : currentChannel?.conversationId ? (
        <ChannelChat conversationId={currentChannel.conversationId} channelName={currentChannel.name} socket={socket} currentUser={currentUser} />
      ) : (
        <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--sat-main)' }}>
          <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>Sélectionne un salon pour commencer</p>
        </div>
      )}

      {/* Toggle membres */}
      <button onClick={() => setShowMembers((v) => !v)} title="Membres"
        className="absolute top-3 right-3 z-20 w-9 h-9 rounded-lg flex items-center justify-center transition"
        style={{ background: showMembers ? 'var(--sat-active)' : 'var(--sat-hover)', color: 'var(--sat-text)' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
      </button>

      {/* ── Membres ── */}
      {showMembers && (
        <div className="flex flex-col flex-shrink-0 overflow-y-auto" style={{ width: 220, background: 'var(--sat-panel)', borderLeft: '1px solid var(--sat-border)' }}>
          <div className="h-12 px-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--sat-muted)' }}>Membres — {detail.members.length}</span>
            {canAdmin(myRole) && (
              <button onClick={() => setShowAddMember(true)} title="Ajouter un membre"
                className="w-6 h-6 rounded flex items-center justify-center transition font-bold text-sm"
                style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'var(--sat-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sat-muted)'; e.currentTarget.style.background = 'var(--sat-hover)'; }}>
                +
              </button>
            )}
          </div>
          <div className="flex-1 px-2 py-3 space-y-4">
            {membersByRole.map(({ role, list }) => (
              <div key={role}>
                <p className="px-2 mb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: ROLE_COLORS[role] }}>
                  {ROLE_LABELS[role]} — {list.length}
                </p>
                {list.map((mem) => {
                  const canActOn = canManage(myRole) && RANK[myRole] > RANK[mem.role] && mem.user.id !== currentUser?.id;
                  return (
                    <div key={mem.id} className="relative">
                      <button onClick={() => canActOn && setMemberMenu(memberMenu === mem.user.id ? null : mem.user.id)}
                        className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition text-left"
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                        <Avatar user={mem.user} size="xs" className="w-8 h-8" />
                        <span className="flex-1 text-sm font-medium truncate" style={{ color: ROLE_COLORS[mem.role] }}>{dn(mem.user)}</span>
                        {mem.role === 'OWNER' && <span title="Propriétaire">👑</span>}
                      </button>
                      {memberMenu === mem.user.id && canActOn && (
                        <div className="absolute right-2 top-10 z-30 rounded-xl py-1.5 shadow-xl w-44" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                          {canAdmin(myRole) && (['ADMIN', 'MODERATOR', 'MEMBER'] as CommunityRole[]).map((r) => (
                            <button key={r} onClick={() => setMemberRole(mem.user.id, r)}
                              className="w-full text-left px-3 py-1.5 text-sm transition hover:bg-[var(--sat-hover)]"
                              style={{ color: mem.role === r ? 'var(--sat-accent)' : 'var(--sat-text)' }}>
                              {mem.role === r ? '✓ ' : ''}{ROLE_LABELS[r]}
                            </button>
                          ))}
                          <div className="h-px my-1" style={{ background: 'var(--sat-border)' }} />
                          <button onClick={() => kickMember(mem.user.id)} className="w-full text-left px-3 py-1.5 text-sm transition hover:bg-[var(--sat-hover)]" style={{ color: '#EF4444' }}>
                            Exclure
                          </button>
                          {canAdmin(myRole) && (
                            <button onClick={() => banMember(mem.user.id)} className="w-full text-left px-3 py-1.5 text-sm transition hover:bg-[var(--sat-hover)]" style={{ color: '#EF4444' }}>
                              Bannir
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modale ajout salon */}
      {addChannel && (
        <AddChannelModal categoryId={addChannel.categoryId} onClose={() => setAddChannel(null)} onCreate={createChannel} />
      )}
      {showCreate && (
        <CreateCommunityModal onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); router.push(`/communities/${id}`); }} />
      )}
      {showAddMember && (
        <AddMemberModal
          friends={friends}
          existingIds={detail.members.map((m) => m.user.id)}
          onClose={() => setShowAddMember(false)}
          onAdd={handleAddMember}
        />
      )}
      {showInvite && (
        <InvitePeopleModal
          communityId={communityId}
          communityName={detail.name}
          friends={friends}
          existingIds={detail.members.map((m) => m.user.id)}
          onClose={() => setShowInvite(false)}
        />
      )}
      {showManage && (
        <CommunityManageModal
          communityId={communityId}
          communityName={detail.name}
          onClose={() => { setShowManage(false); loadDetail(); }}
        />
      )}
      {showSettings && (
        <CommunitySettingsModal
          detail={detail}
          myRole={myRole}
          communityId={communityId}
          onClose={() => setShowSettings(false)}
          onUpdated={loadDetail}
          onLeave={leaveCommunity}
          onDelete={deleteCommunity}
        />
      )}
      <ToastHost />
    </div>
  );
}

// ── Ligne de salon ──
function ChannelRow({ ch, active, voiceUsers, userById, canManage, onSelect, onDelete }: {
  ch: Channel; active: boolean; voiceUsers: string[]; userById: Record<string, any>;
  canManage: boolean; onSelect: () => void; onDelete: () => void;
}) {
  return (
    <div>
      <div className="group flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition cursor-pointer"
        onClick={onSelect}
        style={{ background: active ? 'var(--sat-active)' : 'transparent', color: active ? 'var(--sat-text)' : 'var(--sat-muted)' }}
        onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'var(--sat-hover)'; }}
        onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
        <span className="text-base flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>
          {ch.type === 'VOICE'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
            : '#'}
        </span>
        <span className="flex-1 text-sm font-medium truncate">{ch.name}</span>
        {canManage && (
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-xs opacity-0 group-hover:opacity-100 transition" style={{ color: 'var(--sat-faint)' }}>✕</button>
        )}
      </div>
      {/* Présence vocale */}
      {ch.type === 'VOICE' && voiceUsers.length > 0 && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {voiceUsers.map((uid) => {
            const u = userById[uid];
            return (
              <div key={uid} className="flex items-center gap-2 px-1 py-0.5">
                <Avatar user={u || { id: uid }} size="xs" className="w-5 h-5" />
                <span className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>{dn(u)}</span>
                <span style={{ color: 'var(--sat-online)' }}><SpeakerIcon size={11} /></span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Stage vocal ──
function VoiceStage({ channel, voice, userById, currentUserId }: {
  channel: Channel; voice: ReturnType<typeof useVoiceChannel>; userById: Record<string, any>; currentUserId?: string;
}) {
  const connected = voice.activeChannelId === channel.id;
  const peerList = Object.values(voice.peers);
  const tiles = [
    ...(connected ? [{ userId: currentUserId || 'me', muted: voice.selfMuted, speaking: voice.selfSpeaking, self: true }] : []),
    ...peerList.map((p) => ({ userId: p.userId, muted: p.muted, speaking: p.speaking, self: false })),
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--sat-main)' }}>
      <div className="h-12 px-4 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--sat-faint)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" /></svg>
        <span className="font-bold text-[15px]" style={{ color: 'var(--sat-text)' }}>{channel.name}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8" style={{ background: 'var(--sat-void)' }}>
        {!connected ? (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--sat-surface)', color: 'var(--sat-muted)' }}><SpeakerIcon size={34} /></div>
            <p className="font-bold text-lg" style={{ color: 'var(--sat-text)' }}>Salon vocal — {channel.name}</p>
            <p className="text-sm mt-1 mb-5" style={{ color: 'var(--sat-muted)' }}>Rejoins le salon pour discuter en vocal.</p>
            <button onClick={() => voice.join(channel.id)} disabled={voice.connecting}
              className="px-6 py-3 rounded-xl font-bold text-white transition hover:opacity-90 inline-flex items-center gap-2"
              style={{ background: 'var(--sat-online)' }}>
              {voice.connecting ? 'Connexion...' : <><MicIcon size={18} /> Rejoindre le vocal</>}
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-5 justify-center">
              {tiles.map((t) => {
                const u = t.self ? { id: currentUserId } : userById[t.userId];
                return (
                  <div key={t.userId} className="flex flex-col items-center gap-2">
                    <div className="relative w-24 h-24 rounded-2xl flex items-center justify-center transition-all duration-150"
                      style={{
                        background: 'var(--sat-surface)',
                        border: `3px solid ${t.speaking ? 'var(--sat-online)' : 'transparent'}`,
                        boxShadow: t.speaking ? '0 0 0 3px rgba(34,197,94,0.25)' : 'none',
                      }}>
                      <Avatar user={u || { id: t.userId }} size="lg" className="w-16 h-16" />
                      {t.muted && <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full flex items-center justify-center text-white" style={{ background: '#EF4444' }}><MicOffIcon size={13} /></span>}
                    </div>
                    <span className="text-sm font-medium" style={{ color: 'var(--sat-text)' }}>
                      {t.self ? 'Toi' : dn(u)}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button onClick={voice.toggleMute}
                className="w-14 h-14 rounded-full flex items-center justify-center transition"
                style={{ background: voice.selfMuted ? '#EF4444' : 'var(--sat-surface)', color: voice.selfMuted ? '#fff' : 'var(--sat-text)' }}>
                {voice.selfMuted ? <MicOffIcon size={22} /> : <MicIcon size={22} />}
              </button>
              <button onClick={voice.leave} className="w-14 h-14 rounded-full flex items-center justify-center text-white" style={{ background: '#EF4444' }}><PhoneOffIcon size={24} /></button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Modale paramètres communauté ──
function CommunitySettingsModal({ detail, myRole, communityId, onClose, onUpdated, onLeave, onDelete }: {
  detail: CommunityDetail; myRole: CommunityRole; communityId: string;
  onClose: () => void; onUpdated: () => void; onLeave: () => void; onDelete: () => void;
}) {
  const [name, setName] = useState(detail.name);
  const [description, setDescription] = useState((detail as any).description || '');
  const [image, setImage] = useState((detail as any).image || '');
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'danger'>('overview');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd);
      setImage(res.data.url);
    } catch { toast('Erreur lors de l\'upload', 'error'); }
    setUploadingImg(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/communities/${communityId}`, { name: name.trim(), description: description.trim() || null, image: image || null });
      onUpdated();
      onClose();
    } catch { toast('Erreur lors de la sauvegarde', 'error'); }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}
        onClick={(e) => e.stopPropagation()}>

        {/* Banner / image de la communauté */}
        <div className="relative h-24 overflow-hidden"
          style={{ background: image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
          {image && <img src={mediaUrl(image)} alt="" className="w-full h-full object-cover" />}
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.3)' }}>
            {canAdmin(myRole) && (
              <button onClick={() => fileRef.current?.click()}
                disabled={uploadingImg}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                style={{ background: 'rgba(0,0,0,0.5)', border: '1.5px solid rgba(255,255,255,0.4)' }}>
                {uploadingImg ? 'Upload...' : image ? 'Changer l\'image' : 'Ajouter une image'}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        </div>

        {/* Tabs */}
        <div className="flex" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          {(['overview', 'danger'] as const).map((t) => (
            <button key={t} onClick={() => setActiveTab(t)}
              className="px-5 py-3 text-sm font-semibold transition"
              style={{ color: activeTab === t ? 'var(--sat-accent)' : 'var(--sat-muted)', borderBottom: activeTab === t ? '2px solid var(--sat-accent)' : '2px solid transparent' }}>
              {t === 'overview' ? 'Vue d\'ensemble' : '⚠ Danger'}
            </button>
          ))}
          <div className="flex-1" />
          <button onClick={onClose} className="w-10 h-10 m-1 flex items-center justify-center rounded-lg transition"
            style={{ color: 'var(--sat-faint)', background: 'var(--sat-hover)' }}>✕</button>
        </div>

        <div className="p-5">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Infos */}
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 flex items-center justify-center font-bold text-xl text-white"
                  style={{ background: image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                  {image ? <img src={mediaUrl(image)} alt="" className="w-full h-full object-cover" /> : detail.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-base" style={{ color: 'var(--sat-text)' }}>{detail.name}</p>
                  <p className="text-xs" style={{ color: 'var(--sat-muted)' }}>{detail.members.length} membre{detail.members.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {canAdmin(myRole) ? (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--sat-muted)' }}>Nom de la communauté</label>
                    <input value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
                      style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest block mb-1.5" style={{ color: 'var(--sat-muted)' }}>Description</label>
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                      rows={3} placeholder="Décris ta communauté..."
                      className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none resize-none"
                      style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>Annuler</button>
                    <button onClick={handleSave} disabled={saving || !name.trim()}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40"
                      style={{ background: 'var(--sat-accent)' }}>
                      {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>Seuls les administrateurs peuvent modifier la communauté.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-3">
              {myRole !== 'OWNER' && (
                <button onClick={onLeave}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-left hover:opacity-90"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span className="text-xl">🚪</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>Quitter la communauté</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sat-faint)' }}>Tu pourras la rejoindre à nouveau via une invitation.</p>
                  </div>
                </button>
              )}
              {myRole === 'OWNER' && (
                <button onClick={onDelete}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition text-left hover:opacity-90"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <span className="text-xl">🗑</span>
                  <div>
                    <p className="text-sm font-bold" style={{ color: '#EF4444' }}>Supprimer la communauté</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--sat-faint)' }}>Action irréversible. Tous les salons et messages seront perdus.</p>
                  </div>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Modale ajout membre ──
function AddMemberModal({ friends, existingIds, onClose, onAdd }: {
  friends: any[]; existingIds: string[]; onClose: () => void; onAdd: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const eligible = friends.filter(
    (f) => !existingIds.includes(f.id) &&
      (!search.trim() || (f.nickname || f.email || '').toLowerCase().includes(search.toLowerCase()))
  );
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5 space-y-3" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold" style={{ color: 'var(--sat-text)' }}>Ajouter un membre</h2>
        <input autoFocus value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher parmi tes amis..."
          className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none"
          style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {eligible.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--sat-faint)' }}>
              {friends.length === 0 ? 'Aucun ami disponible' : 'Tous tes amis sont déjà membres'}
            </p>
          )}
          {eligible.map((f) => (
            <button key={f.id} onClick={() => onAdd(f.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-left"
              style={{ background: 'var(--sat-hover)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.12)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden"
                style={{ background: f.image ? 'transparent' : 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                {f.image ? <img src={mediaUrl(f.image)} className="w-full h-full object-cover" alt="" /> : (f.nickname || f.email || '?').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{f.nickname || f.email?.split('@')[0]}</p>
                <p className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>{f.email}</p>
              </div>
              <span className="text-xs font-bold flex-shrink-0" style={{ color: 'var(--sat-accent)' }}>Ajouter</span>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>Fermer</button>
      </div>
    </div>
  );
}

// ── Modale ajout salon ──
function AddChannelModal({ categoryId, onClose, onCreate }: {
  categoryId: string | null; onClose: () => void; onCreate: (name: string, type: 'TEXT' | 'VOICE', categoryId: string | null) => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<'TEXT' | 'VOICE'>('TEXT');
  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4" style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-5" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold mb-4" style={{ color: 'var(--sat-text)' }}>Créer un salon</h2>
        <div className="flex gap-2 mb-4">
          {(['TEXT', 'VOICE'] as const).map((t) => (
            <button key={t} onClick={() => setType(t)}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2"
              style={{ background: type === t ? 'rgba(37,99,235,0.1)' : 'var(--sat-hover)', border: `1.5px solid ${type === t ? 'var(--sat-accent)' : 'transparent'}`, color: type === t ? 'var(--sat-accent)' : 'var(--sat-muted)' }}>
              {t === 'TEXT' ? <># Textuel</> : <><SpeakerIcon size={15} /> Vocal</>}
            </button>
          ))}
        </div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onCreate(name, type, categoryId); }}
          placeholder="nom-du-salon"
          className="w-full rounded-xl px-3.5 py-2.5 text-sm focus:outline-none mb-4"
          style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
        <div className="flex gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>Annuler</button>
          <button onClick={() => onCreate(name, type, categoryId)} disabled={!name.trim()}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition disabled:opacity-40" style={{ background: 'var(--sat-accent)' }}>
            Créer le salon
          </button>
        </div>
      </div>
    </div>
  );
}
