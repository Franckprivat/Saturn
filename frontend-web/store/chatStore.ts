import { create } from 'zustand';

export interface ChatUser {
  id: string;
  email: string;
  nickname: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  conversationId: string;
  sender: ChatUser;
}

export interface ConversationParticipant {
  user: ChatUser;
}

export interface Conversation {
  id: string;
  createdAt: string;
  participants: ConversationParticipant[];
  messages?: ChatMessage[];
}

interface ChatState {
  conversations: Conversation[];
  messagesByConversationId: Record<string, ChatMessage[]>;
  currentConversationId: string | null;
  setConversations: (conversations: Conversation[]) => void;
  setCurrentConversationId: (conversationId: string | null) => void;
  setMessages: (conversationId: string, messages: ChatMessage[]) => void;
  addMessage: (conversationId: string, message: ChatMessage) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messagesByConversationId: {},
  currentConversationId: null,

  setConversations: (conversations) => set({ conversations }),

  setCurrentConversationId: (conversationId) => set({ currentConversationId: conversationId }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messagesByConversationId: {
        ...state.messagesByConversationId,
        [conversationId]: messages,
      },
    })),

  addMessage: (conversationId, message) =>
    set((state) => {
      const existing = state.messagesByConversationId[conversationId] ?? [];
      return {
        messagesByConversationId: {
          ...state.messagesByConversationId,
          [conversationId]: [...existing, message],
        },
      };
    }),

  reset: () =>
    set({
      conversations: [],
      messagesByConversationId: {},
      currentConversationId: null,
    }),
}));

