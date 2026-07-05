'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useThemeStore } from '@/store/themeStore';
import { useNotificationStore, type AppNotification } from '@/store/notificationStore';
import { SaturnLogo } from '@/components/SaturnLogo';
import { CallManager } from '@/components/CallManager';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useGlobalChatEvents } from '@/hooks/useGlobalChatEvents';
import { useBadgeStore } from '@/store/badgeStore';
import { mediaUrl } from '@/lib/media';

const AUTH_ROUTES = ['/login', '/signup', '/forgot-password', '/reset-password'];

function NavIcon({
  href,
  label,
  active,
  badge,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} title={label} className="group relative flex justify-center">
      <div
        className="relative w-12 h-12 flex items-center justify-center transition-all duration-200"
        style={{
          borderRadius: active ? '30%' : '50%',
          background: active ? 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent3))' : 'var(--sat-hover)',
          color: active ? '#fff' : 'var(--sat-muted)',
          boxShadow: active ? '0 4px 18px var(--sat-accent-glow)' : 'none',
        }}
        onMouseEnter={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.borderRadius = '30%';
            (e.currentTarget as HTMLDivElement).style.color = '#fff';
            (e.currentTarget as HTMLDivElement).style.background = 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent3))';
          }
        }}
        onMouseLeave={(e) => {
          if (!active) {
            (e.currentTarget as HTMLDivElement).style.borderRadius = '50%';
            (e.currentTarget as HTMLDivElement).style.color = 'var(--sat-muted)';
            (e.currentTarget as HTMLDivElement).style.background = 'var(--sat-hover)';
          }
        }}
      >
        {children}
        {badge && badge > 0 ? (
          <span
            className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white"
            style={{ background: 'var(--sat-dnd)', border: '2px solid var(--sat-sidebar)' }}
          >
            {badge > 99 ? '99+' : badge}
          </span>
        ) : null}
      </div>
      {/* Tooltip */}
      <div
        className="pointer-events-none absolute left-16 z-50 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
        style={{ top: '50%', transform: 'translateY(-50%)' }}
      >
        <div
          className="absolute -left-1 w-2 h-2 rotate-45"
          style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}
        />
        <span
          className="relative px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-lg"
          style={{ background: 'var(--sat-surface)', color: 'var(--sat-text)', border: '1px solid var(--sat-border-2)' }}
        >
          {label}
        </span>
      </div>
    </Link>
  );
}

function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { notifications, markAllRead, remove, clearAll } = useNotificationStore();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [joinedIds, setJoinedIds] = useState<Set<string>>(new Set());
  const [refusedIds, setRefusedIds] = useState<Set<string>>(new Set());

  useEffect(() => { markAllRead(); }, []);

  const handleJoinCommunity = async (n: AppNotification) => {
    setJoiningId(n.id);
    try {
      let communityId: string | null = null;
      if (n.inviteId) {
        // Invitation directe : acceptation explicite (le serveur vérifie bans/expiration)
        const res = await api.post(`/community-invitations/${n.inviteId}/accept`);
        communityId = res.data.communityId;
      } else {
        // Ancien format : jonction par token
        const token = n.href?.split('/').pop();
        if (!token) return;
        const res = await api.post(`/communities/join/${token}`);
        communityId = res.data.id;
      }
      setJoinedIds((s) => new Set(s).add(n.id));
      setTimeout(() => {
        remove(n.id);
        if (communityId) router.push(`/communities/${communityId}`);
        onClose();
      }, 800);
    } catch {
      setJoiningId(null);
    }
  };

  const handleRefuseInvite = (n: AppNotification) => {
    if (n.inviteId) {
      api.post(`/community-invitations/${n.inviteId}/decline`).catch(() => {});
    }
    setRefusedIds((s) => new Set(s).add(n.id));
    setTimeout(() => remove(n.id), 600);
  };

  return (
    <div
      className="absolute left-[76px] z-50 w-80 rounded-2xl shadow-2xl overflow-hidden"
      style={{
        top: 0,
        background: 'var(--sat-surface)',
        border: '1px solid var(--sat-border-2)',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
        <span className="font-bold text-sm" style={{ color: 'var(--sat-text)' }}>Notifications</span>
        {notifications.length > 0 && (
          <button onClick={clearAll} className="text-[11px] font-semibold transition hover:opacity-70" style={{ color: 'var(--sat-faint)' }}>
            Tout effacer
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sat-hover)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--sat-faint)' }}>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <p className="text-xs" style={{ color: 'var(--sat-faint)' }}>Aucune notification</p>
          </div>
        ) : (
          <div className="py-1.5">
            {notifications.map((n) => {
              const isInvite = n.type === 'community_invite';
              const joined = joinedIds.has(n.id);
              const refused = refusedIds.has(n.id);
              return (
                <div key={n.id} className="mx-2 mb-1 rounded-xl overflow-hidden transition"
                  style={{ background: n.read ? 'transparent' : 'rgba(var(--sat-accent-rgb,193,118,41),0.06)', border: '1px solid var(--sat-border)' }}>
                  <div className="flex gap-3 p-3">
                    {n.image ? (
                      <img src={mediaUrl(n.image)} alt="" loading="lazy" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: isInvite ? 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' : 'var(--sat-hover)' }}>
                        {isInvite
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--sat-muted)' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--sat-text)' }}>{n.title}</p>
                      <p className="text-[11px] mt-0.5 line-clamp-2" style={{ color: 'var(--sat-muted)' }}>{n.body}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--sat-faint)' }}>
                        {new Date(n.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button onClick={() => remove(n.id)} className="w-5 h-5 flex items-center justify-center flex-shrink-0 opacity-0 hover:opacity-100 transition"
                      style={{ color: 'var(--sat-faint)' }}>✕</button>
                  </div>

                  {isInvite && !joined && !refused && (
                    <div className="flex gap-2 px-3 pb-3">
                      <button onClick={() => handleRefuseInvite(n)}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80"
                        style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                        Refuser
                      </button>
                      <button onClick={() => handleJoinCommunity(n)} disabled={joiningId === n.id}
                        className="flex-1 py-1.5 rounded-lg text-xs font-bold transition hover:opacity-90 disabled:opacity-60"
                        style={{ background: 'var(--sat-accent)', color: '#fff' }}>
                        {joiningId === n.id ? '...' : 'Rejoindre'}
                      </button>
                    </div>
                  )}

                  {(joined || refused) && (
                    <div className="px-3 pb-3">
                      <p className="text-[11px] font-semibold text-center" style={{ color: joined ? 'var(--sat-online)' : 'var(--sat-faint)' }}>
                        {joined ? '✓ Communauté rejointe !' : 'Invitation refusée'}
                      </p>
                    </div>
                  )}

                  {!isInvite && n.href && (
                    <div className="px-3 pb-3">
                      <button onClick={() => { router.push(n.href); onClose(); }}
                        className="w-full py-1.5 rounded-lg text-xs font-bold transition hover:opacity-80"
                        style={{ background: 'var(--sat-hover)', color: 'var(--sat-accent)' }}>
                        {n.type === 'message' ? 'Voir le message'
                          : n.type === 'friend_request' ? 'Voir la demande'
                          : 'Voir'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Pont temps réel global : messages, réactions, reçus de lecture → store
  const socket = useChatSocket();
  useGlobalChatEvents(socket);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ image?: string; avatarColor?: string; nickname?: string } | null>(null);
  const totalUnread = useChatStore((s) => s.totalUnread());
  const friendRequestsBadge = useBadgeStore((s) => s.friendRequests);
  const missedCallsBadge = useBadgeStore((s) => s.missedCalls);
  const applyTheme = useThemeStore((s) => s.apply);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const unreadCount = useNotificationStore((s) => s.unreadCount());

  useEffect(() => { applyTheme(); }, []);

  // Permission de notification système, demandée au premier geste utilisateur
  // (les navigateurs exigent une interaction pour afficher la demande)
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    const ask = () => { Notification.requestPermission().catch(() => {}); };
    window.addEventListener('pointerdown', ask, { once: true });
    return () => window.removeEventListener('pointerdown', ask);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) return;
      setUser(data.user);
      api.get('/users/me').then((res) => setProfile(res.data)).catch(() => {});
      // Badges initiaux (demandes d'amis, appels manqués)
      useBadgeStore.getState().refreshFriendRequests(data.user.id);
      useBadgeStore.getState().refreshMissedCalls();
    }).catch(() => {});
  }, [pathname]);

  const isAuthPage = AUTH_ROUTES.includes(pathname);
  if (isAuthPage) return <>{children}</>;

  const initial = (profile?.nickname || user?.name || user?.email || '?').charAt(0).toUpperCase();
  const avatarGradient = profile?.avatarColor || 'from-[#2563EB] to-[#60A5FA]';

  return (
    <div className="flex h-screen overflow-hidden">

      {/* ── Colonne 1 : Nav latérale (72px) ── */}
      <aside
        className="flex flex-col items-center py-3 gap-1.5 flex-shrink-0 overflow-y-auto scrollbar-none"
        style={{ width: 72, background: 'var(--sat-sidebar)', borderRight: '1px solid var(--sat-border)' }}
      >
        {/* Logo Saturn */}
        <Link href="/" title="Saturn" className="group flex items-center justify-center mb-1">
          <SaturnLogo size={64} tone="auto" glow className="transition-transform duration-200 group-hover:scale-105" />
        </Link>

        {/* Séparateur */}
        <div className="w-8 h-px my-1" style={{ background: 'var(--sat-border-2)' }} />

        {/* Navigation */}
        <NavIcon href="/communities" label="Communautés" active={pathname.startsWith('/communities')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </NavIcon>

        <div className="w-8 h-px my-0.5" style={{ background: 'var(--sat-border-2)' }} />

        <NavIcon href="/chat" label="Messages" active={pathname.startsWith('/chat')} badge={totalUnread}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </NavIcon>

        <NavIcon href="/friends" label="Amis" active={pathname.startsWith('/friends')} badge={friendRequestsBadge}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavIcon>

        <NavIcon href="/calls" label="Appels" active={pathname.startsWith('/calls')} badge={missedCallsBadge}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.25 6.25l1.95-1.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </NavIcon>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Bell notifications */}
        <div ref={notifRef} className="relative flex justify-center">
          <button
            onClick={() => setNotifOpen((v) => !v)}
            title="Notifications"
            className="relative w-12 h-12 flex items-center justify-center transition-all duration-200"
            style={{
              borderRadius: notifOpen ? '30%' : '50%',
              background: notifOpen ? 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent3))' : 'var(--sat-hover)',
              color: notifOpen ? '#fff' : 'var(--sat-muted)',
            }}
            onMouseEnter={(e) => { if (!notifOpen) { (e.currentTarget).style.borderRadius = '30%'; (e.currentTarget).style.color = '#fff'; (e.currentTarget).style.background = 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent3))'; } }}
            onMouseLeave={(e) => { if (!notifOpen) { (e.currentTarget).style.borderRadius = '50%'; (e.currentTarget).style.color = 'var(--sat-muted)'; (e.currentTarget).style.background = 'var(--sat-hover)'; } }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute -bottom-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-black flex items-center justify-center text-white"
                style={{ background: '#EF4444', border: '2px solid var(--sat-sidebar)' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && <NotificationDropdown onClose={() => setNotifOpen(false)} />}
        </div>

        <div className="w-8 h-px mb-1 mt-1" style={{ background: 'var(--sat-border-2)' }} />

        {/* Avatar utilisateur */}
        <Link href="/profile" title="Profil" className="group relative flex justify-center">
          <div
            className="relative w-10 h-10 rounded-full overflow-hidden flex items-center justify-center text-sm font-black transition-all duration-200"
            style={{
              boxShadow: pathname.startsWith('/profile')
                ? '0 0 0 2px var(--sat-accent), 0 0 0 4px var(--sat-sidebar)'
                : '0 0 0 2px var(--sat-border-2)',
              background: !profile?.image ? undefined : undefined,
            }}
          >
            {profile?.image ? (
              <img src={mediaUrl(profile.image)} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br ${avatarGradient}`}>
                {initial}
              </div>
            )}
          </div>
          {/* Status online indicator */}
          <span
            className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full"
            style={{ background: 'var(--sat-online)', border: '2px solid var(--sat-sidebar)' }}
          />
        </Link>
      </aside>

      {/* ── Contenu principal ── */}
      <main className="flex-1 flex overflow-hidden">
        {children}
      </main>

      {/* ── Appels (global, ring partout) ── */}
      <CallManager />
    </div>
  );
}
