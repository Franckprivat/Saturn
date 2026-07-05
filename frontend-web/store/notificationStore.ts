import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppNotification = {
  id: string;
  /** message, community_invite, friend_request, friend_accepted, invite_accepted,
   *  invite_declined, join_request, request_approved, request_rejected, … */
  type: string;
  title: string;
  body: string;
  href: string;
  conversationId?: string;
  /** Invitation directe de communauté : permet Accepter/Refuser depuis la cloche. */
  inviteId?: string;
  image?: string;
  timestamp: string;
  read: boolean;
};

type NotificationStore = {
  notifications: AppNotification[];
  add: (n: Omit<AppNotification, 'id' | 'read'>) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clearAll: () => void;
  unreadCount: () => number;
};

export const useNotificationStore = create<NotificationStore>()(
  persist(
    (set, get) => ({
      notifications: [],
      add: (n) =>
        set((s) => ({
          notifications: [
            {
              ...n,
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              read: false,
            },
            ...s.notifications,
          ].slice(0, 50),
        })),
      markAllRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
      remove: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
      clearAll: () => set({ notifications: [] }),
      unreadCount: () => get().notifications.filter((n) => !n.read).length,
    }),
    { name: 'saturn_notifications' },
  ),
);
