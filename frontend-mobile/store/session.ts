import { create } from 'zustand';
import type { Profile } from '@/lib/types';

/** Profil complet de l'utilisateur connecté (GET /users/me). */
interface SessionState {
  profile: Profile | null;
  setProfile: (profile: Profile | null) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  profile: null,
  setProfile: (profile) => set({ profile }),
}));
