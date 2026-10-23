'use client';

import type { ChatMessage, Conversation, MessageReaction } from '@/store/chatStore';
import { Avatar } from '@/components/Avatar';
import { FilePreview } from '@/components/media/FilePreview';
import { SmileyIcon } from '@/components/Icons';
import { bubbleGradient, type ConvPrefs } from '@/lib/convPrefs';
import { CommunityInviteCard } from './CommunityInviteCard';
import { cx, QUICK_REACTIONS } from './utils';

interface Props {
  msg: ChatMessage;
  prevMsg?: ChatMessage;
  nextMsg?: ChatMessage;
  currentUserId?: string;
  currentConv?: Conversation;
  aliasMap: Record<string, string>;
  convPrefs: ConvPrefs;
  isEditing: boolean;
  editContent: string;
  setEditContent: (value: string) => void;
  setEditingId: (id: string | null) => void;
  submitEdit: () => void;
  reactionPicker: string | null;
  setReactionPicker: (id: string | null) => void;
  toggleReaction: (messageId: string, emoji: string) => void;
  onReply: (msg: ChatMessage) => void;
  setDeleteTarget: (msg: ChatMessage) => void;
}

// Un message de la conversation : bulle, actions au survol, réactions, accusés
export function MessageItem({
  msg, prevMsg, nextMsg, currentUserId, currentConv, aliasMap, convPrefs,
  isEditing, editContent, setEditContent, setEditingId, submitEdit,
  reactionPicker, setReactionPicker, toggleReaction, onReply, setDeleteTarget,
}: Props) {
if (msg.type === 'SYSTEM') {
  return (
    <div className="flex items-center justify-center gap-2 my-2">
      <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
      <span className="text-[11px] px-3 py-1 rounded-full" style={{ color: 'var(--sat-muted)', background: 'var(--sat-hover)' }}>
        <strong style={{ color: 'var(--sat-text)' }}>{msg.sender?.nickname || msg.sender?.email?.split('@')[0] || '?'}</strong> {msg.content}
      </span>
      <span className="h-px flex-1" style={{ background: 'var(--sat-border)' }} />
    </div>
  );
}

const isMe = msg.sender.id === currentUserId;
const isDeleted = !!msg.deletedAt;
const samePrev = prevMsg?.type !== 'SYSTEM' && prevMsg?.sender.id === msg.sender.id && new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000;
const sameNext = nextMsg?.type !== 'SYSTEM' && nextMsg?.sender.id === msg.sender.id && new Date(nextMsg.createdAt).getTime() - new Date(msg.createdAt).getTime() < 300000;

// Statuts réels façon WhatsApp :
// ✓ envoyé → ✓✓ gris distribué (arrivé chez tous) → ✓✓ accent lu (par tous)
const others = currentConv?.participants.filter((p) => p.user.id !== currentUserId) ?? [];
const readers = new Set((msg.readBy ?? []).map((r) => r.userId));
const receivers = new Set((msg.deliveredTo ?? []).map((d) => d.userId));
const readByAll = others.length > 0 && others.every((o) => readers.has(o.user.id));
const deliveredToAll = others.length > 0 &&
  others.every((o) => receivers.has(o.user.id) || readers.has(o.user.id));

// Regroupement des réactions par emoji
const reactionGroups: Record<string, MessageReaction[]> = {};
for (const r of (msg.reactions || [])) { (reactionGroups[r.emoji] ??= []).push(r); }

return (
  <div className={cx('group/msg flex items-end gap-2', isMe ? 'justify-end' : 'justify-start', samePrev ? 'mt-0.5' : 'mt-3')}>
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
            <button aria-label="Valider la modification" onClick={submitEdit} className="text-xs font-bold" style={{ color: 'var(--sat-accent)' }}>✓</button>
            <button aria-label="Annuler la modification" onClick={() => setEditingId(null)} className="text-xs" style={{ color: 'var(--sat-muted)' }}>✕</button>
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
            <button onClick={() => onReply(msg)}
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
            const mine = users.some((u) => u.userId === currentUserId);
            return (
              <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition"
                style={{
                  background: mine ? 'rgba(160,22,217,0.12)' : 'var(--sat-hover)',
                  border: `1px solid ${mine ? 'var(--sat-accent)' : 'var(--sat-border)'}`,
                }}
                title={users.map((u) => u.user?.nickname || u.user?.email || '').join(', ')}>
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

}
