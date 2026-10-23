import { create } from 'zustand';

interface PresenceState {
  online: Record<string, true>;
  lastSeen: Record<string, string>;
  /** Demandes d'amis reçues en attente (badge de l'onglet Amis) */
  friendRequests: number;
  setOnlineUsers: (ids: string[]) => void;
  setOnline: (id: string) => void;
  setOffline: (id: string, lastSeenAt?: string) => void;
  seedLastSeen: (id: string | undefined, lastSeenAt: string | null | undefined) => void;
  setFriendRequests: (n: number) => void;
  reset: () => void;
}

export const usePresenceStore = create<PresenceState>((set) => ({
  online: {},
  lastSeen: {},
  friendRequests: 0,
  setOnlineUsers: (ids) => set({ online: Object.fromEntries(ids.map((id) => [id, true as const])) }),
  setOnline: (id) => set((s) => ({ online: { ...s.online, [id]: true } })),
  setOffline: (id, lastSeenAt) =>
    set((s) => {
      const online = { ...s.online };
      delete online[id];
      return {
        online,
        lastSeen: lastSeenAt ? { ...s.lastSeen, [id]: lastSeenAt } : s.lastSeen,
      };
    }),
  seedLastSeen: (id, lastSeenAt) =>
    set((s) => (id && lastSeenAt && !s.lastSeen[id] ? { lastSeen: { ...s.lastSeen, [id]: lastSeenAt } } : {})),
  setFriendRequests: (n) => set({ friendRequests: n }),
  reset: () => set({ online: {}, lastSeen: {}, friendRequests: 0 }),
}));
