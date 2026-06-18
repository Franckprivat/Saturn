'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { api } from '@/lib/api';
import { useChatStore } from '@/store/chatStore';
import { useThemeStore } from '@/store/themeStore';
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
      {/* Indicateur actif */}
      <span
        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full transition-all duration-200"
        style={{
          width: 4,
          height: active ? 36 : 0,
          opacity: active ? 1 : 0,
          background: 'linear-gradient(var(--sat-accent),var(--sat-accent3))',
        }}
      />
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
          style={{ background: '#1E293B', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <span
          className="relative px-3 py-1.5 text-xs font-bold whitespace-nowrap rounded-lg"
          style={{ background: '#1E293B', color: '#fff', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {label}
        </span>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<{ image?: string; avatarColor?: string; nickname?: string } | null>(null);
  const totalUnread = useChatStore((s) => s.totalUnread());
  const applyTheme = useThemeStore((s) => s.apply);

  useEffect(() => { applyTheme(); }, []);

  useEffect(() => {
    authClient.getSession().then(({ data }) => {
      if (!data?.user) return;
      setUser(data.user);
      api.get('/users/me').then((res) => setProfile(res.data)).catch(() => {});
    });
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
        <Link href="/" title="Saturn" className="group relative flex justify-center mb-1">
          <div
            className="w-12 h-12 flex items-center justify-center font-black text-lg text-white transition-all duration-200"
            style={{
              borderRadius: '30%',
              background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))',
              boxShadow: '0 4px 16px var(--sat-accent-glow)',
            }}
          >
            S
          </div>
        </Link>

        {/* Séparateur */}
        <div className="w-8 h-px my-1" style={{ background: 'var(--sat-border-2)' }} />

        {/* Navigation */}
        <NavIcon href="/chat" label="Messages" active={pathname.startsWith('/chat')} badge={totalUnread}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </NavIcon>

        <NavIcon href="/friends" label="Amis" active={pathname.startsWith('/friends')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </NavIcon>

        <NavIcon href="/communities" label="Communautés" active={pathname.startsWith('/communities')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" />
          </svg>
        </NavIcon>

        {/* Spacer */}
        <div className="flex-1" />
        <div className="w-8 h-px mb-1" style={{ background: 'var(--sat-border-2)' }} />

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
              <img src={profile.image} alt="avatar" className="w-full h-full object-cover" />
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
    </div>
  );
}
