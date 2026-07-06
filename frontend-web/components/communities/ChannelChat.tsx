'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { Avatar } from '@/components/Avatar';
import { EmojiPicker } from '@/components/EmojiPicker';
import { Spinner } from '@/components/Spinner';
import { FilePreview } from '@/components/media/FilePreview';
import { ImageSendModal, type UploadedFileInfo } from '@/components/media/ImageSendModal';
import { DeleteMessageDialog } from '@/components/DeleteMessageDialog';
import { getHiddenMessageIds, hideMessageForMe } from '@/lib/hiddenMessages';
import { toast } from '@/components/Toast';
import { SmileyIcon, ReplyIcon, EditIcon, TrashIcon, PaperclipIcon, SendIcon } from '@/components/Icons';

function dn(u: { nickname?: string | null; email?: string | null } | null | undefined) {
  if (!u) return 'Inconnu';
  return u.nickname?.trim() || u.email?.split('@')[0] || 'Inconnu';
}
function cx(...cs: (string | false | null | undefined)[]) { return cs.filter(Boolean).join(' '); }

const MEMBER_COLORS = ['#2563EB', '#7C3AED', '#DB2777', '#DC2626', '#D97706', '#059669', '#0891B2', '#C2410C'];
function colorFor(id: string) {
  let h = 0;
  for (const ch of id || '') h = ((h << 5) - h) + ch.charCodeAt(0);
  return MEMBER_COLORS[Math.abs(h) % MEMBER_COLORS.length];
}

interface ChannelChatProps {
  conversationId: string;
  channelName: string;
  socket: Socket | null;
  currentUser: any;
}

export function ChannelChat({ conversationId, channelName, socket, currentUser }: ChannelChatProps) {
  const { messagesByConversationId, paginationByConversationId, setMessages, prependMessages } = useChatStore();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [reactionPicker, setReactionPicker] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Suppression : pour moi (masquage local) / pour tous
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (currentUser?.id) setHiddenIds(getHiddenMessageIds(currentUser.id));
  }, [currentUser]);

  const messages = useMemo(
    () => (messagesByConversationId[conversationId] ?? []).filter((m) => !hiddenIds.has(m.id)),
    [messagesByConversationId, conversationId, hiddenIds],
  );

  useEffect(() => {
    if (!conversationId) return;
    setLoading(true);
    api.get(`/conversations/${conversationId}/messages`)
      .then((res) => setMessages(conversationId, res.data.messages, {
        nextCursor: res.data.nextCursor ?? null,
        hasMore: res.data.hasMore ?? false,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [conversationId]);

  const loadOlder = async () => {
    const pagination = paginationByConversationId[conversationId];
    if (!pagination?.hasMore || !pagination.nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/conversations/${conversationId}/messages`, {
        params: { cursor: pagination.nextCursor },
      });
      prependMessages(conversationId, res.data.messages ?? [], {
        nextCursor: res.data.nextCursor ?? null,
        hasMore: res.data.hasMore ?? false,
      });
    } catch { /* silencieux */ }
    finally { setLoadingMore(false); }
  };

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join_conversation', { conversationId });
  }, [socket, conversationId]);

  // Auto-scroll seulement pour les nouveaux messages (pas l'historique chargé en haut)
  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [lastMessageId, conversationId]);

  const QUICK = ['❤️', '😂', '👍', '😮', '😢', '🙏'];

  const send = (content?: string) => {
    const t = content ?? text;
    if (!socket || !t.trim()) return;
    socket.emit('send_message', { conversationId, content: t.trim(), ...(replyTo ? { replyToId: replyTo.id } : {}) });
    if (!content) setText('');
    setReplyTo(null);
  };

  const [pendingImage, setPendingImage] = useState<File | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !socket) return;
    // Image → prévisualisation avec compression + légende
    if (file.type.startsWith('image/')) { setPendingImage(file); return; }
    if (file.size > 50 * 1024 * 1024) { toast('Fichier trop lourd (50 Mo max)', 'error'); return; }
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await api.post('/upload', form);
      socket.emit('send_message', { conversationId, content: '', fileUrl: res.data.url, fileName: res.data.name, fileType: res.data.type });
    } catch { toast('Erreur upload', 'error'); }
  };

  const sendUploadedImage = (up: UploadedFileInfo, caption: string) => {
    if (!socket) return;
    socket.emit('send_message', {
      conversationId,
      content: caption,
      fileUrl: up.url,
      fileName: up.name,
      fileType: up.type,
      ...(replyTo ? { replyToId: replyTo.id } : {}),
    });
    setReplyTo(null);
  };

  const submitEdit = () => {
    if (!socket || !editingId || !editContent.trim()) return;
    socket.emit('edit_message', { messageId: editingId, content: editContent.trim() });
    setEditingId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ background: 'var(--sat-main)' }}>
      {/* Header */}
      <div className="h-12 px-4 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
        <span className="text-lg" style={{ color: 'var(--sat-faint)' }}>#</span>
        <span className="font-bold text-[15px]" style={{ color: 'var(--sat-text)' }}>{channelName}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
        {loading && <div className="flex justify-center py-10"><Spinner size={22} /></div>}
        {!loading && paginationByConversationId[conversationId]?.hasMore && (
          <div className="flex justify-center pb-2">
            <button onClick={loadOlder} disabled={loadingMore}
              className="px-4 py-1.5 rounded-full text-xs font-semibold transition disabled:opacity-50"
              style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-muted)' }}>
              {loadingMore ? 'Chargement…' : '↑ Afficher les messages précédents'}
            </button>
          </div>
        )}
        {!loading && messages.length === 0 && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center text-3xl" style={{ background: 'var(--sat-surface)' }}>#</div>
            <p className="font-bold" style={{ color: 'var(--sat-text)' }}>Bienvenue sur #{channelName}</p>
            <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>C'est le début de ce salon.</p>
          </div>
        )}

        {messages.map((msg: any, i: number) => {
          if (msg.type === 'SYSTEM') {
            return (
              <div key={msg.id} className="flex items-center justify-center gap-2 my-2">
                <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
                <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}>
                  <strong style={{ color: 'var(--sat-text)' }}>{dn(msg.sender)}</strong> {msg.content}
                </span>
                <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
              </div>
            );
          }
          const isMe = msg.sender.id === currentUser?.id;
          const isDeleted = !!msg.deletedAt;
          const isEditing = editingId === msg.id;
          const prev = messages[i - 1] as any;
          const grouped = prev?.type !== 'SYSTEM' && prev?.sender?.id === msg.sender.id && new Date(msg.createdAt).getTime() - new Date(prev?.createdAt ?? 0).getTime() < 300000;
          const reactionGroups: Record<string, any[]> = {};
          for (const r of (msg.reactions || [])) { (reactionGroups[r.emoji] ??= []).push(r); }

          return (
            <div key={msg.id} className={cx('flex gap-3 px-2 py-0.5 rounded-lg group relative', grouped ? '' : 'mt-3')}
              onMouseEnter={() => setHovered(msg.id)}
              onMouseLeave={() => { setHovered(null); if (reactionPicker === msg.id) setReactionPicker(null); }}
              style={{ background: hovered === msg.id ? 'var(--sat-hover)' : 'transparent' }}>
              <div className="w-10 flex-shrink-0">
                {!grouped ? <Avatar user={msg.sender} size="sm" className="w-10 h-10" /> : <div className="w-10" />}
              </div>
              <div className="flex-1 min-w-0">
                {!grouped && (
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-sm" style={{ color: colorFor(msg.sender.id) }}>{dn(msg.sender)}</span>
                    <span className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>
                      {new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {msg.replyTo && !isDeleted && (
                  <div className="flex items-center gap-1.5 text-[11px] mb-0.5 pl-2" style={{ color: 'var(--sat-muted)', borderLeft: '2px solid var(--sat-border-2)' }}>
                    <strong style={{ color: colorFor(msg.replyTo.sender?.id || '') }}>{dn(msg.replyTo.sender)}</strong>
                    <span className="truncate">{msg.replyTo.deletedAt ? 'message supprimé' : msg.replyTo.content || 'fichier'}</span>
                  </div>
                )}
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input autoFocus value={editContent} onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                      className="flex-1 px-3 py-1.5 rounded-lg text-sm focus:outline-none"
                      style={{ background: 'var(--sat-surface)', border: '1.5px solid var(--sat-accent)', color: 'var(--sat-text)' }} />
                    <button onClick={submitEdit} className="text-xs font-bold" style={{ color: 'var(--sat-accent)' }}>✓</button>
                    <button onClick={() => setEditingId(null)} className="text-xs" style={{ color: 'var(--sat-muted)' }}>✕</button>
                  </div>
                ) : isDeleted ? (
                  <p className="text-sm italic" style={{ color: 'var(--sat-faint)' }}>Message supprimé</p>
                ) : msg.fileUrl ? (
                  <div className="py-1 space-y-1">
                    <FilePreview url={msg.fileUrl} name={msg.fileName || ''} type={msg.fileType || ''} maxWidth={260} />
                    {/* Jamais de légende pour un vocal : le lecteur EST le message */}
                    {msg.content && !msg.fileType?.startsWith('audio/') && (
                      <p className="text-sm leading-relaxed break-words" style={{ color: 'var(--sat-text)' }}>{msg.content}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed break-words" style={{ color: 'var(--sat-text)' }}>
                    {msg.content}
                    {msg.editedAt && <span className="text-[10px] ml-1.5" style={{ color: 'var(--sat-faint)' }}>(modifié)</span>}
                  </p>
                )}

                {Object.keys(reactionGroups).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(reactionGroups).map(([emoji, users]) => {
                      const mine = users.some((u: any) => u.userId === currentUser?.id);
                      return (
                        <button key={emoji} onClick={() => socket?.emit('add_reaction', { messageId: msg.id, emoji })}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ background: mine ? 'rgba(37,99,235,0.12)' : 'var(--sat-hover)', border: `1px solid ${mine ? 'var(--sat-accent)' : 'var(--sat-border)'}` }}>
                          {emoji} <span style={{ color: mine ? 'var(--sat-accent)' : 'var(--sat-muted)', fontWeight: 600 }}>{users.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Menu */}
              {hovered === msg.id && !isDeleted && !isEditing && (
                <div className="absolute -top-3 right-3 flex items-center gap-0.5 rounded-lg px-1 py-0.5 shadow-md z-10"
                  style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                  <div className="relative">
                    <button onClick={() => setReactionPicker(reactionPicker === msg.id ? null : msg.id)} className="w-7 h-7 rounded hover:bg-[var(--sat-hover)] flex items-center justify-center" style={{ color: 'var(--sat-muted)' }} title="Réagir"><SmileyIcon size={15} /></button>
                    {reactionPicker === msg.id && (
                      <div className="absolute bottom-8 right-0 flex gap-0.5 p-1.5 rounded-xl shadow-xl z-30" style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
                        {QUICK.map((e) => <button key={e} onClick={() => { socket?.emit('add_reaction', { messageId: msg.id, emoji: e }); setReactionPicker(null); }} className="w-8 h-8 rounded hover:bg-[var(--sat-hover)] text-lg">{e}</button>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="w-7 h-7 rounded hover:bg-[var(--sat-hover)] flex items-center justify-center" style={{ color: 'var(--sat-muted)' }} title="Répondre">
                    <ReplyIcon size={14} strokeWidth={2.5} />
                  </button>
                  {isMe && (
                    <button onClick={() => { setEditingId(msg.id); setEditContent(msg.content); }} className="w-7 h-7 rounded hover:bg-[var(--sat-hover)] flex items-center justify-center" style={{ color: 'var(--sat-muted)' }} title="Modifier">
                      <EditIcon size={13} strokeWidth={2.5} />
                    </button>
                  )}
                  <button onClick={() => setDeleteTarget(msg)} className="w-7 h-7 rounded flex items-center justify-center" style={{ color: isMe ? '#EF4444' : 'var(--sat-muted)' }} title="Supprimer">
                    <TrashIcon size={13} strokeWidth={2.5} />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Prévisualisation d'image avant envoi */}
      {pendingImage && (
        <ImageSendModal file={pendingImage} onSend={sendUploadedImage} onClose={() => setPendingImage(null)} />
      )}

      {/* Dialogue de suppression */}
      {deleteTarget && (
        <DeleteMessageDialog
          canDeleteForAll={deleteTarget.sender?.id === currentUser?.id}
          onDeleteForMe={() => { if (currentUser?.id) setHiddenIds(hideMessageForMe(currentUser.id, deleteTarget.id)); }}
          onDeleteForAll={() => socket?.emit('delete_message', { messageId: deleteTarget.id })}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {/* Input */}
      <div className="px-4 pb-5 pt-0 flex-shrink-0">
        {replyTo && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1.5 rounded-t-xl text-xs" style={{ background: 'var(--sat-hover)', color: 'var(--sat-muted)' }}>
            Réponse à <strong style={{ color: 'var(--sat-text)' }}>{dn(replyTo.sender)}</strong>
            <button onClick={() => setReplyTo(null)} className="ml-auto">✕</button>
          </div>
        )}
        <div className="flex items-center gap-1 px-3 rounded-xl" style={{ background: 'var(--sat-surface)', border: '1.5px solid var(--sat-border-2)' }}>
          <button onClick={() => fileRef.current?.click()} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: 'var(--sat-faint)' }} title="Joindre">
            <PaperclipIcon size={18} />
          </button>
          <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
          <input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { send(); setShowEmoji(false); } }}
            placeholder={`Envoyer un message dans #${channelName}`}
            className="flex-1 py-3 text-sm bg-transparent focus:outline-none" style={{ color: 'var(--sat-text)' }} />
          <div className="relative">
            <button onClick={() => setShowEmoji((v) => !v)} className="w-8 h-8 flex items-center justify-center rounded-lg" style={{ color: 'var(--sat-faint)' }}><SmileyIcon size={19} /></button>
            {showEmoji && <EmojiPicker onSelect={(e) => setText((m) => m + e)} onClose={() => setShowEmoji(false)} />}
          </div>
          <button onClick={() => send()} disabled={!text.trim()} className="w-8 h-8 rounded-lg flex items-center justify-center transition"
            style={{ background: text.trim() ? 'var(--sat-accent)' : 'var(--sat-hover)', color: text.trim() ? '#fff' : 'var(--sat-faint)' }}>
            <SendIcon size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
