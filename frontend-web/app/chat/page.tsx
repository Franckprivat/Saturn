'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useChatStore, type ChatMessage, type ChatUser, type Conversation } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { GroupPanel } from '@/components/GroupPanel';
import { Spinner, PageLoader } from '@/components/Spinner';
import { wallpaperStyle } from '@/lib/wallpapers';
import { ContactPanel } from '@/components/ContactPanel';
import { DeleteMessageDialog } from '@/components/DeleteMessageDialog';
import { getConvPrefs, type ConvPrefs } from '@/lib/convPrefs';
import { getHiddenMessageIds, hideMessageForMe } from '@/lib/hiddenMessages';
import { toast } from '@/components/Toast';
import { apiErrorMessage } from '@/lib/errors';
import { ConversationList } from '@/components/chat/ConversationList';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageItem } from '@/components/chat/MessageItem';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { getLocalAlias, setLocalAlias } from '@/components/chat/utils';

type GroupPanelProps = React.ComponentProps<typeof GroupPanel>;
interface GroupDetail {
  name?: string | null;
  description?: string | null;
  image?: string | null;
  creatorId?: string | null;
  participants: GroupPanelProps['participants'];
  messages?: GroupPanelProps['attachments'];
}

// ── Page principale ────────────────────────────────────────────────────────────
// Elle garde l'état partagé (conversation ouverte, messages, panneaux) ; l'affichage
// est découpé dans components/chat/.

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);
  const {
    conversations, messagesByConversationId, paginationByConversationId, currentConversationId, unreadCounts,
    setConversations, setCurrentConversationId, setMessages, prependMessages,
  } = useChatStore();
  // Abonnement aux DONNÉES de présence (pas aux getters) → re-render garanti
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);
  const lastSeenById = usePresenceStore((s) => s.lastSeenById);
  const isOnline = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);
  const socket = useChatSocket();

  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);

  // Typing
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> nickname

  // Réponse / édition / réactions (parité avec les salons de communauté)
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const [friends, setFriends] = useState<ChatUser[]>([]);

  // Surnom local
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({});

  // Panneau contact (DM) + préférences locales de la conversation
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [convPrefs, setConvPrefsState] = useState<ConvPrefs>({});

  // Fond d'écran de discussion (persisté dans le profil, façon WhatsApp)
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  // ── Init ──
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setCurrentUser(data.user);
    }).catch(() => {});
    api.get('/friends').then((r) => setFriends(r.data))
      .catch((err) => toast(apiErrorMessage(err, 'Chargement des amis impossible'), 'error'));
    api.get('/users/me').then((r) => setWallpaper(r.data?.chatWallpaper ?? null)).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingConvs(true);
      try {
        const res = await api.get('/conversations');
        setConversations(res.data);
      } catch { /* le pont global réessaie à la connexion du socket */ }
      finally { setLoadingConvs(false); }
    })();
  }, []);

  // Sélection réactive : dès que la liste arrive (fetch local OU pont global
  // après reconnexion), on ouvre la conversation de l'URL ou la plus récente.
  useEffect(() => {
    if (currentConversationId || !conversations.length) return;
    const fromUrl = searchParams.get('conversationId');
    setCurrentConversationId(fromUrl || conversations[0].id);
  }, [conversations, currentConversationId, searchParams]);

  useEffect(() => {
    if (!currentConversationId) return;
    if (messagesByConversationId[currentConversationId]) return;
    (async () => {
      setLoadingMsgs(true);
      try {
        const res = await api.get(`/conversations/${currentConversationId}/messages`);
        const data = res.data;
        const msgs = Array.isArray(data) ? data : (data?.messages ?? []);
        setMessages(currentConversationId, msgs, { nextCursor: data?.nextCursor ?? null, hasMore: data?.hasMore ?? false });
      } catch { setError('Erreur de chargement des messages'); }
      finally { setLoadingMsgs(false); }
    })();
  }, [currentConversationId]);

  // Ouvrir une conversation = la marquer comme lue (reçus ✓✓ côté expéditeur)
  useEffect(() => {
    if (!socket || !currentConversationId) return;
    socket.emit('join_conversation', { conversationId: currentConversationId });
    socket.emit('mark_read', { conversationId: currentConversationId });
  }, [socket, currentConversationId]);

  // Le store est alimenté par le pont global (AppShell) — ici, uniquement l'UX locale
  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      // Effacer typing quand le message arrive
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.sender?.id]; return n; });
      // Message reçu pendant qu'on lit la conversation → lu immédiatement
      if (msg.conversationId === currentConversationId && msg.sender?.id !== currentUser?.id) {
        socket.emit('mark_read', { conversationId: msg.conversationId });
      }
    };
    socket.on('new_message', handler);

    // Typing events
    const typingHandler = ({ userId, conversationId }: { userId: string; conversationId: string }) => {
      if (conversationId !== currentConversationId) return;
      const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      const member = conv?.participants.find((p) => p.user.id === userId)?.user;
      if (member && userId !== currentUser?.id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: member.nickname || member.email || '...' }));
      }
    };
    const stopTypingHandler = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    };
    socket.on('user_typing', typingHandler);
    socket.on('user_stopped_typing', stopTypingHandler);

    return () => {
      socket.off('new_message', handler);
      socket.off('user_typing', typingHandler);
      socket.off('user_stopped_typing', stopTypingHandler);
    };
  }, [socket, currentConversationId, currentUser]);

  // Auto-scroll uniquement quand un nouveau message arrive en bas
  // (pas quand on charge l'historique en haut)
  const lastMessageId = currentConversationId
    ? messagesByConversationId[currentConversationId]?.at(-1)?.id
    : undefined;
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lastMessageId, currentConversationId]);

  useEffect(() => {
    if (!currentUser || !conversations.length) return;
    const map: Record<string, string> = {};
    conversations.forEach((conv) => {
      if (conv.type !== 'DM') return;
      const other = conv.participants.find((p) => p.user.id !== currentUser.id)?.user;
      if (other) map[other.id] = getLocalAlias(currentUser.id, other.id);
    });
    setAliasMap(map);
  }, [currentUser, conversations]);

  // Fermer les panneaux quand on change de conv + charger les préférences locales
  useEffect(() => {
    setShowGroupPanel(false);
    setShowContactPanel(false);
    setTypingUsers({});
    setReplyTo(null);
    setEditingId(null);
    setReactionPicker(null);
  }, [currentConversationId]);

  useEffect(() => {
    if (currentUser?.id && currentConversationId) {
      setConvPrefsState(getConvPrefs(currentUser.id, currentConversationId));
    } else {
      setConvPrefsState({});
    }
  }, [currentUser, currentConversationId]);

  // ── Helpers ──
  const currentMessages = useMemo(
    () => (currentConversationId ? messagesByConversationId[currentConversationId] ?? [] : []),
    [currentConversationId, messagesByConversationId],
  );
  const currentConv = conversations.find((c) => c.id === currentConversationId);

  const getOtherUser = useCallback(
    (conv: Conversation) => conv.type === 'GROUP' ? null : conv.participants.find((p) => p.user.id !== currentUser?.id)?.user || null,
    [currentUser],
  );

  const getTitle = useCallback(
    (conv: Conversation) => {
      if (conv.type === 'GROUP') return conv.name || 'Groupe';
      const other = getOtherUser(conv);
      return other ? (aliasMap[other.id] || other.nickname || other.email) : 'Conversation';
    },
    [aliasMap, getOtherUser],
  );

  // ── Éditer un message ──
  const submitEdit = () => {
    if (!socket || !editingId || !editContent.trim()) return;
    socket.emit('edit_message', { messageId: editingId, content: editContent.trim() });
    setEditingId(null);
  };

  // ── Réagir ──
  const toggleReaction = (messageId: string, emoji: string) => {
    socket?.emit('add_reaction', { messageId, emoji });
    setReactionPicker(null);
  };

  // ── Charger l'historique plus ancien ──
  const loadOlderMessages = async () => {
    if (!currentConversationId || loadingMore) return;
    const pagination = paginationByConversationId[currentConversationId];
    if (!pagination?.hasMore || !pagination.nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/conversations/${currentConversationId}/messages`, {
        params: { cursor: pagination.nextCursor },
      });
      prependMessages(currentConversationId, res.data.messages ?? [], {
        nextCursor: res.data.nextCursor ?? null,
        hasMore: res.data.hasMore ?? false,
      });
    } catch { /* silencieux */ }
    finally { setLoadingMore(false); }
  };

  // ── Suppression : pour moi (masquage local) / pour tous (serveur) ──
  const [deleteTarget, setDeleteTarget] = useState<ChatMessage | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (currentUser?.id) setHiddenIds(getHiddenMessageIds(currentUser.id));
  }, [currentUser]);

  const deleteForMe = (messageId: string) => {
    if (!currentUser) return;
    setHiddenIds(hideMessageForMe(currentUser.id, messageId));
  };

  const deleteForAll = (messageId: string) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId });
  };

  // ── Surnom local (édité depuis le panneau contact) ──
  const handleAliasChange = (newAlias: string) => {
    if (!currentUser || !currentConv) return;
    const other = getOtherUser(currentConv);
    if (!other) return;
    setLocalAlias(currentUser.id, other.id, newAlias);
    setAliasMap((prev) => ({ ...prev, [other.id]: newAlias.trim() }));
  };

  // ── Group panel ──
  const openGroupPanel = async () => {
    if (!currentConv || currentConv.type !== 'GROUP') return;
    try {
      const res = await api.get(`/conversations/${currentConv.id}`);
      setGroupDetail(res.data);
      setShowGroupPanel(true);
    } catch (err) {
      toast(apiErrorMessage(err, 'Impossible d\'ouvrir les infos du groupe'), 'error');
    }
  };

  const refreshGroupDetail = async () => {
    if (!currentConv) return;
    const [convs, detail] = await Promise.all([
      api.get('/conversations'),
      api.get(`/conversations/${currentConv.id}`),
    ]);
    setConversations(convs.data);
    setGroupDetail(detail.data);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const convPlaceholder = currentConv?.type === 'GROUP'
    ? `Envoyer un message dans ${getTitle(currentConv)}`
    : currentConv ? `Message à ${getTitle(currentConv)}` : 'Écrire un message...';
  const visibleMessages = currentMessages.filter((m) => !hiddenIds.has(m.id));

  return (
    <div className="flex w-full h-full overflow-hidden" style={{ color: 'var(--sat-text)' }}>

      {/* ── COL 1 : Liste des conversations (240px) ── */}
      <ConversationList
        conversations={conversations}
        unreadCounts={unreadCounts}
        currentConversationId={currentConversationId}
        currentUserId={currentUser?.id}
        loadingConvs={loadingConvs}
        friends={friends}
        getOtherUser={getOtherUser}
        getTitle={getTitle}
        isOnline={isOnline}
        onSelect={setCurrentConversationId}
      />

      {/* ── COL 2 : Zone principale du chat ── */}
      <section className="flex-1 flex flex-col overflow-hidden min-w-0" style={{ background: 'var(--sat-main)' }}>
        {!currentConversationId ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: 'var(--sat-surface)' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sat-faint)' }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div>
                <p className="font-bold text-base">Aucune conversation sélectionnée</p>
                <p className="text-sm mt-1" style={{ color: 'var(--sat-muted)' }}>Choisis une conversation ou ajoute des amis</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── Header conversation ── */}
            <div className="h-12 px-4 flex items-center gap-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-main)', boxShadow: '0 1px 0 var(--sat-border)' }}>
              {currentConv && (
                <ChatHeader
                  currentConv={currentConv}
                  getOtherUser={getOtherUser}
                  getTitle={getTitle}
                  isOnline={isOnline}
                  lastSeenById={lastSeenById}
                  wallpaper={wallpaper}
                  setWallpaper={setWallpaper}
                  openGroupPanel={openGroupPanel}
                  onToggleContact={() => setShowContactPanel((v) => !v)}
                />
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5"
              style={wallpaperStyle(convPrefs.wallpaper !== undefined ? convPrefs.wallpaper : wallpaper)}>
              {error && (
                <div className="mx-1 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
                  ⚠ {error}
                </div>
              )}
              {loadingMsgs && (
                <div className="flex justify-center py-10">
                  <Spinner size={22} />
                </div>
              )}
              {!loadingMsgs && currentMessages.length === 0 && (
                <div className="px-4 py-16 text-center">
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                    style={{ background: 'var(--sat-surface)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--sat-faint)' }}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                  <p className="font-bold text-base mb-1">Début de votre conversation</p>
                  <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>
                    Envoie le premier message à <strong>{currentConv ? getTitle(currentConv) : ''}</strong> !
                  </p>
                </div>
              )}

              {/* Charger l'historique plus ancien */}
              {!loadingMsgs && currentConversationId && paginationByConversationId[currentConversationId]?.hasMore && (
                <div className="flex justify-center pb-2">
                  <button onClick={loadOlderMessages} disabled={loadingMore}
                    className="px-4 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-50"
                    style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}>
                    {loadingMore ? 'Chargement…' : '↑ Afficher les messages précédents'}
                  </button>
                </div>
              )}


              {visibleMessages.map((msg, i) => (
                <MessageItem
                  key={msg.id}
                  msg={msg}
                  prevMsg={visibleMessages[i - 1]}
                  nextMsg={visibleMessages[i + 1]}
                  currentUserId={currentUser?.id}
                  currentConv={currentConv}
                  aliasMap={aliasMap}
                  convPrefs={convPrefs}
                  isEditing={editingId === msg.id}
                  editContent={editContent}
                  setEditContent={setEditContent}
                  setEditingId={setEditingId}
                  submitEdit={submitEdit}
                  reactionPicker={reactionPicker}
                  setReactionPicker={setReactionPicker}
                  toggleReaction={toggleReaction}
                  onReply={(m) => { setReplyTo(m); inputRef.current?.focus(); }}
                  setDeleteTarget={setDeleteTarget}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Zone de saisie — Discord style ── */}
            <ChatComposer
              socket={socket}
              currentConversationId={currentConversationId}
              currentConv={currentConv}
              currentUserId={currentUser?.id}
              replyTo={replyTo}
              setReplyTo={setReplyTo}
              typingUsers={typingUsers}
              convPlaceholder={convPlaceholder}
              setError={setError}
              inputRef={inputRef}
            />
          </>
        )}
      </section>

      {/* ── Dialogue de suppression ── */}
      {deleteTarget && (
        <DeleteMessageDialog
          canDeleteForAll={deleteTarget.sender?.id === currentUser?.id}
          onDeleteForMe={() => deleteForMe(deleteTarget.id)}
          onDeleteForAll={() => deleteForAll(deleteTarget.id)}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* ── Panneau contact (DM, façon WhatsApp) ── */}
      {showContactPanel && currentConv?.type === 'DM' && currentUser && (() => {
        const other = getOtherUser(currentConv);
        if (!other) return null;
        return (
          <ContactPanel
            conversationId={currentConv.id}
            currentUserId={currentUser.id}
            contact={other}
            online={isOnline(other.id)}
            alias={aliasMap[other.id] || ''}
            onAliasChange={handleAliasChange}
            onPrefsChange={setConvPrefsState}
            onClose={() => setShowContactPanel(false)}
          />
        );
      })()}

      {/* ── Panel groupe ── */}
      {showGroupPanel && groupDetail && currentConv && (
        <GroupPanel
          conversationId={currentConv.id}
          name={groupDetail.name || ''}
          description={groupDetail.description}
          image={groupDetail.image}
          creatorId={groupDetail.creatorId}
          participants={groupDetail.participants}
          attachments={groupDetail.messages || []}
          currentUserId={currentUser?.id || ''}
          friends={friends}
          onClose={() => setShowGroupPanel(false)}
          onUpdated={refreshGroupDetail}
        />
      )}
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader label="Chargement des messages..." />}>
      <ChatPageContent />
    </Suspense>
  );
}
