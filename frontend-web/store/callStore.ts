import { create } from 'zustand';

export interface ActiveCall {
  conversationId: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
  peerName?: string;
  peerImage?: string;
  incomingOffer?: RTCSessionDescriptionInit;
}

interface CallState {
  activeCall: ActiveCall | null;
  /** Démarre un appel sortant. Ignoré si un appel est déjà en cours. */
  startCall: (c: Omit<ActiveCall, 'isIncoming'>) => boolean;
  /** Reçoit un appel entrant. Retourne false si déjà occupé (→ l'appelant doit être notifié). */
  receiveCall: (c: Omit<ActiveCall, 'isIncoming'>) => boolean;
  endCall: () => void;
}

export const useCallStore = create<CallState>((set, get) => ({
  activeCall: null,
  startCall: (c) => {
    if (get().activeCall) return false;
    set({ activeCall: { ...c, isIncoming: false } });
    return true;
  },
  receiveCall: (c) => {
    if (get().activeCall) return false;
    set({ activeCall: { ...c, isIncoming: true } });
    return true;
  },
  endCall: () => set({ activeCall: null }),
}));
