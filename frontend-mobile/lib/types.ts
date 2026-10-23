/** Types des réponses du backend (mêmes formes que frontend-web/store/chatStore.ts). */

export interface ChatUser {
  id: string;
  email?: string;
  nickname: string;
  image?: string | null;
  avatarColor?: string | null;
  lastSeenAt?: string | null;
  bio?: string | null;
}

export interface MessageReaction {
  id: string;
  emoji: string;
  userId: string;
  user?: { id: string; nickname: string };
}

export interface ChatMessage {
  id: string;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  conversationId: string;
  senderId?: string;
  sender: ChatUser;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  isWhisper?: boolean;
  whisperTo?: string[];
  type?: 'MESSAGE' | 'SYSTEM' | 'INVITE';
  metadata?: Record<string, unknown> | null;
  deletedAt?: string | null;
  replyToId?: string | null;
  replyTo?: ChatMessage | null;
  reactions?: MessageReaction[];
  readBy?: { userId: string; readAt: string }[];
  deliveredTo?: { userId: string; deliveredAt: string }[];
}

export interface Conversation {
  id: string;
  createdAt: string;
  type: 'DM' | 'GROUP' | 'CHANNEL';
  name?: string | null;
  image?: string | null;
  lastMessageAt?: string | null;
  participants: { user: ChatUser; role?: string }[];
  messages?: ChatMessage[];
}

export interface MessagesPage {
  messages: ChatMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface Friendship {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'BLOCKED';
  requesterId: string;
  addresseeId: string;
  createdAt: string;
  requester: ChatUser;
  addressee: ChatUser;
}

export type CommunityRole = 'OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

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
  type: 'TEXT' | 'VOICE';
  position: number;
  categoryId?: string | null;
  conversationId?: string | null;
}

export interface CommunityDetail {
  id: string;
  name: string;
  description?: string | null;
  image?: string | null;
  inviteToken?: string | null;
  myRole: CommunityRole;
  categories: { id: string; name: string; position: number; channels: Channel[] }[];
  channels: Channel[];
  members: { id: string; role: CommunityRole; user: ChatUser }[];
}

export interface Profile extends ChatUser {
  email: string;
  name?: string;
  bio?: string | null;
}
