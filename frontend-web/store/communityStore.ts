import { create } from 'zustand';

export type CommunityRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type ChannelType = 'TEXT' | 'VOICE';

export interface CommunitySummary {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  myRole: CommunityRole;
  memberCount: number;
}

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  categoryId: string | null;
  conversationId: string | null;
  position: number;
}

export interface ChannelCategory {
  id: string;
  name: string;
  position: number;
  channels: Channel[];
}

export interface CommunityMemberEntry {
  id: string;
  role: CommunityRole;
  joinedAt: string;
  user: { id: string; email: string; nickname: string; image?: string | null; avatarColor?: string | null };
}

export interface CommunityDetail {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  ownerId: string;
  myRole: CommunityRole;
  inviteToken?: string | null;
  categories: ChannelCategory[];
  channels: Channel[];
  members: CommunityMemberEntry[];
}

interface CommunityState {
  communities: CommunitySummary[];
  currentCommunityId: string | null;
  currentChannelId: string | null;
  detail: CommunityDetail | null;
  voiceByChannel: Record<string, string[]>; // channelId -> userIds connectés
  setCommunities: (c: CommunitySummary[]) => void;
  setCurrentCommunity: (id: string | null) => void;
  setCurrentChannel: (id: string | null) => void;
  setDetail: (d: CommunityDetail | null) => void;
  setVoiceState: (channelId: string, users: string[]) => void;
  reset: () => void;
}

export const useCommunityStore = create<CommunityState>((set) => ({
  communities: [],
  currentCommunityId: null,
  currentChannelId: null,
  detail: null,
  voiceByChannel: {},
  setCommunities: (communities) => set({ communities }),
  setCurrentCommunity: (currentCommunityId) => set({ currentCommunityId }),
  setCurrentChannel: (currentChannelId) => set({ currentChannelId }),
  setDetail: (detail) => set({ detail }),
  setVoiceState: (channelId, users) =>
    set((s) => ({ voiceByChannel: { ...s.voiceByChannel, [channelId]: users } })),
  reset: () => set({ communities: [], currentCommunityId: null, currentChannelId: null, detail: null, voiceByChannel: {} }),
}));

export function canManage(role: CommunityRole): boolean {
  return role === 'OWNER' || role === 'ADMIN' || role === 'MODERATOR';
}
export function canAdmin(role: CommunityRole): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}

export const ROLE_LABELS: Record<CommunityRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Admin',
  MODERATOR: 'Modérateur',
  MEMBER: 'Membre',
};

export const ROLE_COLORS: Record<CommunityRole, string> = {
  OWNER: '#F59E0B',
  ADMIN: '#EF4444',
  MODERATOR: '#10B981',
  MEMBER: '#64748B',
};
