import { create } from 'zustand';
import { api } from '@/lib/api';

const CALLS_SEEN_KEY = 'saturn_calls_seen';

function getCallsSeen(): number {
  if (typeof window === 'undefined') return 0;
  return Number(localStorage.getItem(CALLS_SEEN_KEY) || 0);
}

/**
 * Badges de la barre de navigation (façon WhatsApp) :
 * - Amis : demandes d'amis reçues en attente (compte vivant, temps réel)
 * - Appels : appels manqués depuis la dernière visite du journal
 * (le badge Messages vient du chatStore : total des non-lus)
 */
interface BadgeState {
  myId: string | null;
  friendRequests: number;
  missedCalls: number;
  /** Recharge le nombre de demandes en attente. `userId` mémorisé pour les appels suivants. */
  refreshFriendRequests: (userId?: string) => Promise<void>;
  incrementFriendRequests: () => void;
  /** Recharge les appels manqués depuis la dernière visite du journal. */
  refreshMissedCalls: () => Promise<void>;
  incrementMissedCalls: () => void;
  /** À l'ouverture du journal d'appels : tout est vu. */
  markCallsSeen: () => void;
}

export const useBadgeStore = create<BadgeState>((set, get) => ({
  myId: null,
  friendRequests: 0,
  missedCalls: 0,

  refreshFriendRequests: async (userId) => {
    const id = userId ?? get().myId;
    if (!id) return;
    set({ myId: id });
    try {
      const res = await api.get('/friends/requests');
      const count = (res.data as any[]).filter(
        (r) => r.status === 'PENDING' && r.addressee?.id === id,
      ).length;
      set({ friendRequests: count });
    } catch { /* non connecté */ }
  },

  incrementFriendRequests: () => set((s) => ({ friendRequests: s.friendRequests + 1 })),

  refreshMissedCalls: async () => {
    try {
      const res = await api.get('/calls');
      const seen = getCallsSeen();
      const count = (res.data as any[]).filter(
        (c) => c.status === 'missed' && c.direction === 'incoming' &&
          new Date(c.createdAt ?? c.timestamp).getTime() > seen,
      ).length;
      set({ missedCalls: count });
    } catch { /* non connecté */ }
  },

  incrementMissedCalls: () => set((s) => ({ missedCalls: s.missedCalls + 1 })),

  markCallsSeen: () => {
    if (typeof window !== 'undefined') localStorage.setItem(CALLS_SEEN_KEY, String(Date.now()));
    set({ missedCalls: 0 });
  },
}));
