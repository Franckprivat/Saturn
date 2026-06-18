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
import { CallModal } from '@/components/CallModal';
import { CreateGroupModal } from '@/components/CreateGroupModal';
import { ToastContainer, ToastProvider, toast, type ToastItem } from '@/components/Toast';
import { PhoneIcon, VideoIcon, SmileyIcon, PinIcon, ReplyIcon, EditIcon, TrashIcon, CopyIcon } from '@/components/Icons';

// ── Helpers ──────────────────────────────────────────────────────────────────

function cx(...cs: (string | false | null | undefined)[]) {
  return cs.filter(Boolean).join(' ');
}

function displayName(user: { nickname?: string | null; email?: string | null } | null | undefined) {
  if (!user) return 'Inconnu';
  return user.nickname?.trim() || user.email?.split('@')[0] || 'Inconnu';
}

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return date.toLocaleDateString('fr-FR', { weekday: 'short' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
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
  if (type.startsWith('audio/')) {
    return (
      <div className="flex flex-col gap-1" style={{ minWidth: 200 }}>
        <audio controls src={url} className="max-w-[260px]" style={{ height: 36 }} />
        <a href={url} download={name} className="text-[10px] opacity-60 hover:opacity-100" style={{ color: 'var(--sat-muted)' }}>{name}</a>
      </div>
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

// ── Page principale ───────────────────────────────────────────────────────────

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const {
    conversations, messagesByConversationId, paginationByConversationId,
    currentConversationId, unreadCounts,
    setConversations, setCurrentConversationId, setMessages, prependMessages,
    addMessage, updateMessage, incrementUnread,
  } = useChatStore();
  const isOnline = usePresenceStore((s) => s.isOnline);
  const socket = useChatSocket();

  const [newMessage, setNewMessage] = useState('');
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // UI state
  const [showEmoji, setShowEmoji] = useState(false);
  const [showGroupPanel, setShowGroupPanel] = useState(false);
  const [groupDetail, setGroupDetail] = useState<any>(null);

  // Typing
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});

  // Whisper
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<string[]>([]);

  // AI suggestions
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

  // Reply
  const [replyTo, setReplyTo] = useState<any | null>(null);

  // Edit
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Hover menu
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);

  // Pinned messages
  const [pinnedMessages, setPinnedMessages] = useState<any[]>([]);
  const [showPinned, setShowPinned] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Call
  const [callState, setCallState] = useState<null | { type: 'audio' | 'video'; incoming: boolean; callerName?: string; offer?: any }>(null);

  // Sidebar groupe
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [convSearch, setConvSearch] = useState('');
  const [friends, setFriends] = useState<any[]>([]);

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
        setMessages(currentConversationId, res.data.messages, { nextCursor: res.data.nextCursor, hasMore: res.data.hasMore });
        // Mark as read
        socket?.emit('mark_read', { conversationId: currentConversationId });
      } catch { setError('Erreur de chargement des messages'); }
      finally { setLoadingMsgs(false); }
    })();
    // Load pinned messages
    api.get(`/conversations/${currentConversationId}/messages/pinned`)
      .then((r) => setPinnedMessages(r.data || []))
      .catch(() => {});
  }, [currentConversationId]);

  useEffect(() => {
    if (!socket || !currentConversationId) return;
    socket.emit('join_conversation', { conversationId: currentConversationId });
  }, [socket, currentConversationId]);

  useEffect(() => {
    if (!socket) return;

    const handler = (msg: any) => {
      addMessage(msg.conversationId, msg);
      if (msg.conversationId !== currentConversationId) {
        incrementUnread(msg.conversationId);
        // Browser notification
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(`Saturn — ${displayName(msg.sender)}`, { body: msg.content || '📎 Fichier', icon: '/favicon.ico' });
        }
      } else {
        socket.emit('mark_read', { conversationId: msg.conversationId });
      }
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.sender?.id]; return n; });
      if (msg.sender?.id !== currentUser?.id && msg.conversationId === currentConversationId && !msg.fileUrl) {
        fetchAiSuggestions(msg);
      }
    };
    socket.on('new_message', handler);

    const editedHandler = (msg: any) => {
      updateMessage(msg.conversationId, msg.id, { content: msg.content, editedAt: msg.editedAt });
    };
    socket.on('message_edited', editedHandler);

    const typingHandler = ({ userId, conversationId }: any) => {
      if (conversationId !== currentConversationId) return;
      const conv = useChatStore.getState().conversations.find((c) => c.id === conversationId);
      const member = conv?.participants.find((p) => p.user.id === userId)?.user;
      if (member && userId !== currentUser?.id) {
        setTypingUsers((prev) => ({ ...prev, [userId]: displayName(member) }));
      }
    };
    const stopTypingHandler = ({ userId }: any) => {
      setTypingUsers((prev) => { const n = { ...prev }; delete n[userId]; return n; });
    };
    socket.on('user_typing', typingHandler);
    socket.on('user_stopped_typing', stopTypingHandler);

    const deletedHandler = ({ messageId, conversationId }: any) => {
      updateMessage(conversationId, messageId, { deletedAt: new Date().toISOString(), content: '', fileUrl: null, fileName: null, fileType: null });
    };
    socket.on('message_deleted', deletedHandler);

    const reactionHandler = ({ messageId, reactions }: any) => {
      const convId = useChatStore.getState().currentConversationId;
      if (convId) updateMessage(convId, messageId, { reactions });
    };
    socket.on('reaction_updated', reactionHandler);

    const callIncomingHandler = ({ from, offer, callType: ct, conversationId: cid }: any) => {
      if (cid !== currentConversationId) return;
      const conv = useChatStore.getState().conversations.find((c) => c.id === cid);
      const caller = conv?.participants.find((p) => p.user.id === from)?.user;
      setCallState({ type: ct, incoming: true, callerName: displayName(caller), offer });
    };
    socket.on('call_incoming', callIncomingHandler);

    return () => {
      socket.off('new_message', handler);
      socket.off('message_edited', editedHandler);
      socket.off('user_typing', typingHandler);
      socket.off('user_stopped_typing', stopTypingHandler);
      socket.off('message_deleted', deletedHandler);
      socket.off('reaction_updated', reactionHandler);
      socket.off('call_incoming', callIncomingHandler);
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

  useEffect(() => {
    setShowGroupPanel(false);
    setWhisperMode(false);
    setWhisperTargets([]);
    setAiSuggestions([]);
    setTypingUsers({});
    setReplyTo(null);
    setEditingMsgId(null);
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setPinnedMessages([]);
    setShowPinned(false);
  }, [currentConversationId]);

  // Request notification permission
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ── Helpers ──
  const currentMessages = useMemo(
    () => (currentConversationId ? messagesByConversationId[currentConversationId] ?? [] : []),
    [currentConversationId, messagesByConversationId],
  );
  const currentPagination = currentConversationId ? paginationByConversationId[currentConversationId] : null;
  const currentConv = conversations.find((c) => c.id === currentConversationId);

  const getOtherUser = useCallback(
    (conv: any) => conv.type === 'GROUP' ? null : conv.participants.find((p: any) => p.user.id !== currentUser?.id)?.user || null,
    [currentUser],
  );

  const getTitle = useCallback(
    (conv: any) => {
      if (conv.type === 'GROUP') return conv.name || 'Groupe';
      const other = getOtherUser(conv);
      return other ? (aliasMap[other.id] || displayName(other)) : 'Conversation';
    },
    [aliasMap, getOtherUser],
  );

  // ── Load more (pagination) ──
  const handleLoadMore = async () => {
    if (!currentConversationId || loadingMore || !currentPagination?.hasMore) return;
    const savedScrollHeight = scrollContainerRef.current?.scrollHeight ?? 0;
    setLoadingMore(true);
    try {
      const res = await api.get(`/conversations/${currentConversationId}/messages`, {
        params: { cursor: currentPagination.nextCursor, limit: 50 },
      });
      prependMessages(currentConversationId, res.data.messages, { nextCursor: res.data.nextCursor, hasMore: res.data.hasMore });
      // Preserve scroll position
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          const newScrollHeight = scrollContainerRef.current.scrollHeight;
          scrollContainerRef.current.scrollTop = newScrollHeight - savedScrollHeight;
        }
      });
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  };

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
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    if (!content) setNewMessage('');
    setReplyTo(null);
    setAiSuggestions([]);
    if (socket && currentConversationId) socket.emit('typing_stop', { conversationId: currentConversationId });
  };

  // ── Delete ──
  const handleDeleteMsg = (messageId: string) => {
    if (!socket) return;
    socket.emit('delete_message', { messageId });
    setHoveredMsgId(null);
  };

  // ── Edit ──
  const startEdit = (msg: any) => {
    setEditingMsgId(msg.id);
    setEditContent(msg.content);
    setHoveredMsgId(null);
    setTimeout(() => editInputRef.current?.focus(), 50);
  };

  const submitEdit = () => {
    if (!socket || !editingMsgId || !editContent.trim()) return;
    socket.emit('edit_message', { messageId: editingMsgId, content: editContent.trim() });
    setEditingMsgId(null);
    setEditContent('');
  };

  // ── React ──
  const handleReact = (messageId: string, emoji: string) => {
    if (!socket) return;
    socket.emit('add_reaction', { messageId, emoji });
    setReactionPickerMsgId(null);
  };

  // ── Pin ──
  const handlePin = async (messageId: string) => {
    if (!currentConversationId) return;
    try {
      const res = await api.post(`/conversations/${currentConversationId}/messages/${messageId}/pin`);
      setPinnedMessages((prev) => {
        const filtered = prev.filter((p) => p.messageId !== messageId);
        return [res.data, ...filtered];
      });
      toast('Message épinglé', 'success');
    } catch { toast('Erreur lors de l\'épinglage', 'error'); }
    setHoveredMsgId(null);
  };

  const handleUnpin = async (messageId: string) => {
    if (!currentConversationId) return;
    try {
      await api.delete(`/conversations/${currentConversationId}/messages/${messageId}/pin`);
      setPinnedMessages((prev) => prev.filter((p) => p.messageId !== messageId));
      toast('Message désépinglé', 'info');
    } catch { /* ignore */ }
  };

  // ── Search ──
  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim() || !currentConversationId) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get(`/conversations/${currentConversationId}/messages/search`, { params: { q } });
      setSearchResults(res.data);
    } catch { /* ignore */ }
    finally { setSearching(false); }
  };

  // ── Mention ──
  const insertMention = (nickname: string) => {
    setNewMessage((m) => m + `@${nickname} `);
    inputRef.current?.focus();
  };

  // ── File upload (réel) ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !currentConversationId) return;
    if (file.size > 50 * 1024 * 1024) { toast('Fichier trop lourd (max 50 Mo)', 'error'); return; }
    try {
      toast('Upload en cours...', 'info');
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      socket.emit('send_message', {
        conversationId: currentConversationId,
        content: '',
        fileUrl: res.data.url,
        fileName: res.data.name,
        fileType: res.data.type,
        ...(replyTo ? { replyToId: replyTo.id } : {}),
      });
      setReplyTo(null);
      toast('Fichier envoyé', 'success');
    } catch { toast('Erreur lors de l\'envoi', 'error'); }
    e.target.value = '';
  };

  // ── Voice recording ──
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) return;
        const file = new File([blob], `vocal-${Date.now()}.webm`, { type: 'audio/webm' });
        const form = new FormData();
        form.append('file', file);
        try {
          const res = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
          socket?.emit('send_message', {
            conversationId: currentConversationId,
            content: '',
            fileUrl: res.data.url,
            fileName: res.data.name,
            fileType: res.data.type,
          });
        } catch { toast('Erreur envoi vocal', 'error'); }
      };
      mr.start();
      voiceRef.current = mr;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimer.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch { toast('Micro non disponible', 'error'); }
  };

  const stopRecording = () => {
    voiceRef.current?.stop();
    voiceRef.current = null;
    setIsRecording(false);
    if (recordingTimer.current) clearInterval(recordingTimer.current);
  };

  // ── Alias ──
  const openAliasEdit = () => {
    if (!currentConv || currentConv.type === 'GROUP') return;
    const other = getOtherUser(currentConv);
    if (!other) return;
    setAliasInput(aliasMap[other.id] || displayName(other));
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
    const [convs, detail] = await Promise.all([api.get('/conversations'), api.get(`/conversations/${currentConv.id}`)]);
    setConversations(convs.data);
    setGroupDetail(detail.data);
  };

  // ── Groupe sidebar ──
  const handleGroupCreated = async (conversationId: string) => {
    const convs = await api.get('/conversations');
    setConversations(convs.data);
    setCurrentConversationId(conversationId);
    setShowCreateGroup(false);
  };

  // ── Call ──
  const startCall = (type: 'audio' | 'video') => {
    if (!currentConv) return;
    setCallState({ type, incoming: false });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const convPlaceholder = currentConv?.type === 'GROUP'
    ? `Envoyer un message dans ${getTitle(currentConv)}`
    : currentConv ? `Message à ${getTitle(currentConv)}` : 'Écrire un message...';

  const removeToast = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastProvider setToasts={setToasts}>
      <div className="flex w-full h-full overflow-hidden" style={{ color: 'var(--sat-text)' }}>

        {/* ── COL 1 : Liste conversations ── */}
        <aside className="flex flex-col flex-shrink-0" style={{ width: 240, background: 'var(--sat-panel)', borderRight: '1px solid var(--sat-border)' }}>
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sat-border)' }}>
            <span className="text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--sat-muted)' }}>Messages</span>
            <button onClick={() => setShowCreateGroup(true)} title="Nouveau groupe"
              className="w-6 h-6 flex items-center justify-center rounded-lg transition"
              style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'var(--sat-accent)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sat-muted)'; e.currentTarget.style.background = 'var(--sat-hover)'; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          </div>

          {/* Recherche */}
          <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--sat-border)' }}>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--sat-faint)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              </span>
              <input type="text" value={convSearch} onChange={(e) => setConvSearch(e.target.value)}
                placeholder="Rechercher..."
                className="w-full rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none"
                style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2">
            {loadingConvs && <div className="flex justify-center py-10"><Spinner size={20} /></div>}
            {!loadingConvs && conversations.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs" style={{ color: 'var(--sat-faint)' }}>Aucune conversation.<br/>Ajoute des amis pour commencer.</p>
              </div>
            )}
            {conversations
              .filter((conv) => !convSearch.trim() || getTitle(conv).toLowerCase().includes(convSearch.toLowerCase()))
              .map((conv) => {
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
                  onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'var(--sat-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--sat-text)'; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = unread > 0 ? 'var(--sat-text)' : 'var(--sat-muted)'; } }}>
                  <div className="relative flex-shrink-0">
                    {conv.type === 'GROUP'
                      ? <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold overflow-hidden flex-shrink-0" style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                          {(conv as any).image ? <img src={(conv as any).image} className="w-full h-full object-cover" alt="" /> : title.charAt(0).toUpperCase()}
                        </div>
                      : <Avatar user={otherUser || {}} size="xs" className="w-8 h-8 flex-shrink-0" />}
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
                      style={{ background: conv.type === 'GROUP' ? 'transparent' : online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '2px solid var(--sat-panel)', display: conv.type === 'GROUP' ? 'none' : 'block' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cx('text-[13px] truncate', unread > 0 ? 'font-bold' : 'font-medium')}>{title}</span>
                      {unread > 0 && (
                        <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full text-[9px] font-black flex items-center justify-center text-white px-1" style={{ background: 'var(--sat-dnd)' }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                    {preview && <p className="text-[11px] truncate" style={{ color: 'var(--sat-faint)' }}>{preview}</p>}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── COL 2 : Zone principale ── */}
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
              {/* ── Header ── */}
              <div className="h-12 px-4 flex items-center gap-3 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-main)', boxShadow: '0 1px 0 var(--sat-border)' }}>
                {currentConv && (() => {
                  const otherUser = getOtherUser(currentConv);
                  const online = otherUser ? isOnline(otherUser.id) : false;
                  return (
                    <>
                      <button onClick={currentConv.type === 'GROUP' ? openGroupPanel : undefined}
                        className={cx('relative flex-shrink-0', currentConv.type === 'GROUP' ? 'cursor-pointer' : 'cursor-default')}>
                        {currentConv.type === 'GROUP'
                          ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold overflow-hidden" style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                              {(currentConv as any).image ? <img src={(currentConv as any).image} className="w-full h-full object-cover" alt="" /> : getTitle(currentConv).charAt(0).toUpperCase()}
                            </div>
                          : <Avatar user={otherUser || {}} size="xs" className="w-7 h-7" />}
                        {currentConv.type === 'DM' && (
                          <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full" style={{ background: online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '1.5px solid var(--sat-main)' }} />
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
                          {currentConv.type === 'GROUP' ? `— ${currentConv.participants.length} membres` : online ? '— En ligne' : '— Hors ligne'}
                        </span>
                      </div>

                      {/* Header actions */}
                      <div className="flex items-center gap-0.5 flex-shrink-0">
                        {/* Recherche */}
                        <button onClick={() => setShowSearch((v) => !v)} title="Rechercher"
                          className="w-8 h-8 rounded flex items-center justify-center transition"
                          style={{ color: showSearch ? 'var(--sat-accent)' : 'var(--sat-muted)', background: showSearch ? 'rgba(37,99,235,0.1)' : 'transparent' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = showSearch ? 'var(--sat-accent)' : 'var(--sat-muted)')}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                        </button>
                        {/* Épinglés */}
                        {pinnedMessages.length > 0 && (
                          <button onClick={() => setShowPinned((v) => !v)} title={`${pinnedMessages.length} message(s) épinglé(s)`}
                            className="w-8 h-8 rounded flex items-center justify-center transition"
                            style={{ color: showPinned ? 'var(--sat-accent)' : 'var(--sat-muted)', background: showPinned ? 'rgba(37,99,235,0.1)' : 'transparent' }}>
                            <PinIcon size={16} />
                          </button>
                        )}
                        {/* Appel audio */}
                        <button onClick={() => startCall('audio')} title="Appel audio"
                          className="w-8 h-8 rounded flex items-center justify-center transition"
                          style={{ color: 'var(--sat-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                          <PhoneIcon size={17} />
                        </button>
                        {/* Appel vidéo */}
                        <button onClick={() => startCall('video')} title="Appel vidéo"
                          className="w-8 h-8 rounded flex items-center justify-center transition"
                          style={{ color: 'var(--sat-muted)' }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                          <VideoIcon size={18} />
                        </button>
                        {/* Panel groupe */}
                        {currentConv.type === 'GROUP' && (
                          <button onClick={openGroupPanel} title="Infos du groupe"
                            className="w-8 h-8 rounded flex items-center justify-center transition"
                            style={{ color: 'var(--sat-muted)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                              <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── Barre de recherche ── */}
              {showSearch && (
                <div className="px-4 py-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-surface)' }}>
                  <div className="relative">
                    <input
                      autoFocus
                      type="text"
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Rechercher dans la conversation..."
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={{ background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }}
                    />
                    {searching && <div className="absolute right-3 top-2.5"><Spinner size={16} /></div>}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                      {searchResults.map((msg) => (
                        <div key={msg.id} className="px-3 py-2 rounded-lg text-xs cursor-pointer transition"
                          style={{ background: 'var(--sat-hover)', color: 'var(--sat-text)' }}
                          onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
                          <span className="font-bold mr-2" style={{ color: 'var(--sat-accent)' }}>{displayName(msg.sender)}</span>
                          {msg.content}
                          <span className="ml-2 opacity-50">{formatTime(msg.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery && !searching && searchResults.length === 0 && (
                    <p className="mt-2 text-xs text-center" style={{ color: 'var(--sat-faint)' }}>Aucun résultat</p>
                  )}
                </div>
              )}

              {/* ── Messages épinglés ── */}
              {showPinned && pinnedMessages.length > 0 && (
                <div className="flex-shrink-0 px-4 py-2" style={{ borderBottom: '1px solid var(--sat-border)', background: 'rgba(37,99,235,0.04)' }}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--sat-accent)' }}><PinIcon size={13} /> Messages épinglés</span>
                    <button onClick={() => setShowPinned(false)} className="text-xs" style={{ color: 'var(--sat-faint)' }}>✕</button>
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {pinnedMessages.map((p) => (
                      <div key={p.id} className="flex items-start gap-2 px-2 py-1.5 rounded-lg text-xs" style={{ background: 'var(--sat-hover)' }}>
                        <div className="flex-1 min-w-0">
                          <span className="font-bold mr-1.5" style={{ color: 'var(--sat-accent)' }}>{displayName(p.message?.sender)}</span>
                          <span className="truncate" style={{ color: 'var(--sat-text)' }}>{p.message?.fileUrl ? '📎 Fichier' : p.message?.content}</span>
                        </div>
                        <button onClick={() => handleUnpin(p.messageId)} className="flex-shrink-0 opacity-40 hover:opacity-100 transition text-[10px]" style={{ color: 'var(--sat-muted)' }}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Messages ── */}
              <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5">
                {error && (
                  <div className="mx-1 mb-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
                    ⚠ {error}
                  </div>
                )}

                {/* Load more */}
                {currentPagination?.hasMore && (
                  <div className="flex justify-center pb-3">
                    <button onClick={handleLoadMore} disabled={loadingMore}
                      className="px-4 py-1.5 rounded-full text-xs font-medium transition disabled:opacity-50"
                      style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}>
                      {loadingMore ? <Spinner size={14} /> : 'Charger les messages précédents'}
                    </button>
                  </div>
                )}

                {loadingMsgs && <div className="flex justify-center py-10"><Spinner size={22} /></div>}

                {!loadingMsgs && currentMessages.length === 0 && (
                  <div className="px-4 py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-3xl" style={{ background: 'var(--sat-surface)' }}>
                      {currentConv?.type === 'GROUP' ? '👥' : '👋'}
                    </div>
                    <p className="font-bold text-base mb-1">Début de votre conversation</p>
                    <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>
                      Envoie le premier message à <strong>{currentConv ? getTitle(currentConv) : ''}</strong> !
                    </p>
                  </div>
                )}

                {currentMessages.map((msg: any, i: number) => {
                  if (msg.type === 'SYSTEM') {
                    return (
                      <div key={msg.id} className="flex items-center justify-center gap-2 my-2 px-4">
                        <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
                        <span className="text-[11px] px-3 py-1 rounded-full text-center" style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)', whiteSpace: 'nowrap' }}>
                          <strong style={{ color: 'var(--sat-text)' }}>{displayName(msg.sender)}</strong>{' '}{msg.content}
                        </span>
                        <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
                      </div>
                    );
                  }

                  const isMe = msg.sender.id === currentUser?.id;
                  const isDeleted = !!msg.deletedAt;
                  const isEditing = editingMsgId === msg.id;
                  const prevMsg = currentMessages[i - 1] as any;
                  const nextMsg = currentMessages[i + 1] as any;
                  const samePrev = prevMsg?.type !== 'SYSTEM' && prevMsg?.sender?.id === msg.sender.id && new Date(msg.createdAt).getTime() - new Date(prevMsg?.createdAt ?? 0).getTime() < 300000;
                  const sameNext = nextMsg?.type !== 'SYSTEM' && nextMsg?.sender?.id === msg.sender.id && new Date(nextMsg?.createdAt ?? 0).getTime() - new Date(msg.createdAt).getTime() < 300000;
                  const isHovered = hoveredMsgId === msg.id;
                  const showReactionPicker = reactionPickerMsgId === msg.id;
                  const MEMBER_COLORS = ['#2563EB','#7C3AED','#DB2777','#DC2626','#D97706','#059669','#0891B2','#C2410C'];
                  let nameColorHash = 0;
                  for (const ch of (msg.sender.id || '')) nameColorHash = ((nameColorHash << 5) - nameColorHash) + ch.charCodeAt(0);
                  const nameColor = MEMBER_COLORS[Math.abs(nameColorHash) % MEMBER_COLORS.length];
                  const reactionGroups: Record<string, any[]> = {};
                  for (const r of (msg.reactions || [])) {
                    if (!reactionGroups[r.emoji]) reactionGroups[r.emoji] = [];
                    reactionGroups[r.emoji].push(r);
                  }
                  const QUICK_EMOJIS = ['❤️','😂','👍','😮','😢','🙏'];
                  const isPinned = pinnedMessages.some((p) => p.messageId === msg.id);
                  const isRead = msg.readBy?.some((r: any) => r.userId !== currentUser?.id);

                  return (
                    <div key={msg.id}
                      className={cx('flex items-end gap-2', isMe ? 'justify-end' : 'justify-start', samePrev ? 'mt-0.5' : 'mt-3')}
                      onMouseEnter={() => setHoveredMsgId(msg.id)}
                      onMouseLeave={() => { setHoveredMsgId(null); if (reactionPickerMsgId === msg.id) setReactionPickerMsgId(null); }}>

                      {!isMe && (
                        <div className="w-8 flex-shrink-0 self-end mb-0.5">
                          {!sameNext ? <Avatar user={msg.sender} size="xs" className="w-8 h-8" /> : <div className="w-8 h-8" />}
                        </div>
                      )}

                      <div className={cx('flex flex-col max-w-[68%] relative', isMe ? 'items-end' : 'items-start')}>
                        {!isMe && !samePrev && currentConv?.type === 'GROUP' && (
                          <span className="text-[11px] font-bold px-1 mb-0.5" style={{ color: nameColor }}>
                            {aliasMap[msg.sender.id] || displayName(msg.sender)}
                          </span>
                        )}

                        {msg.isWhisper && !isDeleted && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 flex items-center gap-1" style={{ background: 'rgba(37,99,235,0.1)', color: 'var(--sat-accent)' }}>
                            🤫 chuchoté
                          </span>
                        )}

                        {isPinned && (
                          <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded mb-1" style={{ background: 'rgba(37,99,235,0.06)', color: 'var(--sat-accent)' }}>
                            <PinIcon size={10} /> épinglé
                          </span>
                        )}

                        <div className="relative">
                          {/* Menu contextuel */}
                          {isHovered && !isDeleted && !isEditing && (
                            <div className={cx('absolute -top-9 flex items-center gap-0.5 z-20 rounded-xl shadow-lg px-1 py-1', isMe ? 'right-0' : 'left-0')}
                              style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                              {/* Réagir */}
                              <div className="relative">
                                <button onClick={() => setReactionPickerMsgId(showReactionPicker ? null : msg.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-[var(--sat-hover)] transition" title="Réagir"
                                  style={{ color: 'var(--sat-muted)' }}><SmileyIcon size={16} /></button>
                                {showReactionPicker && (
                                  <div className={cx('absolute bottom-9 flex gap-0.5 p-1.5 rounded-xl shadow-xl z-30', isMe ? 'right-0' : 'left-0')}
                                    style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                                    {QUICK_EMOJIS.map((e) => (
                                      <button key={e} onClick={() => handleReact(msg.id, e)}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-[var(--sat-hover)] transition text-lg">{e}</button>
                                    ))}
                                  </div>
                                )}
                              </div>
                              {/* Répondre */}
                              <button onClick={() => { setReplyTo(msg); setHoveredMsgId(null); inputRef.current?.focus(); }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--sat-hover)]"
                                title="Répondre" style={{ color: 'var(--sat-muted)' }}>
                                <ReplyIcon size={15} strokeWidth={2.5} />
                              </button>
                              {/* Épingler */}
                              {!isPinned ? (
                                <button onClick={() => handlePin(msg.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--sat-hover)]"
                                  title="Épingler" style={{ color: 'var(--sat-muted)' }}><PinIcon size={15} /></button>
                              ) : (
                                <button onClick={() => handleUnpin(msg.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--sat-hover)]"
                                  title="Désépingler" style={{ color: 'var(--sat-accent)' }}><PinIcon size={15} /></button>
                              )}
                              {/* Copier */}
                              {msg.content && (
                                <button onClick={() => { navigator.clipboard.writeText(msg.content); setHoveredMsgId(null); toast('Copié !', 'success'); }}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--sat-hover)]"
                                  title="Copier" style={{ color: 'var(--sat-muted)' }}>
                                  <CopyIcon size={14} strokeWidth={2.5} />
                                </button>
                              )}
                              {/* Modifier (seulement mes messages) */}
                              {isMe && msg.type !== 'SYSTEM' && (
                                <button onClick={() => startEdit(msg)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition hover:bg-[var(--sat-hover)]"
                                  title="Modifier" style={{ color: 'var(--sat-muted)' }}>
                                  <EditIcon size={14} strokeWidth={2.5} />
                                </button>
                              )}
                              {/* Supprimer */}
                              {(isMe || currentConv?.participants?.find((p: any) => p.user.id === currentUser?.id && p.role === 'ADMIN')) && (
                                <button onClick={() => handleDeleteMsg(msg.id)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center transition"
                                  title="Supprimer" style={{ color: '#EF4444' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                                  <TrashIcon size={14} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          )}

                          {/* Citation réponse */}
                          {msg.replyTo && !isDeleted && (
                            <div className="flex items-start gap-2 px-2.5 py-1.5 mb-0.5 cursor-pointer"
                              style={{ background: isMe ? 'rgba(37,99,235,0.15)' : 'var(--sat-hover)', borderLeft: `3px solid ${isMe ? 'var(--sat-accent2)' : 'var(--sat-accent)'}`, borderRadius: '10px 10px 0 0' }}>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold mb-0.5" style={{ color: isMe ? 'var(--sat-accent2)' : 'var(--sat-accent)' }}>
                                  {displayName(msg.replyTo.sender)}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: 'var(--sat-muted)' }}>
                                  {msg.replyTo.deletedAt ? '🚫 Message supprimé' : msg.replyTo.fileUrl ? `📎 ${msg.replyTo.fileName}` : msg.replyTo.content}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Mode édition inline */}
                          {isEditing ? (
                            <div className="flex items-center gap-2 w-full min-w-[220px]">
                              <input ref={editInputRef} type="text" value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingMsgId(null); }}
                                className="flex-1 px-3 py-1.5 rounded-xl text-sm focus:outline-none"
                                style={{ background: 'var(--sat-surface)', border: '1.5px solid var(--sat-accent)', color: 'var(--sat-text)' }} />
                              <button onClick={submitEdit} className="px-2.5 py-1 rounded-lg text-xs font-bold text-white transition" style={{ background: 'var(--sat-accent)' }}>✓</button>
                              <button onClick={() => setEditingMsgId(null)} className="px-2 py-1 rounded-lg text-xs" style={{ color: 'var(--sat-muted)' }}>✕</button>
                            </div>
                          ) : isDeleted ? (
                            <div className="px-3.5 py-2 text-sm italic" style={{ background: 'var(--sat-hover)', color: 'var(--sat-faint)', borderRadius: 18, border: '1px solid var(--sat-border)' }}>
                              🚫 Message supprimé
                            </div>
                          ) : msg.fileUrl ? (
                            <FilePreview url={msg.fileUrl} name={msg.fileName || ''} type={msg.fileType || ''} />
                          ) : (
                            <div className="px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm"
                              style={{
                                background: isMe ? 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))' : 'var(--sat-surface)',
                                color: isMe ? '#fff' : 'var(--sat-text)',
                                fontStyle: msg.isWhisper ? 'italic' : 'normal',
                                border: isMe ? 'none' : '1px solid var(--sat-border)',
                                borderRadius: 18,
                                borderTopRightRadius: isMe && (samePrev || msg.replyTo) ? 6 : 18,
                                borderBottomRightRadius: isMe && sameNext ? 6 : 18,
                                borderTopLeftRadius: !isMe && (samePrev || msg.replyTo) ? 6 : 18,
                                borderBottomLeftRadius: !isMe && sameNext ? 6 : 18,
                              }}>
                              {msg.content}
                            </div>
                          )}

                          {/* Réactions */}
                          {Object.keys(reactionGroups).length > 0 && (
                            <div className={cx('flex flex-wrap gap-1 mt-1', isMe ? 'justify-end' : 'justify-start')}>
                              {Object.entries(reactionGroups).map(([emoji, users]) => {
                                const isMine = users.some((u: any) => u.userId === currentUser?.id);
                                return (
                                  <button key={emoji} onClick={() => handleReact(msg.id, emoji)}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition"
                                    style={{ background: isMine ? 'rgba(37,99,235,0.12)' : 'var(--sat-hover)', border: `1px solid ${isMine ? 'var(--sat-accent)' : 'var(--sat-border)'}` }}
                                    title={users.map((u: any) => displayName(u.user)).join(', ')}>
                                    {emoji} <span style={{ color: isMine ? 'var(--sat-accent)' : 'var(--sat-muted)', fontWeight: 600 }}>{users.length}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Heure + statut */}
                        {!sameNext && !isEditing && (
                          <span className="text-[10px] px-1 mt-0.5 flex items-center gap-1" style={{ color: 'var(--sat-faint)' }}>
                            {msg.editedAt && <span className="italic">modifié ·</span>}
                            {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            {isMe && !isDeleted && (
                              <span style={{ color: isRead ? '#60A5FA' : 'var(--sat-faint)' }}>
                                {isRead ? '✓✓' : '✓'}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* ── Zone de saisie ── */}
              <div className="px-4 pb-6 pt-0 flex-shrink-0">
                {/* Barre de réponse */}
                {replyTo && (
                  <div className="flex items-center gap-3 px-3 py-2 mb-1.5 rounded-xl" style={{ background: 'var(--sat-hover)', border: '1px solid var(--sat-border-2)' }}>
                    <div className="w-0.5 self-stretch rounded-full" style={{ background: 'var(--sat-accent)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold mb-0.5" style={{ color: 'var(--sat-accent)' }}>
                        Réponse à {displayName(replyTo.sender)}
                      </p>
                      <p className="text-xs truncate" style={{ color: 'var(--sat-muted)' }}>
                        {replyTo.fileUrl ? `📎 ${replyTo.fileName}` : replyTo.content}
                      </p>
                    </div>
                    <button onClick={() => setReplyTo(null)} className="w-6 h-6 flex-shrink-0 rounded-full flex items-center justify-center transition"
                      style={{ color: 'var(--sat-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-active)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>✕</button>
                  </div>
                )}

                {/* Indicateur vocal */}
                {isRecording && (
                  <div className="flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
                    <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: '#EF4444' }} />
                    <span className="text-xs font-medium" style={{ color: '#EF4444' }}>Enregistrement... {recordingTime}s</span>
                    <button onClick={stopRecording} className="ml-auto text-xs font-bold" style={{ color: '#EF4444' }}>Arrêter</button>
                  </div>
                )}

                {/* Typing indicator */}
                {Object.keys(typingUsers).length > 0 && (
                  <div className="flex items-center gap-1.5 px-1 mb-1">
                    <span className="flex gap-0.5">
                      {[0,1,2].map((k) => (
                        <span key={k} className="w-1 h-1 rounded-full animate-bounce" style={{ background: 'var(--sat-muted)', animationDelay: `${k*0.15}s` }} />
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
                        style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.25)', color: 'var(--sat-text)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.25)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(37,99,235,0.1)')}>
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
                        style={{ background: whisperTargets.includes(p.user.id) ? 'rgba(37,99,235,0.25)' : 'var(--sat-surface)', border: `1px solid ${whisperTargets.includes(p.user.id) ? 'rgba(37,99,235,0.4)' : 'var(--sat-border-2)'}`, color: whisperTargets.includes(p.user.id) ? 'var(--sat-text)' : 'var(--sat-muted)' }}>
                        {displayName(p.user)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input bar */}
                <div className="flex items-center rounded-xl gap-1 px-3"
                  style={{ background: 'var(--sat-surface)', border: whisperMode ? '1.5px solid var(--sat-accent)' : '1.5px solid var(--sat-border-2)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>

                  <input ref={inputRef} type="text" value={newMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { handleSend(); setShowEmoji(false); } }}
                    placeholder={whisperMode ? '🤫 Message chuchoté...' : convPlaceholder}
                    className="flex-1 py-3 text-sm bg-transparent focus:outline-none"
                    style={{ color: 'var(--sat-text)', minWidth: 0 }}
                  />

                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    {/* @ mention */}
                    {currentConv?.type === 'GROUP' && (
                      <button title="Mentionner"
                        onClick={() => { const nick = currentConv.participants.find((p: any) => p.user.id !== currentUser?.id)?.user; if (nick) insertMention(displayName(nick)); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition text-sm font-bold"
                        style={{ color: 'var(--sat-faint)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sat-accent)'; e.currentTarget.style.background = 'var(--sat-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sat-faint)'; e.currentTarget.style.background = 'transparent'; }}>
                        @
                      </button>
                    )}
                    {/* Whisper */}
                    {currentConv?.type === 'GROUP' && (
                      <button title="Message chuchoté"
                        onClick={() => { setWhisperMode((v) => !v); setWhisperTargets([]); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition text-base"
                        style={{ color: whisperMode ? 'var(--sat-accent)' : 'var(--sat-faint)', background: whisperMode ? 'rgba(37,99,235,0.1)' : 'transparent' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--sat-hover)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = whisperMode ? 'rgba(37,99,235,0.1)' : 'transparent'; }}>
                        🤫
                      </button>
                    )}
                    {/* Emoji */}
                    <div className="relative">
                      <button onClick={() => setShowEmoji((v) => !v)} title="Émojis"
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition"
                        style={{ color: showEmoji ? 'var(--sat-accent)' : 'var(--sat-faint)', background: showEmoji ? 'rgba(37,99,235,0.1)' : 'transparent' }}
                        onMouseEnter={(e) => { if (!showEmoji) e.currentTarget.style.background = 'var(--sat-hover)'; }}
                        onMouseLeave={(e) => { if (!showEmoji) e.currentTarget.style.background = 'transparent'; }}>
                        <SmileyIcon size={19} />
                      </button>
                      {showEmoji && <EmojiPicker onSelect={(e) => setNewMessage((m) => m + e)} onClose={() => setShowEmoji(false)} />}
                    </div>
                    {/* Pièce jointe */}
                    <button onClick={() => fileInputRef.current?.click()} title="Joindre un fichier"
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition"
                      style={{ color: 'var(--sat-faint)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--sat-accent)'; e.currentTarget.style.background = 'var(--sat-hover)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--sat-faint)'; e.currentTarget.style.background = 'transparent'; }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </button>
                    <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />
                    {/* Message vocal */}
                    <button
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      onTouchStart={startRecording}
                      onTouchEnd={stopRecording}
                      title="Maintenir pour enregistrer un vocal"
                      className="w-8 h-8 flex items-center justify-center rounded-lg transition"
                      style={{ color: isRecording ? '#EF4444' : 'var(--sat-faint)', background: isRecording ? 'rgba(239,68,68,0.1)' : 'transparent' }}
                      onMouseEnter={(e) => { if (!isRecording) { e.currentTarget.style.color = 'var(--sat-accent)'; e.currentTarget.style.background = 'var(--sat-hover)'; } }}
                      onMouseLeave={(e) => { if (!isRecording) { e.currentTarget.style.color = 'var(--sat-faint)'; e.currentTarget.style.background = 'transparent'; } }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    </button>
                    {/* Séparateur + Envoyer */}
                    <span className="w-px h-5 mx-1 flex-shrink-0" style={{ background: 'var(--sat-border-2)' }} />
                    <button onClick={() => handleSend()} title="Envoyer"
                      disabled={!newMessage.trim()}
                      className="w-8 h-8 rounded-lg flex items-center justify-center transition"
                      style={{ background: newMessage.trim() ? 'var(--sat-accent)' : 'var(--sat-hover)', color: newMessage.trim() ? '#fff' : 'var(--sat-faint)' }}
                      onMouseEnter={(e) => { if (newMessage.trim()) e.currentTarget.style.background = 'var(--sat-accent2)'; }}
                      onMouseLeave={(e) => { if (newMessage.trim()) e.currentTarget.style.background = 'var(--sat-accent)'; }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </button>
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
            onLeft={async () => { const res = await api.get('/conversations'); setConversations(res.data); setCurrentConversationId(res.data[0]?.id ?? null); }}
            onDeleted={async () => { const res = await api.get('/conversations'); setConversations(res.data); setCurrentConversationId(res.data[0]?.id ?? null); }}
          />
        )}

        {/* ── Appel WebRTC ── */}
        {callState && socket && currentConversationId && (
          <CallModal
            socket={socket}
            conversationId={currentConversationId}
            callType={callState.type}
            isIncoming={callState.incoming}
            callerName={callState.callerName}
            incomingOffer={callState.offer}
            onClose={() => setCallState(null)}
          />
        )}

        {/* ── Modale création de groupe ── */}
        {showCreateGroup && (
          <CreateGroupModal
            friends={friends}
            onClose={() => setShowCreateGroup(false)}
            onCreated={handleGroupCreated}
          />
        )}

        {/* ── Toasts ── */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    </ToastProvider>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<PageLoader label="Chargement des messages..." />}>
      <ChatPageContent />
    </Suspense>
  );
}
