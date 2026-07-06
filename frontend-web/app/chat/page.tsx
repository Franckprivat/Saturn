'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useChatStore } from '@/store/chatStore';
import { usePresenceStore, formatLastSeen } from '@/store/presenceStore';
import { useChatSocket } from '@/hooks/useChatSocket';
import { api } from '@/lib/api';
import { useRouter, useSearchParams } from 'next/navigation';
import { Avatar } from '@/components/Avatar';
import { EmojiPicker } from '@/components/EmojiPicker';
import { GroupPanel } from '@/components/GroupPanel';
import { Spinner, PageLoader } from '@/components/Spinner';
import { FilePreview } from '@/components/media/FilePreview';
import { ImageSendModal, type UploadedFileInfo } from '@/components/media/ImageSendModal';
import { mediaUrl } from '@/lib/media';
import { useCallStore } from '@/store/callStore';
import { PhoneIcon, VideoIcon, MicIcon, TrashIcon, SendIcon, SmileyIcon } from '@/components/Icons';
import { WallpaperPicker } from '@/components/WallpaperPicker';
import { wallpaperStyle } from '@/lib/wallpapers';
import { ContactPanel } from '@/components/ContactPanel';
import { DeleteMessageDialog } from '@/components/DeleteMessageDialog';
import { bubbleGradient, getConvPrefs, type ConvPrefs } from '@/lib/convPrefs';
import { getHiddenMessageIds, hideMessageForMe } from '@/lib/hiddenMessages';

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

const QUICK_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

function getLocalAlias(myId: string, otherId: string) {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(`saturn_alias_${myId}_${otherId}`) || '';
}
function setLocalAlias(myId: string, otherId: string, name: string) {
  if (name.trim()) localStorage.setItem(`saturn_alias_${myId}_${otherId}`, name.trim());
  else localStorage.removeItem(`saturn_alias_${myId}_${otherId}`);
}

function CommunityInviteCard({ msg }: { msg: any }) {
  const router = useRouter();
  const meta = msg.metadata as { communityId: string; communityName: string; communityImage?: string | null; token?: string | null } | null;
  const [status, setStatus] = useState<'idle' | 'joining' | 'joined' | 'refused'>('idle');

  if (!meta?.communityName) return <div className="px-3.5 py-2 text-sm rounded-2xl" style={{ background: 'var(--sat-surface)', color: 'var(--sat-text)' }}>{msg.content}</div>;

  const handleJoin = async () => {
    if (!meta.token) return;
    setStatus('joining');
    try {
      const res = await api.post(`/communities/join/${meta.token}`);
      setStatus('joined');
      setTimeout(() => router.push(`/communities/${res.data.id}`), 600);
    } catch { setStatus('idle'); }
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

// ── Page principale ────────────────────────────────────────────────────────────

function ChatPageContent() {
  const searchParams = useSearchParams();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const {
    conversations, messagesByConversationId, paginationByConversationId, currentConversationId, unreadCounts,
    setConversations, setCurrentConversationId, setMessages, prependMessages,
  } = useChatStore();
  // Abonnement aux DONNÉES de présence (pas aux getters) → re-render garanti
  const onlineUserIds = usePresenceStore((s) => s.onlineUserIds);
  const lastSeenById = usePresenceStore((s) => s.lastSeenById);
  const isOnline = (userId: string) => onlineUserIds.has(userId);
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

  // Réponse / édition / réactions (parité avec les salons de communauté)
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

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

  // Panneau contact (DM) + préférences locales de la conversation
  const [showContactPanel, setShowContactPanel] = useState(false);
  const [convPrefs, setConvPrefsState] = useState<ConvPrefs>({});

  // Message vocal
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);

  // Appels (gérés globalement via le call store)
  const startCall = useCallStore((s) => s.startCall);

  // Fond d'écran de discussion (persisté dans le profil, façon WhatsApp)
  const [wallpaper, setWallpaper] = useState<string | null>(null);

  // ── Init ──
  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (data?.user) setCurrentUser(data.user);
    }).catch(() => {});
    api.get('/friends').then((r) => setFriends(r.data)).catch(() => {});
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
    const handler = (msg: any) => {
      // Effacer typing quand le message arrive
      setTypingUsers((prev) => { const n = { ...prev }; delete n[msg.sender?.id]; return n; });
      // Message reçu pendant qu'on lit la conversation → lu immédiatement
      if (msg.conversationId === currentConversationId && msg.sender?.id !== currentUser?.id) {
        socket.emit('mark_read', { conversationId: msg.conversationId });
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
    setWhisperMode(false);
    setWhisperTargets([]);
    setAiSuggestions([]);
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

  // ── Typing (émis une seule fois par salve de frappe, pas à chaque touche) ──
  const isTypingRef = useRef(false);
  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!socket || !currentConversationId) return;
    if (!isTypingRef.current) {
      socket.emit('typing_start', { conversationId: currentConversationId });
      isTypingRef.current = true;
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      socket.emit('typing_stop', { conversationId: currentConversationId });
      isTypingRef.current = false;
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
    if (socket && currentConversationId) {
      socket.emit('typing_stop', { conversationId: currentConversationId });
      isTypingRef.current = false;
    }
  };

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

  // Insertion @mention
  const insertMention = (nickname: string) => {
    setNewMessage((m) => m + `@${nickname} `);
    inputRef.current?.focus();
  };

  // ── Send file ──
  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !socket || !currentConversationId) return;
    // Image → prévisualisation avec compression + légende (façon WhatsApp)
    if (file.type.startsWith('image/')) { setPendingImage(file); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop lourd (max 10 Mo)'); return; }
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd);
      socket.emit('send_message', {
        conversationId: currentConversationId,
        content: '',
        fileUrl: res.data.url,
        fileName: res.data.name,
        fileType: res.data.type,
      });
    } catch { setError('Erreur lors de l\'envoi du fichier'); }
  };

  const sendUploadedImage = (up: UploadedFileInfo, caption: string) => {
    if (!socket || !currentConversationId) return;
    socket.emit('send_message', {
      conversationId: currentConversationId,
      content: caption,
      fileUrl: up.url,
      fileName: up.name,
      fileType: up.type,
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    setReplyTo(null);
  };

  // ── Suppression : pour moi (masquage local) / pour tous (serveur) ──
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
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

  // ── Messages vocaux (façon WhatsApp) ──
  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      discardRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (!currentConversationId || !socket) return;
        if (blob.size < 800) { setError('Message vocal trop court.'); return; }
        try {
          const fd = new FormData();
          const ext = mr.mimeType?.includes('mp4') ? 'mp4' : mr.mimeType?.includes('ogg') ? 'ogg' : 'webm';
          fd.append('file', blob, `voice-${Date.now()}.${ext}`);
          const res = await api.post('/upload', fd);
          // Pas de texte : le lecteur audio EST le message (l'aperçu de la
          // sidebar dérive « Message vocal » du type de fichier)
          socket.emit('send_message', {
            conversationId: currentConversationId,
            content: '',
            fileUrl: res.data.url,
            fileName: res.data.name,
            fileType: res.data.type,
          });
        } catch { setError('Erreur lors de l\'envoi du vocal'); }
      };
      // timeslice → des chunks sont produits régulièrement (fiable même pour les clips courts)
      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { setError('Micro inaccessible — autorise l\'accès au microphone.'); }
  };

  const finishRecording = (discard: boolean) => {
    discardRef.current = discard;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  };

  useEffect(() => () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); }, []);

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
            const filePreview = lastMsg?.fileUrl
              ? (lastMsg.fileType?.startsWith('audio/') ? 'Message vocal' : lastMsg.fileType?.startsWith('image/') ? 'Photo' : `${lastMsg.fileName || 'Fichier'}`)
              : null;
            const preview = lastMsg
              ? (filePreview ?? (lastMsg.sender.id === currentUser?.id ? `Vous : ${lastMsg.content}` : lastMsg.content))
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
                        {(conv as any).image ? <img src={mediaUrl((conv as any).image)} loading="lazy" className="w-full h-full object-cover" alt="" /> : title.charAt(0).toUpperCase()}
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
                      onClick={currentConv.type === 'GROUP' ? openGroupPanel : () => setShowContactPanel((v) => !v)}
                      className="relative flex-shrink-0 cursor-pointer"
                      title={currentConv.type === 'GROUP' ? 'Infos du groupe' : 'Infos du contact'}
                    >
                      {currentConv.type === 'GROUP'
                        ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold overflow-hidden"
                            style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                            {(currentConv as any).image ? <img src={mediaUrl((currentConv as any).image)} className="w-full h-full object-cover" alt="" /> : getTitle(currentConv).charAt(0).toUpperCase()}
                          </div>
                        : <Avatar user={otherUser || {}} size="xs" className="w-7 h-7" />}
                      {currentConv.type === 'DM' && (
                        <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                          style={{ background: online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '1.5px solid var(--sat-main)' }} />
                      )}
                    </button>

                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <button onClick={currentConv.type === 'GROUP' ? openGroupPanel : () => setShowContactPanel((v) => !v)}
                        className="text-[15px] font-bold truncate hover:opacity-80 transition"
                        title={currentConv.type === 'DM' ? 'Infos du contact' : 'Infos du groupe'}>
                        {getTitle(currentConv)}
                      </button>
                      <span className="text-xs" style={{ color: online ? 'var(--sat-online)' : 'var(--sat-faint)' }}>
                        {currentConv.type === 'GROUP'
                          ? `— ${currentConv.participants.length} membres`
                          : online
                            ? '— En ligne'
                            : `— ${formatLastSeen(lastSeenById[otherUser?.id ?? ''] ?? (otherUser as any)?.lastSeenAt) ?? 'Hors ligne'}`}
                      </span>
                    </div>

                    {/* Actions header */}
                    <div className="flex items-center gap-0.5">
                      <WallpaperPicker value={wallpaper} onChange={setWallpaper} />
                      {currentConv.type === 'DM' && (() => {
                        const peerName = getTitle(currentConv);
                        const peerImage = otherUser?.image;
                        const launch = (callType: 'audio' | 'video') => {
                          if (!currentConv) return;
                          startCall({ conversationId: currentConv.id, callType, peerName, peerImage });
                        };
                        return (
                          <>
                            <button onClick={() => launch('audio')} title="Appel audio"
                              className="w-8 h-8 rounded flex items-center justify-center transition"
                              style={{ color: 'var(--sat-muted)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                              <PhoneIcon size={16} />
                            </button>
                            <button onClick={() => launch('video')} title="Appel vidéo"
                              className="w-8 h-8 rounded flex items-center justify-center transition"
                              style={{ color: 'var(--sat-muted)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                              <VideoIcon size={16} />
                            </button>
                          </>
                        );
                      })()}
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
                    </div>
                  </>
                );
              })()}
            </div>

            {/* ── Messages — fond d'écran : préférence de la conversation, sinon global ── */}
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

              {currentMessages.filter((m: any) => !hiddenIds.has(m.id)).map((msg: any, i: number, visibleMessages: any[]) => {
                // Messages système (création du groupe, membres ajoutés, etc.)
                if (msg.type === 'SYSTEM') {
                  return (
                    <div key={msg.id} className="flex items-center justify-center gap-2 my-2">
                      <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
                      <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}>
                        <strong style={{ color: 'var(--sat-text)' }}>{msg.sender?.nickname || msg.sender?.email?.split('@')[0] || '?'}</strong> {msg.content}
                      </span>
                      <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
                    </div>
                  );
                }

                const isMe = msg.sender.id === currentUser?.id;
                const isDeleted = !!msg.deletedAt;
                const isEditing = editingId === msg.id;
                const prevMsg = visibleMessages[i - 1] as any;
                const nextMsg = visibleMessages[i + 1] as any;
                const samePrev = prevMsg?.type !== 'SYSTEM' && prevMsg?.sender.id === msg.sender.id && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;
                const sameNext = nextMsg?.type !== 'SYSTEM' && nextMsg?.sender.id === msg.sender.id && new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() < 300000;

                // Statuts réels façon WhatsApp :
                // ✓ envoyé → ✓✓ gris distribué (arrivé chez tous) → ✓✓ accent lu (par tous)
                const others = currentConv?.participants.filter((p: any) => p.user.id !== currentUser?.id) ?? [];
                const readers = new Set((msg.readBy ?? []).map((r: any) => r.userId));
                const receivers = new Set((msg.deliveredTo ?? []).map((d: any) => d.userId));
                const readByAll = others.length > 0 && others.every((o: any) => readers.has(o.user.id));
                const deliveredToAll = others.length > 0 &&
                  others.every((o: any) => receivers.has(o.user.id) || readers.has(o.user.id));

                // Regroupement des réactions par emoji
                const reactionGroups: Record<string, any[]> = {};
                for (const r of (msg.reactions || [])) { (reactionGroups[r.emoji] ??= []).push(r); }

                return (
                  <div key={msg.id} className={cx('group/msg flex items-end gap-2', isMe ? 'justify-end' : 'justify-start', samePrev ? 'mt-0.5' : 'mt-3')}>
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
                      {msg.isWhisper && !isDeleted && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded mb-1 flex items-center gap-1"
                          style={{ background: 'rgba(160,22,217,0.15)', color: 'var(--sat-accent)' }}>
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                          chuchoté
                        </span>
                      )}

                      {/* Message cité (réponse) */}
                      {msg.replyTo && !isDeleted && (
                        <div className="flex items-center gap-1.5 text-[11px] mb-0.5 px-2 py-1 rounded-lg max-w-full"
                          style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)', borderLeft: '2px solid var(--sat-accent)' }}>
                          <strong style={{ color: 'var(--sat-accent)' }}>
                            {msg.replyTo.sender?.nickname || msg.replyTo.sender?.email?.split('@')[0] || '?'}
                          </strong>
                          <span className="truncate">
                            {msg.replyTo.deletedAt ? 'message supprimé' : msg.replyTo.content || 'fichier'}
                          </span>
                        </div>
                      )}

                      {/* Bulle + actions */}
                      <div className={cx('flex items-center gap-1.5', isMe ? 'flex-row-reverse' : 'flex-row')}>
                        {/* Bulle */}
                        {isDeleted ? (
                          <div className="px-3.5 py-2 text-sm italic flex items-center gap-1.5"
                            style={{ background: 'var(--sat-hover)', borderRadius: 18, color: 'var(--sat-faint)', border: '1px solid var(--sat-border-2)' }}>
                            Message supprimé
                          </div>
                        ) : isEditing ? (
                          <div className="flex items-center gap-2" style={{ minWidth: 220 }}>
                            <input autoFocus value={editContent} onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                              className="flex-1 px-3 py-1.5 rounded-xl text-sm focus:outline-none"
                              style={{ background: 'var(--sat-surface)', border: '1.5px solid var(--sat-accent)', color: 'var(--sat-text)' }} />
                            <button onClick={submitEdit} className="text-xs font-bold" style={{ color: 'var(--sat-accent)' }}>✓</button>
                            <button onClick={() => setEditingId(null)} className="text-xs" style={{ color: 'var(--sat-muted)' }}>✕</button>
                          </div>
                        ) : msg.type === 'INVITE' || msg.metadata?.communityName ? (
                          <CommunityInviteCard msg={msg} />
                        ) : msg.fileUrl ? (
                          <div className={cx('flex flex-col gap-1', isMe ? 'items-end' : 'items-start')}>
                            <FilePreview url={msg.fileUrl} name={msg.fileName} type={msg.fileType} mine={isMe} />
                            {/* Légende sous le média (façon WhatsApp) — jamais pour un vocal :
                                le lecteur audio EST le message */}
                            {msg.content && !msg.fileType?.startsWith('audio/') && (
                              <div className="px-3 py-1.5 text-sm leading-relaxed break-words rounded-2xl max-w-[240px]"
                                style={{
                                  background: isMe
                                    ? (bubbleGradient(convPrefs.bubble) ?? 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))')
                                    : 'var(--sat-surface)',
                                  color: isMe ? '#fff' : 'var(--sat-text)',
                                }}>
                                {msg.content}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div
                            className="px-3.5 py-2 text-sm leading-relaxed break-words shadow-sm"
                            style={{
                              background: isMe
                                ? (bubbleGradient(convPrefs.bubble) ?? 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))')
                                : 'var(--sat-surface)',
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
                            {msg.editedAt && (
                              <span className="text-[10px] ml-1.5" style={{ color: isMe ? 'rgba(255,255,255,0.65)' : 'var(--sat-faint)' }}>(modifié)</span>
                            )}
                          </div>
                        )}

                        {/* Actions au survol : réagir / répondre / modifier / supprimer */}
                        {!isDeleted && !isEditing && (
                          <div className="opacity-0 group-hover/msg:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0 rounded-lg px-0.5"
                            style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                            <div className="relative">
                              <button onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)}
                                className="w-6 h-6 rounded flex items-center justify-center text-[13px]"
                                style={{ color: 'var(--sat-muted)' }} title="Réagir"><SmileyIcon size={13} /></button>
                              {reactionPicker === msg.id && (
                                <div className={cx('absolute bottom-7 flex gap-0.5 p-1.5 rounded-xl shadow-xl z-30', isMe ? 'right-0' : 'left-0')}
                                  style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                                  {QUICK_REACTIONS.map((e) => (
                                    <button key={e} onClick={() => toggleReaction(msg.id, e)}
                                      className="w-7 h-7 rounded hover:scale-110 transition text-base">{e}</button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ color: 'var(--sat-muted)' }} title="Répondre">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="9 17 4 12 9 7" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                              </svg>
                            </button>
                            {isMe && !msg.fileUrl && msg.type !== 'INVITE' && (
                              <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }}
                                className="w-6 h-6 rounded flex items-center justify-center"
                                style={{ color: 'var(--sat-muted)' }} title="Modifier">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                                </svg>
                              </button>
                            )}
                            <button onClick={() => setDeleteTarget(msg)}
                              className="w-6 h-6 rounded flex items-center justify-center"
                              style={{ color: isMe ? '#EF4444' : 'var(--sat-muted)' }} title="Supprimer">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Réactions */}
                      {Object.keys(reactionGroups).length > 0 && !isDeleted && (
                        <div className={cx('flex flex-wrap gap-1 mt-1', isMe ? 'justify-end' : 'justify-start')}>
                          {Object.entries(reactionGroups).map(([emoji, users]) => {
                            const mine = users.some((u: any) => u.userId === currentUser?.id);
                            return (
                              <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition"
                                style={{
                                  background: mine ? 'rgba(160,22,217,0.12)' : 'var(--sat-hover)',
                                  border: `1px solid ${mine ? 'var(--sat-accent)' : 'var(--sat-border)'}`,
                                }}
                                title={users.map((u: any) => u.user?.nickname || u.user?.email || '').join(', ')}>
                                {emoji} <span style={{ color: mine ? 'var(--sat-accent)' : 'var(--sat-muted)', fontWeight: 600 }}>{users.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Heure + accusés de lecture (dernier d'un groupe) */}
                      {!sameNext && (
                        <span className="text-[10px] px-1 mt-0.5 flex items-center gap-1" style={{ color: 'var(--sat-faint)' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          {isMe && !isDeleted && (
                            readByAll
                              ? <span style={{ color: 'var(--sat-accent)' }} title="Lu">✓✓</span>
                              : deliveredToAll
                                ? <span style={{ color: 'var(--sat-faint)' }} title="Distribué">✓✓</span>
                                : <span style={{ color: 'var(--sat-faint)' }} title="Envoyé">✓</span>
                          )}
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


              {/* Whisper targets */}
              {currentConv?.type === 'GROUP' && whisperMode && (
                <div className="flex flex-wrap gap-1.5 px-1 mb-2">
                  <span className="text-[11px] font-bold" style={{ color: 'var(--sat-accent)' }}>Visible par :</span>
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

              {/* Bandeau de réponse */}
              {replyTo && (
                <div className="flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-t-xl text-xs"
                  style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)', borderLeft: '2px solid var(--sat-accent)' }}>
                  Réponse à <strong style={{ color: 'var(--sat-text)' }}>{replyTo.sender?.nickname || replyTo.sender?.email?.split('@')[0] || '?'}</strong>
                  <span className="truncate flex-1" style={{ color: 'var(--sat-faint)' }}>
                    {replyTo.content || 'fichier'}
                  </span>
                  <button onClick={() => setReplyTo(null)} className="flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>✕</button>
                </div>
              )}

              {/* Barre d'enregistrement vocal (façon WhatsApp) */}
              {recording ? (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2"
                  style={{ background: 'var(--sat-surface)', border: '1px solid rgba(239,68,68,0.4)' }}>
                  {/* Annuler */}
                  <button onClick={() => finishRecording(true)} title="Annuler"
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition"
                    style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
                    <TrashIcon size={17} />
                  </button>

                  {/* Indicateur + timer */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full animate-pulse flex-shrink-0" style={{ background: '#EF4444' }} />
                    <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--sat-text)' }}>
                      {String(Math.floor(recordSeconds / 60)).padStart(2, '0')}:{String(recordSeconds % 60).padStart(2, '0')}
                    </span>
                    {/* Pseudo-waveform animée */}
                    <div className="flex items-center gap-0.5 flex-1 h-6 overflow-hidden">
                      {Array.from({ length: 28 }).map((_, k) => (
                        <span key={k} className="flex-1 rounded-full animate-pulse"
                          style={{
                            background: 'var(--sat-accent)',
                            height: `${20 + Math.abs(Math.sin((k + recordSeconds) * 1.3)) * 70}%`,
                            opacity: 0.5,
                            animationDelay: `${k * 40}ms`,
                          }} />
                      ))}
                    </div>
                    <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>Glisse pour annuler</span>
                  </div>

                  {/* Envoyer le vocal */}
                  <button onClick={() => finishRecording(false)} title="Envoyer"
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition text-white"
                    style={{ background: 'var(--sat-accent)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-accent2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-accent)')}>
                    <SendIcon size={16} />
                  </button>
                </div>
              ) : (
              /* Input bar — Discord style */
              <div className="relative flex items-center rounded-lg"
                style={{ background: 'var(--sat-surface)', border: whisperMode ? '1px solid rgba(160,22,217,0.4)' : '1px solid var(--sat-border-2)' }}>

                {/* Bouton pièce jointe */}
                <button onClick={() => fileInputRef.current?.click()} title="Joindre un fichier"
                  className="flex-shrink-0 w-10 h-11 flex items-center justify-center transition"
                  style={{ color: 'var(--sat-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" />
                  </svg>
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />

                {/* Emoji — à gauche */}
                <div className="relative flex-shrink-0">
                  <button onClick={() => setShowEmoji((v) => !v)} title="Émojis"
                    className="w-9 h-11 flex items-center justify-center rounded transition text-lg"
                    style={{ color: showEmoji ? 'var(--sat-accent)' : 'var(--sat-muted)' }}
                    onMouseEnter={(e) => { if (!showEmoji) (e.currentTarget.style.color = 'var(--sat-text)'); }}
                    onMouseLeave={(e) => { if (!showEmoji) (e.currentTarget.style.color = 'var(--sat-muted)'); }}>
                    <SmileyIcon size={19} />
                  </button>
                  {showEmoji && (
                    <EmojiPicker onSelect={(e) => setNewMessage((m) => m + e)} onClose={() => setShowEmoji(false)} />
                  )}
                </div>

                {/* Input text */}
                <input ref={inputRef} type="text" value={newMessage}
                  onChange={(e) => handleTyping(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { handleSend(); setShowEmoji(false); } }}
                  placeholder={whisperMode ? 'Message chuchoté…' : convPlaceholder}
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
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    </button>
                  )}

                  {/* Micro — s'affiche si rien à envoyer */}
                  {!newMessage.trim() && (
                    <button onClick={startRecording} title="Enregistrer un message vocal"
                      className="w-8 h-8 flex items-center justify-center rounded transition"
                      style={{ color: 'var(--sat-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                      <MicIcon size={17} />
                    </button>
                  )}

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
              )}
            </div>
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

      {/* ── Prévisualisation d'image avant envoi ── */}
      {pendingImage && (
        <ImageSendModal
          file={pendingImage}
          onSend={sendUploadedImage}
          onClose={() => setPendingImage(null)}
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
