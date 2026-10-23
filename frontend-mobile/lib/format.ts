import type { ChatMessage, ChatUser, Conversation } from './types';

export function displayName(user: Partial<ChatUser> | null | undefined): string {
  return user?.nickname?.trim() || user?.email?.split('@')[0] || 'Utilisateur';
}

/** Interlocuteur d'un DM. */
export function otherParticipant(conv: Conversation, myId: string | undefined): ChatUser | undefined {
  return conv.participants.find((p) => p.user.id !== myId)?.user ?? conv.participants[0]?.user;
}

export function conversationTitle(conv: Conversation, myId: string | undefined): string {
  if (conv.type === 'DM') return displayName(otherParticipant(conv, myId));
  return conv.name || 'Groupe';
}

/** Aperçu d'un message dans la liste des discussions. */
export function messagePreview(msg: ChatMessage | undefined, myId: string | undefined): string {
  if (!msg) return 'Aucun message';
  if (msg.deletedAt) return 'Message supprimé';
  const prefix = msg.type === 'SYSTEM' ? `${displayName(msg.sender)} ` : msg.sender?.id === myId ? 'Vous : ' : '';
  if (msg.content) return prefix + msg.content;
  if (msg.fileType?.startsWith('image/')) return `${prefix}📷 Photo`;
  if (msg.fileType?.startsWith('audio/')) return `${prefix}🎤 Message vocal`;
  if (msg.fileType?.startsWith('video/')) return `${prefix}🎬 Vidéo`;
  if (msg.fileUrl) return `${prefix}📎 ${msg.fileName || 'Fichier'}`;
  return prefix;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const pad = (n: number) => String(n).padStart(2, '0');

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Heure si aujourd'hui, « Hier », sinon date courte. */
export function formatListDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return formatTime(iso);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Hier';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}${d.getFullYear() === now.getFullYear() ? '' : `/${String(d.getFullYear()).slice(2)}`}`;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** Séparateur de jour dans une conversation. */
export function formatDayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  if (sameDay(d, now)) return "Aujourd'hui";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(d, yesterday)) return 'Hier';
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === now.getFullYear() ? '' : ` ${d.getFullYear()}`}`;
}

export function isSameDay(a: string, b: string): boolean {
  return sameDay(new Date(a), new Date(b));
}

export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'hors ligne';
  const d = new Date(iso);
  if (sameDay(d, new Date())) return `vu à ${formatTime(iso)}`;
  return `vu le ${formatListDate(iso)} à ${formatTime(iso)}`;
}
