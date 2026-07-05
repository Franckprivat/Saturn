'use client';

import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useBadgeStore } from '@/store/badgeStore';

/**
 * Pont global socket → store, monté une seule fois dans AppShell.
 *
 * - Rejoint les rooms de TOUTES les conversations de l'utilisateur : les
 *   messages, éditions, suppressions, réactions et reçus de lecture arrivent
 *   en temps réel même quand la conversation n'est pas ouverte (compteurs
 *   non-lus fiables, aperçus de la sidebar à jour — façon WhatsApp).
 * - Si un message arrive pour une conversation inconnue (nouveau DM/groupe
 *   créé par quelqu'un d'autre), la liste est rechargée puis la room rejointe.
 */
export function useGlobalChatEvents(socket: Socket | null) {
  const joinedRef = useRef<Set<string>>(new Set());
  const refreshingRef = useRef(false);

  useEffect(() => {
    if (!socket) return;
    const store = () => useChatStore.getState();

    const joinAll = (conversationIds: string[]) => {
      for (const id of conversationIds) {
        if (joinedRef.current.has(id)) continue;
        joinedRef.current.add(id);
        socket.emit('join_conversation', { conversationId: id });
      }
    };

    const loadConversations = async () => {
      try {
        const res = await api.get('/conversations');
        store().setConversations(res.data);
        joinAll(res.data.map((c: any) => c.id));
        // Rattrapage « distribué » : les messages reçus pendant qu'on était
        // hors ligne sont maintenant arrivés sur cet appareil.
        for (const c of res.data) {
          socket.emit('mark_delivered', { conversationId: c.id });
        }
      } catch { /* non connecté ou API indisponible */ }
    };

    const onNewMessage = async (msg: any) => {
      const { conversations, currentConversationId } = store();
      const known = conversations.some((c) => c.id === msg.conversationId);

      store().addMessage(msg.conversationId, msg);

      // Statut « distribué » : le message vient d'arriver sur cet appareil
      // (le serveur ignore nos propres messages, pas besoin de filtrer ici)
      socket.emit('mark_delivered', { conversationId: msg.conversationId });

      // Conversation inconnue → un nouveau DM/groupe vient d'être créé pour nous
      if (!known && !refreshingRef.current) {
        refreshingRef.current = true;
        await loadConversations();
        refreshingRef.current = false;
      }

      // Compteur non-lu : uniquement pour les DM/groupes qu'on n'est pas en train de lire
      const isViewing =
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/chat') &&
        msg.conversationId === currentConversationId;
      const inList = store().conversations.some((c) => c.id === msg.conversationId);
      if (inList && !isViewing) store().incrementUnread(msg.conversationId);
    };

    const onEdited = (msg: any) =>
      store().updateMessage(msg.conversationId, msg.id, { content: msg.content, editedAt: msg.editedAt });

    const onDeleted = ({ messageId, conversationId }: any) =>
      store().updateMessage(conversationId, messageId, {
        deletedAt: new Date().toISOString(),
        content: '',
        fileUrl: null,
        fileName: null,
        fileType: null,
      });

    const onReaction = ({ messageId, conversationId, reactions }: any) => {
      if (conversationId) store().updateMessage(conversationId, messageId, { reactions });
    };

    const onRead = ({ conversationId, userId, readAt }: any) =>
      store().markConversationRead(conversationId, userId, readAt);

    const onDelivered = ({ conversationId, userId, deliveredAt }: any) =>
      store().markConversationDelivered(conversationId, userId, deliveredAt);

    // Badges temps réel : demandes d'amis
    const onFriendRequest = () => useBadgeStore.getState().incrementFriendRequests();
    const onFriendUpdate = () => useBadgeStore.getState().refreshFriendRequests();

    socket.on('new_message', onNewMessage);
    socket.on('message_edited', onEdited);
    socket.on('message_deleted', onDeleted);
    socket.on('reaction_updated', onReaction);
    socket.on('messages_read', onRead);
    socket.on('messages_delivered', onDelivered);
    socket.on('friend_request', onFriendRequest);
    socket.on('friend_request_update', onFriendUpdate);

    // Chargement initial + re-join après reconnexion (les rooms sont perdues)
    loadConversations();
    const onReconnect = () => {
      joinedRef.current.clear();
      loadConversations();
    };
    socket.on('connect', onReconnect);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('message_edited', onEdited);
      socket.off('message_deleted', onDeleted);
      socket.off('reaction_updated', onReaction);
      socket.off('messages_read', onRead);
      socket.off('messages_delivered', onDelivered);
      socket.off('friend_request', onFriendRequest);
      socket.off('friend_request_update', onFriendUpdate);
      socket.off('connect', onReconnect);
    };
  }, [socket]);
}
