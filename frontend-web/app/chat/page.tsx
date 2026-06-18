'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useChatStore } from '@/store/chatStore';
import { usePresenceStore } from '@/store/presenceStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { EmojiPicker } from '@/components/EmojiPicker';
import { GroupPanel } from '@/components/GroupPanel';
import { Spinner, PageLoader } from '@/components/Spinner';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function cx(...cs: (string | false | null | undefined)[]) {
  return cs.filter(Boolean).join(' ');
}

function getLocalAlias(myId: string, otherId: string) {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`saturn_alias_${myId}_${otherId}`) || '';
}
function setLocalAlias(myId: string, otherId: string, name: string) {
  if (name.trim()) localStorage.setItem(`saturn_alias_${myId}_${otherId}`, name.trim());
  else localStorage.removeItem(`saturn_alias_${myId}_${otherId}`);
}

function FilePreview({ url, name, type }: { url: string; name: string; type: string }) {
  if (type.startsWith('image/')) {
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt={name} className="max-w-[200px] max-h-[200px] rounded-xl object-cover hover:opacity-90 transition" style={{ border: '1px solid var(--sat-border-2)' }} />
      </a>
    );
  }
  const icon = type.includes('pdf') ? '📄' : type.includes('video') ? '🎬' : '📎';
  return (
    <a href={url} download={name} target="_blank" rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition max-w-[220px]"
      style={{ background: 'var(--sat-hover)', border: '1px solid var(--sat-border-2)' }}>
      <span className="text-lg">{icon}</span>
      <span className="text-xs truncate" style={{ color: 'var(--sat-text)' }}>{name}</span>
      <span className="text-xs ml-auto" style={{ color: 'var(--sat-muted)' }}>↓</span>
    </a>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const {
    conversations, messagesByConversationId, currentConversationId, unreadCounts,
    setConversations, setCurrentConversationId, setMessages, addMessage, incrementUnread,
  } = useChatStore();
  const isOnline = usePresenceStore((s) => s.isOnline);
  const socket = useChatSocket();

  const [newMessage, setNewMessage] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>(null);

  // Typing
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> nickname

  // Whisper
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<string[]>([]);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Sidebar groupe
  const [sidebarGroupOpen, setSidebarGroupOpen] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  // Surnom local
  const [aliasMap, setAliasMap] = useState<Record<string, string>>({});
  const [editingAlias, setEditingAlias] = useState(false);
  const [aliasInput, setAliasInput] = useState('');

  // ── Init ──
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setCurrentUser(data.user);
    });
    api.get('/friends').then((r) => setFriends(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoadingConvs(true);
      try {
        const res = await api.get('/conversations');
        setConversations(res.data);
        const fromUrl = searchParams.get('conversationId');
        if (fromUrl) setCurrentConversationId(fromUrl);
        else if (res.data.length && !currentConversationId) setCurrentConversationId(res.data[0].id);
      } catch { setError('Erreur de chargement'); }
      finally { setLoadingConvs(false); }
    })();
  }, []);

  useEffect(() => {
    if (!currentConversationId) return;
    if (messagesByConversationId[currentConversationId]) return;
    (async () => {
      setLoadingMsgs(true);
      try {
        const res = await api.get(`/conversations/${currentConversationId}/messages`);
        setMessages(currentConversationId, res.data);
      } catch { setError('Erreur de chargement des messages'); }
      finally { setLoadingMsgs(false); }
    })();
  }, [currentConversationId]);

  useEffect(() => {
    if (!socket || !currentConversationId) return;
    socket.emit('join_conversation', { conversationId: currentConversationId });
  }, [socket, currentConversationId]);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: any) => {
      addMessage(msg.conversationId, msg);
      if (msg.conversationId !== currentConversationId) incrementUnread(msg.conversationId);
      // Effacer typing quand le message arrive
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.sender?.id]; return n; });
      // AI suggestions si c'est pas moi
      if (msg.sender?.id !== currentUser?.id && msg.conversationId === currentConversationId && !msg.fileUrl) {
        fetchAiSuggestions(msg);
      }
    };
    socket.on('new_message', handler);

    // Typing events
    const typingHandler = ({ userId, conversationId }: any) => {
      if (conversationId !== currentConversationId) return;
      const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      const member = conv?.participants.find((p) => p.user.id === userId)?.user;
      if (member && userId !== currentUser?.id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: member.nickname || member.email || '...' }));
      }
    };
    const stopTypingHandler = ({ userId }: any) => {
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messagesByConversationId, currentConversationId]);

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

  // Fermer le panel groupe quand on change de conv
  useEffect(() => {
    setShowGroupPanel(false);
    setWhisperMode(false);
    setWhisperTargets([]);
    setAiSuggestions([]);
    setTypingUsers({});
  }, [currentConversationId]);

  // ── Helpers ──
  const currentMessages = useMemo(
    () => (currentConversationId ? messagesByConversationId[currentConversationId] ?? [] : []),
    [currentConversationId, messagesByConversationId],
  );
  const currentConv = conversations.find((c) => c.id === currentConversationId);

  const getOtherUser = useCallback(
    (conv: any) => conv.type === 'GROUP' ? null : conv.participants.find((p: any) => p.user.id !== currentUser?.id)?.user || null,
    [currentUser],
  );

  const getTitle = useCallback(
    (conv: any) => {
      if (conv.type === 'GROUP') return conv.name || 'Groupe';
      const other = getOtherUser(conv);
      return other ? (aliasMap[other.id] || other.nickname || other.email) : 'Conversation';
    },
    [aliasMap, getOtherUser],
  );

  // ── AI suggestions ──
  const fetchAiSuggestions = async (lastMsg: any) => {
    if (!currentConversationId) return;
    setLoadingAi(true);
    setAiSuggestions([]);
    try {
      const msgs = (messagesByConversationId[currentConversationId] ?? []).slice(-5);
      const formatted = msgs.map((m: any) => ({
        role: m.sender.id === currentUser?.id ? 'assistant' : 'user',
        content: m.content,
      }));
      const res = await api.post('/ai/suggest', { messages: formatted });
      setAiSuggestions(res.data.suggestions ?? []);
    } catch { /* ignore */ }
    finally { setLoadingAi(false); }
  };

  // ── Typing ──
  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!socket || !currentConversationId) return;
    socket.emit('typing_start', { conversationId: currentConversationId });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: currentConversationId });
    }, 2000);
  };

  // ── Send message ──
  const handleSend = (content?: string) => {
    const text = content ?? newMessage;
    if (!socket || !currentConversationId || !text.trim()) return;
    socket.emit('send_message', {
      conversationId: currentConversationId,
      content: text.trim(),
      ...(whisperMode && whisperTargets.length > 0 ? { whisperTo: whisperTargets } : {}),
    });
    if (!content) setNewMessage('');
    setAiSuggestions([]);
    if (socket && currentConversationId) socket.emit('typing_stop', { conversationId: currentConversationId });
  };

  // Insertion @mention
  const insertMention = (nickname: string) => {
    setNewMessage((m) => m + `@${nickname} `);
    inputRef.current?.focus();
  };

  // ── Send file ──
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !currentConversationId) return;
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop lourd (max 10 Mo)'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      socket.emit('send_message', {
        conversationId: currentConversationId,
        content: '',
        fileUrl: reader.result as string,
        fileName: file.name,
        fileType: file.type,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Alias ──
  const openAliasEdit = () => {
    if (!currentConv || currentConv.type === 'GROUP') return;
    const other = getOtherUser(currentConv);
    if (!other) return;
    setAliasInput(aliasMap[other.id] || other.nickname || other.email || '');
    setEditingAlias(true);
  };
  const saveAlias = () => {
    if (!currentUser || !currentConv) return;
    const other = getOtherUser(currentConv);
    if (!other) return;
    setLocalAlias(currentUser.id, other.id, aliasInput);
    setAliasMap((prev) => ({ ...prev, [other.id]: aliasInput.trim() }));
    setEditingAlias(false);
  };

  // ── Group panel ──
  const openGroupPanel = async () => {
    if (!currentConv || currentConv.type !== 'GROUP') return;
    try {
      const res = await api.get(`/conversations/${currentConv.id}`);
      setGroupDetail(res.data);
      setShowGroupPanel(true);
    } catch { /* ignore */ }
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

  // ── Groupe sidebar ──
  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedFriends.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await api.post('/conversations/group', { name: groupName.trim(), memberIds: selectedFriends });
      const convs = await api.get('/conversations');
      setConversations(convs.data);
      setCurrentConversationId(res.data.id);
      setSidebarGroupOpen(false);
      setGroupName('');
      setSelectedFriends([]);
    } finally { setCreatingGroup(false); }
  };
  const toggleFriend = (id: string) =>
    setSelectedFriends((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  // ─────────────────────────────────────────────────────────────────────────────

  const convPlaceholder = currentConv?.type === 'GROUP'
    ? `Envoyer un message dans ${getTitle(currentConv)}`
    : currentConv ? `Message à ${getTitle(currentConv)}` : 'Écrire un message...';

  return (
    <div className="flex w-full h-full overflow-hidden" style={{ color: 'var(--sat-text)' }}>

      {/* ── COL 1 : Liste des conversations (240px) ── */}
      <aside className="flex flex-col flex-shrink-0" style={{ width: 240, background: 'var(--sat-panel)', borderRight: '1px solid var(--sat-border)' }}>

        {/* Header liste */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>
            Messages directs
          </span>
          <button
            onClick={() => setSidebarGroupOpen((v) => !v)}
            title="Nouveau groupe"
            className="w-5 h-5 flex items-center justify-center rounded transition text-lg font-bold leading-none"
            style={{ color: sidebarGroupOpen ? 'var(--sat-text)' : 'var(--sat-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
            onMouseLeave={(e) => { if (!sidebarGroupOpen) e.currentTarget.style.color = 'var(--sat-muted)'; }}
          >
            +
          </button>
        </div>

        {/* Form nouveau groupe */}
        {sidebarGroupOpen && (
          <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-void)' }}>
            <p className="text-[10px] uppercase tracking-widest font-bold" style={{ color: 'var(--sat-muted)' }}>Nouveau groupe</p>
            <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)}
              placeholder="Nom du groupe..."
              className="w-full rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
              style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            <div className="flex flex-col gap-0.5 max-h-32 overflow-y-auto">
              {friends.map((f) => (
                <button key={f.id} onClick={() => toggleFriend(f.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition"
                  style={{ background: selectedFriends.includes(f.id) ? 'rgba(160,22,217,0.2)' : 'transparent', color: selectedFriends.includes(f.id) ? 'var(--sat-text)' : 'var(--sat-muted)' }}>
                  <div className="w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 transition"
                    style={{ borderColor: selectedFriends.includes(f.id) ? 'var(--sat-accent)' : 'var(--sat-faint)', background: selectedFriends.includes(f.id) ? 'var(--sat-accent)' : 'transparent' }}>
                    {selectedFriends.includes(f.id) && <span className="text-[7px] font-black text-white">✓</span>}
                  </div>
                  <Avatar user={f} size="xs" />
                  <span className="truncate">{f.nickname || f.email}</span>
                </button>
              ))}
            </div>
            <button onClick={handleCreateGroup} disabled={creatingGroup || !groupName.trim() || selectedFriends.length === 0}
              className="w-full py-1.5 rounded-md text-[11px] font-bold transition disabled:opacity-30"
              style={{ background: 'var(--sat-accent)', color: '#fff' }}>
              {creatingGroup ? 'Création...' : `Créer le groupe (${selectedFriends.length})`}
            </button>
          </div>
        )}

        {/* Liste des convs */}
        <div className="flex-1 overflow-y-auto py-2 px-2">
          {loadingConvs && (
            <div className="flex justify-center py-10">
              <Spinner size={20} />
            </div>
          )}
          {!loadingConvs && conversations.length === 0 && (
            <div className="px-3 py-8 text-center">
              <p className="text-xs" style={{ color: 'var(--sat-faint)' }}>Aucune conversation.<br/>Ajoute des amis pour commencer.</p>
            </div>
          )}
          {conversations.map((conv) => {
            const unread = unreadCounts[conv.id] ?? 0;
            const isActive = conv.id === currentConversationId;
            const otherUser = getOtherUser(conv);
            const lastMsg = conv.messages?.[0];
            const title = getTitle(conv);
            const online = otherUser ? isOnline(otherUser.id) : false;
            const preview = lastMsg
              ? (lastMsg.fileUrl ? `📎 ${lastMsg.fileName || 'Fichier'}` : lastMsg.sender.id === currentUser?.id ? `Vous : ${lastMsg.content}` : lastMsg.content)
              : '';

            return (
              <button key={conv.id} onClick={() => setCurrentConversationId(conv.id)}
                className="w-full text-left flex items-center gap-2.5 px-2 py-1.5 rounded-md transition mb-0.5"
                style={{ background: isActive ? 'var(--sat-active)' : 'transparent', color: isActive ? 'var(--sat-text)' : unread > 0 ? 'var(--sat-text)' : 'var(--sat-muted)' }}
                onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'var(--sat-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--sat-text)'; }}
                onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = unread > 0 ? 'var(--sat-text)' : 'var(--sat-muted)'; } }}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {conv.type === 'GROUP'
                    ? <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                        {(conv as any).image ? <img src={(conv as any).image} className="w-full h-full object-cover" alt="" /> : title.charAt(0).toUpperCase()}
                      </div>
                    : <Avatar user={otherUser || {}} size="xs" className="w-8 h-8 flex-shrink-0" />}
                  {/* Status dot */}
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                    style={{
                      background: conv.type === 'GROUP' ? 'transparent' : online ? 'var(--sat-online)' : 'var(--sat-offline)',
                      border: '2px solid var(--sat-panel)',
                      display: conv.type === 'GROUP' ? 'none' : 'block',
                    }} />
                </div>

                {/* Texte */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className={cx('text-[13px] truncate', unread > 0 ? 'font-bold' : 'font-medium')}>{title}</span>
                    {unread > 0 && (
                      <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center text-white px-1"
                        style={{ background: 'var(--sat-dnd)' }}>
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                  {preview && (
                    <p className="text-[11px] truncate" style={{ color: 'var(--sat-faint)' }}>{preview}</p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

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
              {currentConv && (() => {
                const otherUser = getOtherUser(currentConv);
                const online = otherUser ? isOnline(otherUser.id) : false;
                return (
                  <>
                    <button
                      onClick={currentConv.type === 'GROUP' ? openGroupPanel : undefined}
                      className={cx('relative flex-shrink-0', currentConv.type === 'GROUP' ? 'cursor-pointer' : 'cursor-default')}
                    >
                      {currentConv.type === 'GROUP'
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold overflow-hidden"
                            style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                            {(currentConv as any).image ? <img src={(currentConv as any).image} className="w-full h-full object-cover" alt="" /> : getTitle(currentConv).charAt(0).toUpperCase()}
                          </div>
                        : <Avatar user={otherUser || {}} size="xs" className="w-7 h-7" />}
                      {currentConv.type === 'DM' && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                          style={{ background: online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '1.5px solid var(--sat-main)' }} />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {editingAlias ? (
                        <div className="flex items-center gap-2">
                          <input autoFocus type="text" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveAlias(); if (e.key === 'Escape') setEditingAlias(false); }}
                            className="rounded px-2 py-0.5 text-sm font-bold focus:outline-none w-36"
                            style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-accent)', color: 'var(--sat-text)' }} />
                          <button onClick={saveAlias} className="text-[10px] font-bold" style={{ color: 'var(--sat-accent)' }}>OK</button>
                          <button onClick={() => setEditingAlias(false)} className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>✕</button>
                        </div>
                      ) : (
                        <button onClick={currentConv.type === 'GROUP' ? openGroupPanel : openAliasEdit}
                          className="text-[15px] font-bold truncate hover:opacity-80 transition"
                          title={currentConv.type === 'DM' ? 'Modifier le surnom' : 'Infos du groupe'}>
                          {getTitle(currentConv)}
                        </button>
                      )}
                      <span className="text-xs" style={{ color: 'var(--sat-faint)' }}>
                        {currentConv.type === 'GROUP'
                          ? `— ${currentConv.participants.length} membres`
                          : online ? '— En ligne' : '— Hors ligne'}
                      </span>
                    </div>

                    {/* Actions header */}
                    {currentConv.type === 'GROUP' && (
                      <button onClick={openGroupPanel} title="Infos du groupe"
                        className="w-8 h-8 rounded flex items-center justify-center transition"
                        style={{ color: 'var(--sat-muted)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* ── Messages — bulles de chaque côté ── */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
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
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl"
                    style={{ background: 'var(--sat-surface)' }}>
                    {currentConv?.type === 'GROUP' ? '👥' : '👋'}
                  </div>
                  <p className="font-bold text-base mb-1">Début de votre conversation</p>
                  <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>
                    Envoie le premier message à <strong>{currentConv ? getTitle(currentConv) : ''}</strong> !
                  </p>
                </div>
              )}

              {currentMessages.map((msg: any, i: number) => {
                const isMe = msg.sender.id === currentUser?.id;
                const prevMsg = currentMessages[i - 1] as any;
                const nextMsg = currentMessages[i + 1] as any;
                const samePrev = prevMsg?.sender.id === msg.sender.id && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;
                const sameNext = nextMsg?.sender.id === msg.sender.id && new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() < 300000;

                return (
                  <div key={msg.id} className={cx('flex items-end gap-2', isMe ? 'justify-end' : 'justify-start', samePrev ? 'mt-0.5' : 'mt-3')}>
                    {/* Avatar côté gauche (autres) */}
                    {!isMe && (
                      <div className="w-8 flex-shrink-0 self-end mb-0.5">
                        {!sameNext ? <Avatar user={msg.sender} size="xs" className="w-8 h-8" /> : <div className="w-8 h-8" />}
                      </div>
                    )}

                    <div className={cx('flex flex-col max-w-[68%]', isMe ? 'items-end' : 'items-start')}>
                      {/* Nom de l'expéditeur (groupes, premiers msgs) */}
                      {!isMe && !samePrev && currentConv?.type === 'GROUP' && (
                        <span className="text-[11px] font-semibold px-1 mb-1" style={{ color: 'var(--sat-accent)' }}>
                          {aliasMap[msg.sender.id] || msg.sender.nickname || msg.sender.email}
                        </span>
                      )}

                      {/* Whisper badge */}
                      {msg.isWhisper && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 flex items-center gap-1"
                          style={{ background: 'rgba(160,22,217,0.15)', color: 'var(--sat-accent)' }}>
                          🤫 chuchoté
                        </span>
                      )}

                      {/* Bulle */}
                      {msg.fileUrl ? (
                        <FilePreview url={msg.fileUrl} name={msg.fileName} type={msg.fileType} />
                      ) : (
                        <div
                          className="px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm"
                          style={{
                            background: isMe ? 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))' : 'var(--sat-surface)',
                            color: isMe ? '#fff' : 'var(--sat-text)',
                            fontStyle: msg.isWhisper ? 'italic' : 'normal',
                            borderRadius: 18,
                            borderTopRightRadius: isMe && samePrev ? 6 : 18,
                            borderBottomRightRadius: isMe && sameNext ? 6 : 18,
                            borderTopLeftRadius: !isMe && samePrev ? 6 : 18,
                            borderBottomLeftRadius: !isMe && sameNext ? 6 : 18,
                          }}
                        >
                          {msg.content}
                        </div>
                      )}

                      {/* Heure (dernier d'un groupe) */}
                      {!sameNext && (
                        <span className="text-[10px] px-1 mt-0.5" style={{ color: 'var(--sat-faint)' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <span className="ml-1" style={{ color: 'var(--sat-accent)' }}>✓✓</span>}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* ── Zone de saisie — Discord style ── */}
            <div className="px-4 pb-6 pt-0 flex-shrink-0">

              {/* Typing indicator */}
              {Object.keys(typingUsers).length > 0 && (
                <div className="flex items-center gap-1.5 px-1 mb-1">
                  <span className="flex gap-0.5">
                    {[0,1,2].map((k) => (
                      <span key={k} className="w-1 h-1 rounded-full animate-bounce"
                        style={{ background: 'var(--sat-muted)', animationDelay: `${k*0.15}s` }} />
                    ))}
                  </span>
                  <span className="text-xs italic" style={{ color: 'var(--sat-muted)' }}>
                    <strong>{Object.values(typingUsers).join(', ')}</strong> {Object.keys(typingUsers).length > 1 ? 'écrivent' : 'écrit'}...
                  </span>
                </div>
              )}

              {/* AI suggestions */}
              {(aiSuggestions.length > 0 || loadingAi) && (
                <div className="flex gap-2 flex-wrap px-1 mb-2">
                  {loadingAi && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--sat-faint)' }}>
                      <span className="w-3 h-3 border border-t-transparent rounded-full animate-spin inline-block" style={{ borderColor: 'var(--sat-faint)' }} />
                      Suggestions IA...
                    </span>
                  )}
                  {aiSuggestions.map((s, idx) => (
                    <button key={idx} onClick={() => handleSend(s)}
                      className="px-3 py-1 rounded-full text-xs font-medium transition"
                      style={{ background: 'rgba(160,22,217,0.15)', border: '1px solid rgba(160,22,217,0.3)', color: 'var(--sat-text)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(160,22,217,0.3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(160,22,217,0.15)')}>
                      ✨ {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Whisper targets */}
              {currentConv?.type === 'GROUP' && whisperMode && (
                <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                  <span className="text-[11px] font-bold" style={{ color: 'var(--sat-accent)' }}>🤫 Visible par :</span>
                  {currentConv.participants.filter((p: any) => p.user.id !== currentUser?.id).map((p: any) => (
                    <button key={p.user.id}
                      onClick={() => setWhisperTargets((prev) => prev.includes(p.user.id) ? prev.filter((x) => x !== p.user.id) : [...prev, p.user.id])}
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium transition"
                      style={{
                        background: whisperTargets.includes(p.user.id) ? 'rgba(160,22,217,0.3)' : 'var(--sat-surface)',
                        border: `1px solid ${whisperTargets.includes(p.user.id) ? 'rgba(160,22,217,0.5)' : 'var(--sat-border-2)'}`,
                        color: whisperTargets.includes(p.user.id) ? 'var(--sat-text)' : 'var(--sat-muted)',
                      }}>
                      {p.user.nickname || p.user.email}
                    </button>
                  ))}
                </div>
              )}

              {/* Input bar — Discord style */}
              <div className="relative flex items-center rounded-lg"
                style={{ background: 'var(--sat-surface)', border: whisperMode ? '1px solid rgba(160,22,217,0.4)' : '1px solid var(--sat-border-2)' }}>

                {/* Bouton pièce jointe */}
                <button onClick={() => fileInputRef.current?.click()} title="Joindre un fichier"
                  className="flex-shrink-0 w-11 h-11 flex items-center justify-center transition"
                  style={{ color: 'var(--sat-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />

                {/* Input text */}
                <input ref={inputRef} type="text" value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { handleSend(); setShowEmoji(false); } }}
                  placeholder={whisperMode ? '🤫 Message chuchoté...' : convPlaceholder}
                  className="flex-1 py-3 text-sm bg-transparent focus:outline-none"
                  style={{ color: 'var(--sat-text)', minWidth: 0 }} />

                {/* Actions droite */}
                <div className="flex items-center gap-0 flex-shrink-0 pr-2">

                  {/* @ mention (groupes) */}
                  {currentConv?.type === 'GROUP' && (
                    <button title="Mentionner"
                      onClick={() => {
                        const nick = currentConv.participants.find((p: any) => p.user.id !== currentUser?.id)?.user?.nickname;
                        if (nick) insertMention(nick);
                      }}
                      className="w-8 h-8 flex items-center justify-center rounded transition text-sm font-bold"
                      style={{ color: 'var(--sat-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                      @
                    </button>
                  )}

                  {/* Whisper */}
                  {currentConv?.type === 'GROUP' && (
                    <button title="Message chuchoté"
                      onClick={() => { setWhisperMode((v) => !v); setWhisperTargets([]); }}
                      className="w-8 h-8 flex items-center justify-center rounded transition text-base"
                      style={{ color: whisperMode ? 'var(--sat-accent)' : 'var(--sat-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = whisperMode ? 'var(--sat-accent2)' : 'var(--sat-text)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = whisperMode ? 'var(--sat-accent)' : 'var(--sat-muted)')}>
                      🤫
                    </button>
                  )}

                  {/* Emoji */}
                  <div className="relative">
                    <button onClick={() => setShowEmoji((v) => !v)} title="Émojis"
                      className="w-8 h-8 flex items-center justify-center rounded transition text-lg"
                      style={{ color: showEmoji ? 'var(--sat-accent)' : 'var(--sat-muted)' }}
                      onMouseEnter={(e) => { if (!showEmoji) (e.currentTarget.style.color = 'var(--sat-text)'); }}
                      onMouseLeave={(e) => { if (!showEmoji) (e.currentTarget.style.color = 'var(--sat-muted)'); }}>
                      😊
                    </button>
                    {showEmoji && (
                      <EmojiPicker onSelect={(e) => setNewMessage((m) => m + e)} onClose={() => setShowEmoji(false)} />
                    )}
                  </div>

                  {/* Envoyer */}
                  {newMessage.trim() && (
                    <button onClick={() => handleSend()} title="Envoyer"
                      className="w-8 h-8 rounded flex items-center justify-center transition ml-0.5"
                      style={{ background: 'var(--sat-accent)', color: '#fff' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-accent2)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-accent)')}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>

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
