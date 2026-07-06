import { create } from 'zustand';

interface PresenceState {
  onlineUserIds: Set<string>;
  /** Dernière déconnexion connue par utilisateur (ISO) — live via socket + seed API. */
  lastSeenById: Record<string, string>;
  setOnlineUsers: (ids: string[]) => void;
  setOnline: (userId: string) => void;
  setOffline: (userId: string, lastSeenAt?: string) => void;
  /** Renseigne un « vu à » connu (données API) sans écraser une valeur plus récente. */
  seedLastSeen: (userId: string, lastSeenAt?: string | null) => void;
  isOnline: (userId: string) => boolean;
  getLastSeen: (userId: string) => string | undefined;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: new Set(),
  lastSeenById: {},

  setOnlineUsers: (ids) => set({ onlineUserIds: new Set(ids) }),

  setOnline: (userId) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.add(userId);
      return { onlineUserIds: next };
    }),

  setOffline: (userId, lastSeenAt) =>
    set((state) => {
      const next = new Set(state.onlineUserIds);
      next.delete(userId);
      return {
        onlineUserIds: next,
        ...(lastSeenAt
          ? { lastSeenById: { ...state.lastSeenById, [userId]: lastSeenAt } }
          : {}),
      };
    }),

  seedLastSeen: (userId, lastSeenAt) => {
    if (!lastSeenAt) return;
    const current = get().lastSeenById[userId];
    if (current && new Date(current) >= new Date(lastSeenAt)) return;
    set((state) => ({ lastSeenById: { ...state.lastSeenById, [userId]: lastSeenAt } }));
  },

  isOnline: (userId) => get().onlineUserIds.has(userId),
  getLastSeen: (userId) => get().lastSeenById[userId],
}));

/** « Vu à 14:32 » / « Vu hier à 09:15 » / « Vu le 3 juil. » — façon WhatsApp. */
export function formatLastSeen(iso: string | undefined | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return null;
  const now = new Date();
  const time = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return `Vu à ${time}`;
  if (dayDiff === 1) return `Vu hier à ${time}`;
  return `Vu le ${date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
