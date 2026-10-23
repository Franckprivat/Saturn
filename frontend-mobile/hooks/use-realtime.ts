import { useEffect } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';
import type { ChatMessage, Conversation, Friendship, MessageReaction } from '@/lib/types';
import { useChatStore } from '@/store/chat';
import { usePresenceStore } from '@/store/presence';

/** Salons de communauté ouverts : leurs messages n'appartiennent pas à la liste des discussions. */
export const openedChannels = new Set<string>();

export async function loadConversations() {
  const list = await api<Conversation[]>('/conversations');
  useChatStore.getState().setConversations(list);
  for (const c of list) {
    for (const p of c.participants ?? []) {
      usePresenceStore.getState().seedLastSeen(p.user?.id, p.user?.lastSeenAt);
    }
  }
  return list;
}

export async function refreshFriendRequests(userId: string) {
  try {
    const list = await api<Friendship[]>('/friends/requests');
    const incoming = list.filter((f) => f.status === 'PENDING' && f.addresseeId === userId).length;
    usePresenceStore.getState().setFriendRequests(incoming);
  } catch {
    /* hors ligne */
  }
}

/**
 * Pont temps réel monté une fois quand l'utilisateur est connecté :
 * rejoint toutes ses conversations et répercute les évènements Socket.IO
 * (messages, éditions, réactions, reçus, présence, demandes d'amis) dans les stores.
 */
export function useRealtime(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    const joined = new Set<string>();

    (async () => {
      const socket = await connectSocket();
      if (!socket || cancelled) return;
      const chat = () => useChatStore.getState();
      const presence = () => usePresenceStore.getState();

      const joinAll = (ids: string[]) => {
        for (const id of ids) {
          if (joined.has(id)) continue;
          joined.add(id);
          socket.emit('join_conversation', { conversationId: id });
        }
      };

      let refreshing = false;
      const sync = async () => {
        try {
          const list = await loadConversations();
          joinAll(list.map((c) => c.id));
          // Les messages reçus hors ligne sont maintenant arrivés sur l'appareil
          for (const c of list) socket.emit('mark_delivered', { conversationId: c.id });
        } catch {
          /* API indisponible : on réessaiera à la reconnexion */
        }
      };

      const onNewMessage = async (msg: ChatMessage) => {
        chat().addMessage(msg);
        if (msg.sender?.id === userId) return;
        socket.emit('mark_delivered', { conversationId: msg.conversationId });
        const known = chat().conversations.some((c) => c.id === msg.conversationId);
        // Nouveau DM ou groupe créé par quelqu'un d'autre
        if (!known && !openedChannels.has(msg.conversationId) && !refreshing) {
          refreshing = true;
          await sync();
          refreshing = false;
        }
        const inList = chat().conversations.some((c) => c.id === msg.conversationId);
        if (inList && chat().current !== msg.conversationId) chat().incrementUnread(msg.conversationId);
      };

      const handlers: Record<string, (...args: never[]) => void> = {
        new_message: onNewMessage,
        message_edited: (msg: ChatMessage) =>
          chat().updateMessage(msg.conversationId, msg.id, { content: msg.content, editedAt: msg.editedAt }),
        message_deleted: ({ messageId, conversationId }: { messageId: string; conversationId: string }) =>
          chat().updateMessage(conversationId, messageId, {
            deletedAt: new Date().toISOString(),
            content: '',
            fileUrl: null,
            fileName: null,
            fileType: null,
          }),
        reaction_updated: (p: { messageId: string; conversationId?: string; reactions: MessageReaction[] }) => {
          if (p.conversationId) chat().setReactions(p.conversationId, p.messageId, p.reactions);
        },
        messages_read: (p: { conversationId: string; userId: string; readAt: string }) =>
          chat().markRead(p.conversationId, p.userId, p.readAt),
        messages_delivered: (p: { conversationId: string; userId: string; deliveredAt: string }) =>
          chat().markDelivered(p.conversationId, p.userId, p.deliveredAt),
        user_typing: (p: { conversationId: string; userId: string }) =>
          chat().setTyping(p.conversationId, p.userId, true),
        user_stopped_typing: (p: { conversationId: string; userId: string }) =>
          chat().setTyping(p.conversationId, p.userId, false),
        online_users: ({ userIds }: { userIds: string[] }) => presence().setOnlineUsers(userIds),
        user_online: ({ userId: id }: { userId: string }) => presence().setOnline(id),
        user_offline: ({ userId: id, lastSeenAt }: { userId: string; lastSeenAt?: string }) =>
          presence().setOffline(id, lastSeenAt),
        friend_request: () => presence().setFriendRequests(presence().friendRequests + 1),
        friend_request_update: () => void refreshFriendRequests(userId),
        connect: () => {
          // Les rooms sont perdues à chaque reconnexion
          joined.clear();
          void sync();
          for (const id of openedChannels) socket.emit('join_conversation', { conversationId: id });
        },
      };
      for (const [event, fn] of Object.entries(handlers)) socket.on(event, fn as (...args: unknown[]) => void);

      if (socket.connected) handlers.connect();
      void refreshFriendRequests(userId);

      // Retour au premier plan : rattrape ce qui a pu être manqué
      const appState = AppState.addEventListener('change', (state) => {
        if (state !== 'active') return;
        if (!socket.connected) socket.connect();
        else void sync();
        void refreshFriendRequests(userId);
      });

      cleanup = () => {
        appState.remove();
        for (const [event, fn] of Object.entries(handlers)) socket.off(event, fn as (...args: unknown[]) => void);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      disconnectSocket();
    };
  }, [userId]);
}
