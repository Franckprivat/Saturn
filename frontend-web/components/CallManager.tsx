'use client';

import { useEffect } from 'react';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useCallStore } from '@/store/callStore';
import { CallModal } from '@/components/CallModal';

/**
 * Gère les appels globalement : un seul <CallModal> monté au niveau de l'app.
 * Écoute les appels entrants peu importe la page affichée (façon WhatsApp).
 * Le signaling passe par les salles personnelles `user:<id>` (cf. chat.gateway),
 * donc aucun besoin de rejoindre la salle de conversation.
 */
export function CallManager() {
  const socket = useChatSocket();
  const activeCall = useCallStore((s) => s.activeCall);
  const receiveCall = useCallStore((s) => s.receiveCall);
  const endCall = useCallStore((s) => s.endCall);

  useEffect(() => {
    if (!socket) return;
    const onIncoming = ({ offer, callType, callerName, callerImage, conversationId }: any) => {
      const accepted = receiveCall({
        conversationId,
        callType: callType || 'audio',
        peerName: callerName,
        peerImage: callerImage,
        incomingOffer: offer,
      });
      // Déjà en appel → on refuse automatiquement (occupé)
      if (!accepted) socket.emit('call_reject', { conversationId });
    };
    socket.on('call_incoming', onIncoming);
    return () => { socket.off('call_incoming', onIncoming); };
  }, [socket, receiveCall]);

  if (!activeCall || !socket) return null;

  return (
    <CallModal
      socket={socket}
      conversationId={activeCall.conversationId}
      callType={activeCall.callType}
      isIncoming={activeCall.isIncoming}
      callerName={activeCall.peerName}
      callerImage={activeCall.peerImage}
      incomingOffer={activeCall.incomingOffer}
      onClose={endCall}
    />
  );
}
