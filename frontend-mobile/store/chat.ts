import { create } from 'zustand';
import type { ChatMessage, Conversation, MessageReaction } from '@/lib/types';

interface Pagination {
  nextCursor: string | null;
  hasMore: boolean;
}

interface ChatState {
  conversations: Conversation[];
  loaded: boolean;
  messages: Record<string, ChatMessage[]>;
  pagination: Record<string, Pagination>;
  unread: Record<string, number>;
  /** Conversation affichée à l'écran (pas de compteur non-lu pour elle) */
  current: string | null;
  /** userIds en train d'écrire, par conversation */
  typing: Record<string, string[]>;

  setConversations: (conversations: Conversation[]) => void;
  setCurrent: (id: string | null) => void;
  setMessages: (id: string, messages: ChatMessage[], pagination: Pagination) => void;
  prependMessages: (id: string, messages: ChatMessage[], pagination: Pagination) => void;
  addMessage: (message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  setReactions: (conversationId: string, messageId: string, reactions: MessageReaction[]) => void;
  markRead: (conversationId: string, userId: string, readAt: string) => void;
  markDelivered: (conversationId: string, userId: string, deliveredAt: string) => void;
  incrementUnread: (conversationId: string) => void;
  setTyping: (conversationId: string, userId: string, isTyping: boolean) => void;
  reset: () => void;
}

const initial = {
  conversations: [],
  loaded: false,
  messages: {},
  pagination: {},
  unread: {},
  current: null,
  typing: {},
};

function mergeById(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const ids = new Set(existing.map((m) => m.id));
  return [...existing, ...incoming.filter((m) => !ids.has(m.id))];
}

export const useChatStore = create<ChatState>((set) => ({
  ...initial,

  setConversations: (conversations) => set({ conversations, loaded: true }),

  setCurrent: (id) =>
    set((s) => ({
      current: id,
      unread: id ? { ...s.unread, [id]: 0 } : s.unread,
    })),

  setMessages: (id, messages, pagination) =>
    set((s) => ({
      messages: { ...s.messages, [id]: messages },
      pagination: { ...s.pagination, [id]: pagination },
    })),

  prependMessages: (id, messages, pagination) =>
    set((s) => {
      const existing = s.messages[id] ?? [];
      const ids = new Set(existing.map((m) => m.id));
      return {
        messages: { ...s.messages, [id]: [...messages.filter((m) => !ids.has(m.id)), ...existing] },
        pagination: { ...s.pagination, [id]: pagination },
      };
    }),

  addMessage: (message) =>
    set((s) => {
      const id = message.conversationId;
      const existing = s.messages[id];
      const messages = existing ? { ...s.messages, [id]: mergeById(existing, [message]) } : s.messages;
      // Remonte la conversation en tête de liste avec son nouvel aperçu
      const idx = s.conversations.findIndex((c) => c.id === id);
      let conversations = s.conversations;
      if (idx >= 0) {
        const updated = { ...s.conversations[idx], messages: [message], lastMessageAt: message.createdAt };
        conversations = [updated, ...s.conversations.filter((c) => c.id !== id)];
      }
      // L'auteur a fini d'écrire
      const typing = s.typing[id]?.includes(message.sender?.id)
        ? { ...s.typing, [id]: s.typing[id].filter((u) => u !== message.sender.id) }
        : s.typing;
      return { messages, conversations, typing };
    }),

  updateMessage: (conversationId, messageId, patch) =>
    set((s) => {
      const list = s.messages[conversationId];
      const conversations = s.conversations.map((c) =>
        c.id === conversationId && c.messages?.[0]?.id === messageId
          ? { ...c, messages: [{ ...c.messages[0], ...patch }] }
          : c,
      );
      if (!list) return { conversations };
      return {
        conversations,
        messages: {
          ...s.messages,
          [conversationId]: list.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
        },
      };
    }),

  setReactions: (conversationId, messageId, reactions) =>
    set((s) => {
      const list = s.messages[conversationId];
      if (!list) return {};
      return {
        messages: {
          ...s.messages,
          [conversationId]: list.map((m) => (m.id === messageId ? { ...m, reactions } : m)),
        },
      };
    }),

  markRead: (conversationId, userId, readAt) =>
    set((s) => {
      const list = s.messages[conversationId];
      if (!list) return {};
      return {
        messages: {
          ...s.messages,
          [conversationId]: list.map((m) =>
            m.sender?.id === userId || m.readBy?.some((r) => r.userId === userId)
              ? m
              : { ...m, readBy: [...(m.readBy ?? []), { userId, readAt }] },
          ),
        },
      };
    }),

  markDelivered: (conversationId, userId, deliveredAt) =>
    set((s) => {
      const list = s.messages[conversationId];
      if (!list) return {};
      return {
        messages: {
          ...s.messages,
          [conversationId]: list.map((m) =>
            m.sender?.id === userId || m.deliveredTo?.some((r) => r.userId === userId)
              ? m
              : { ...m, deliveredTo: [...(m.deliveredTo ?? []), { userId, deliveredAt }] },
          ),
        },
      };
    }),

  incrementUnread: (conversationId) =>
    set((s) => ({ unread: { ...s.unread, [conversationId]: (s.unread[conversationId] ?? 0) + 1 } })),

  setTyping: (conversationId, userId, isTyping) =>
    set((s) => {
      const current = s.typing[conversationId] ?? [];
      const next = isTyping
        ? current.includes(userId)
          ? current
          : [...current, userId]
        : current.filter((u) => u !== userId);
      return { typing: { ...s.typing, [conversationId]: next } };
    }),

  reset: () => set(initial),
}));

export function totalUnread(unread: Record<string, number>): number {
  return Object.values(unread).reduce((a, b) => a + b, 0);
}
