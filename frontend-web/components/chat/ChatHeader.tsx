'use client';

import type { ChatUser, Conversation } from '@/store/chatStore';
import { formatLastSeen } from '@/store/presenceStore';
import { useCallStore } from '@/store/callStore';
import { mediaUrl } from '@/lib/media';
import { Avatar } from '@/components/Avatar';
import { PhoneIcon, VideoIcon } from '@/components/Icons';
import { WallpaperPicker } from '@/components/WallpaperPicker';

interface Props {
  currentConv: Conversation;
  getOtherUser: (conv: Conversation) => ChatUser | null;
  getTitle: (conv: Conversation) => string;
  isOnline: (userId: string) => boolean;
  lastSeenById: Record<string, string | null | undefined>;
  wallpaper: string | null;
  setWallpaper: (value: string | null) => void;
  openGroupPanel: () => void;
  onToggleContact: () => void;
}

// En-tête de la conversation ouverte : avatar, statut, fond d'écran, appels
export function ChatHeader({
  currentConv, getOtherUser, getTitle, isOnline, lastSeenById,
  wallpaper, setWallpaper, openGroupPanel, onToggleContact,
}: Props) {
  const startCall = useCallStore((s) => s.startCall);
          const otherUser = getOtherUser(currentConv);
      const online = otherUser ? isOnline(otherUser.id) : false;
      return (
        <>
          <button
            onClick={currentConv.type === 'GROUP' ? openGroupPanel : onToggleContact}
            className="relative flex-shrink-0 cursor-pointer"
            title={currentConv.type === 'GROUP' ? 'Infos du groupe' : 'Infos du contact'}
          >
            {currentConv.type === 'GROUP'
              ? <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold overflow-hidden"
                  style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>
                  {currentConv.image ? <img src={mediaUrl(currentConv.image)} className="w-full h-full object-cover" alt="" /> : getTitle(currentConv).charAt(0).toUpperCase()}
                </div>
              : <Avatar user={otherUser || {}} size="xs" className="w-7 h-7" />}
            {currentConv.type === 'DM' && (
              <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
                style={{ background: online ? 'var(--sat-online)' : 'var(--sat-offline)', border: '1.5px solid var(--sat-main)' }} />
            )}
          </button>

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <button onClick={currentConv.type === 'GROUP' ? openGroupPanel : onToggleContact}
              className="text-[15px] font-bold truncate hover:opacity-80 transition"
              title={currentConv.type === 'DM' ? 'Infos du contact' : 'Infos du groupe'}>
              {getTitle(currentConv)}
            </button>
            <span className="text-xs truncate min-w-0" style={{ color: online ? 'var(--sat-online)' : 'var(--sat-faint)' }}>
              {currentConv.type === 'GROUP'
                ? `— ${currentConv.participants.length} membres`
                : online
                  ? '— En ligne'
                  : `— ${formatLastSeen(lastSeenById[otherUser?.id ?? ''] ?? otherUser?.lastSeenAt) ?? 'Hors ligne'}`}
            </span>
          </div>

          {/* Actions header */}
          <div className="flex items-center gap-0.5">
            <WallpaperPicker value={wallpaper} onChange={setWallpaper} />
            {currentConv.type === 'DM' && (() => {
              const peerName = getTitle(currentConv);
              const peerImage = otherUser?.image ?? undefined;
              const launch = (callType: 'audio' | 'video') => {
                if (!currentConv) return;
                startCall({ conversationId: currentConv.id, callType, peerName, peerImage });
              };
              return (
                <>
                  <button onClick={() => launch('audio')} title="Appel audio"
                    className="w-8 h-8 rounded flex items-center justify-center transition"
                    style={{ color: 'var(--sat-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                    <PhoneIcon size={16} />
                  </button>
                  <button onClick={() => launch('video')} title="Appel vidéo"
                    className="w-8 h-8 rounded flex items-center justify-center transition"
                    style={{ color: 'var(--sat-muted)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                    <VideoIcon size={16} />
                  </button>
                </>
              );
            })()}
            {currentConv.type === 'GROUP' && (
              <button onClick={openGroupPanel} title="Infos du groupe"
                className="w-8 h-8 rounded flex items-center justify-center transition"
                style={{ color: 'var(--sat-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--sat-text)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--sat-muted)')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </button>
            )}
          </div>
        </>
      );
}
