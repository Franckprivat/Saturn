import { create } from 'zustand';

export interface ChatUser {
  id: string;
  email: string;
  nickname: string;
  image?: string | null;
  avatarColor?: string | null;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  user: { id: string; nickname: string; email: string };
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  conversationId: string;
  sender: ChatUser;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  isWhisper?: boolean;
  whisperTo?: string[];
  type?: 'MESSAGE' | 'SYSTEM' | 'INVITE';
  deletedAt?: string | null;
  replyToId?: string | null;
  replyTo?: ChatMessage | null;
  reactions?: MessageReaction[];
  readBy?: { userId: string; readAt: string }[];
  deliveredTo?: { userId: string; deliveredAt: string }[];
  pending?: boolean;
}

export interface ConversationParticipant {
  user: ChatUser;
  role?: string;
}

export interface Conversation {
  id: string;
  createdAt: string;
  type: 'DM' | 'GROUP';
  name?: string | null;
  participants: ConversationParticipant[];
  messages?: ChatMessage[];
}

export interface PaginationState {
  nextCursor: string | null;
  hasMore: boolean;
}

interface ChatState {
  conversations: Conversation[];
  messagesByConversationId: Record<string, ChatMessage[]>;
  paginationByConversationId: Record<string, PaginationState>;
  currentConversationId: string | null;
  unreadCounts: Record<string, number>;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (conversationId: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[], pagination?: PaginationState) => void;
  prependMessages: (conversationId: string, messages: ChatMessage[], pagination?: PaginationState) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  updateMessage: (conversationId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  replaceMessage: (conversationId: string, oldId: string, newMsg: ChatMessage) => void;
  /** Marque tous les messages de la conversation comme lus par `readerId` (reçus ✓✓). */
  markConversationRead: (conversationId: string, readerId: string, readAt: string) => void;
  /** Marque tous les messages comme distribués chez `userId` (✓✓ gris). */
  markConversationDelivered: (conversationId: string, userId: string, deliveredAt: string) => void;
  incrementUnread: (conversationId: string) => void;
  clearUnread: (conversationId: string) => void;
  totalUnread: () => number;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversationId: {},
  paginationByConversationId: {},
  currentConversationId: null,
  unreadCounts: {},

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversationId: (conversationId) => {
    set({ currentConversationId: conversationId });
    if (conversationId) get().clearUnread(conversationId);
  },

  setMessages: (conversationId, messages, pagination) =>
    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: messages,
      },
      paginationByConversationId: {
        ...state.paginationByConversationId,
        ...(pagination ? { [conversationId]: pagination } : {}),
      },
    })),

  prependMessages: (conversationId, messages, pagination) =>
    set((state) => {
      const existing = state.messagesByConversationId[conversationId] ?? [];
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: [...messages, ...existing],
        },
        paginationByConversationId: {
          ...state.paginationByConversationId,
          ...(pagination ? { [conversationId]: pagination } : {}),
        },
      };
    }),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversationId[conversationId] ?? [];
      const messagesByConversationId = {
        ...state.messagesByConversationId,
        [conversationId]: [...existing, message],
      };
      const conversations = state.conversations.map((c) =>
        c.id === conversationId ? { ...c, messages: [message] } : c,
      );
      const idx = conversations.findIndex((c) => c.id === conversationId);
      if (idx > 0) {
        const [conv] = conversations.splice(idx, 1);
        conversations.unshift(conv);
      }
      return { messagesByConversationId, conversations };
    }),

  updateMessage: (conversationId, messageId, patch) =>
    set((state) => {
      const msgs = state.messagesByConversationId[conversationId] ?? [];
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: msgs.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
        },
      };
    }),

  replaceMessage: (conversationId, oldId, newMsg) =>
    set((state) => {
      const msgs = state.messagesByConversationId[conversationId] ?? [];
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: msgs.map((m) => (m.id === oldId ? newMsg : m)),
        },
      };
    }),

  markConversationRead: (conversationId, readerId, readAt) =>
    set((state) => {
      const msgs = state.messagesByConversationId[conversationId];
      if (!msgs) return state;
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: msgs.map((m) => {
            if (m.sender.id === readerId) return m;
            if (m.readBy?.some((r) => r.userId === readerId)) return m;
            return { ...m, readBy: [...(m.readBy ?? []), { userId: readerId, readAt }] };
          }),
        },
      };
    }),

  markConversationDelivered: (conversationId, userId, deliveredAt) =>
    set((state) => {
      const msgs = state.messagesByConversationId[conversationId];
      if (!msgs) return state;
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: msgs.map((m) => {
            if (m.sender.id === userId) return m;
            if (m.deliveredTo?.some((d) => d.userId === userId)) return m;
            return { ...m, deliveredTo: [...(m.deliveredTo ?? []), { userId, deliveredAt }] };
          }),
        },
      };
    }),

  incrementUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [conversationId]: (state.unreadCounts[conversationId] ?? 0) + 1,
      },
    })),

  clearUnread: (conversationId) =>
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [conversationId]: 0 },
    })),

  totalUnread: () => Object.values(get().unreadCounts).reduce((a, b) => a + b, 0),

  reset: () =>
    set({
      conversations: [],
      messagesByConversationId: {},
      paginationByConversationId: {},
      currentConversationId: null,
      unreadCounts: {},
    }),
}));
