'use client';

import { useRef, useState, type RefObject } from 'react';
import type { Socket } from 'socket.io-client';
import type { ChatMessage, Conversation } from '@/store/chatStore';
import { api } from '@/lib/api';
import { EmojiPicker } from '@/components/EmojiPicker';
import { ImageSendModal, type UploadedFileInfo } from '@/components/media/ImageSendModal';
import { MicIcon, TrashIcon, SendIcon, SmileyIcon } from '@/components/Icons';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface Props {
  socket: Socket | null;
  currentConversationId: string;
  currentConv?: Conversation;
  currentUserId?: string;
  replyTo: ChatMessage | null;
  setReplyTo: (msg: ChatMessage | null) => void;
  typingUsers: Record<string, string>;
  convPlaceholder: string;
  setError: (message: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

// Zone de saisie : texte, émojis, pièces jointes, messages vocaux et chuchotés
export function ChatComposer({
  socket, currentConversationId, currentConv, currentUserId, replyTo, setReplyTo,
  typingUsers, convPlaceholder, setError, inputRef,
}: Props) {
  const [newMessage, setNewMessage] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [whisperMode, setWhisperMode] = useState(false);
  const [whisperTargets, setWhisperTargets] = useState<string[]>([]);
  const [pendingImage, setPendingImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  // Le mode chuchoté ne suit pas d'une conversation à l'autre
  // (réinitialisé pendant le rendu, cf. « ajuster l'état quand une prop change »)
  const [whisperConvId, setWhisperConvId] = useState(currentConversationId);
  if (whisperConvId !== currentConversationId) {
    setWhisperConvId(currentConversationId);
    setWhisperMode(false);
    setWhisperTargets([]);
  }

  const sendFileMessage = (file: { url: string; name: string; type: string }, content = '') => {
    socket?.emit('send_message', {
      conversationId: currentConversationId,
      content,
      fileUrl: file.url,
      fileName: file.name,
      fileType: file.type,
    });
  };

  const { recording, recordSeconds, startRecording, finishRecording } = useVoiceRecorder({
    onError: setError,
    onRecorded: async (blob, ext) => {
      if (!socket) return;
      try {
        const fd = new FormData();
        fd.append('file', blob, `voice-${Date.now()}.${ext}`);
        const res = await api.post('/upload', fd);
        // Pas de texte : le lecteur audio EST le message (l'aperçu de la
        // sidebar dérive « Message vocal » du type de fichier)
        sendFileMessage(res.data);
      } catch { setError('Erreur lors de l\'envoi du vocal'); }
    },
  });

  // ── Typing (émis une seule fois par salve de frappe, pas à chaque touche) ──
  const handleTyping = (value: string) => {
    setNewMessage(value);
    if (!socket) return;
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

  // ── Envoyer ──
  const handleSend = () => {
    const text = newMessage;
    if (!socket || !text.trim()) return;
    socket.emit('send_message', {
      conversationId: currentConversationId,
      content: text.trim(),
      ...(whisperMode && whisperTargets.length > 0 ? { whisperTo: whisperTargets } : {}),
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    setNewMessage('');
    setReplyTo(null);
    socket.emit('typing_stop', { conversationId: currentConversationId });
    isTypingRef.current = false;
  };

  // Insertion @mention
  const insertMention = (nickname: string) => {
    setNewMessage((m) => m + `@${nickname} `);
    inputRef.current?.focus();
  };

  // ── Pièce jointe ──
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !socket) return;
    // Image → prévisualisation avec compression + légende (façon WhatsApp)
    if (file.type.startsWith('image/')) { setPendingImage(file); return; }
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop lourd (max 10 Mo)'); return; }
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd);
      sendFileMessage(res.data);
    } catch { setError('Erreur lors de l\'envoi du fichier'); }
  };

  const sendUploadedImage = (up: UploadedFileInfo, caption: string) => {
    if (!socket) return;
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

  return (
    <div className="px-2 md:px-4 pb-[calc(0.5rem+env(safe-area-inset-bottom))] md:pb-6 pt-0 flex-shrink-0">
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
          {currentConv.participants.filter((p) => p.user.id !== currentUserId).map((p) => (
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
          <button aria-label="Annuler la réponse" onClick={() => setReplyTo(null)} className="flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>✕</button>
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
            <span className="hidden sm:inline text-[11px] flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>Glisse pour annuler</span>
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
                const nick = currentConv.participants.find((p) => p.user.id !== currentUserId)?.user?.nickname;
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

      {/* ── Prévisualisation d'image avant envoi ── */}
      {pendingImage && (
        <ImageSendModal
          file={pendingImage}
          onSend={sendUploadedImage}
          onClose={() => setPendingImage(null)}
        />
      )}
    </div>
  );
}
