'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function MainHeader() {
  const pathname = usePathname();
  const { user } = useAuthStore();

  if (pathname === '/login' || pathname === '/signup') return null;

  const initial =
    (user?.nickname && user.nickname.charAt(0).toUpperCase()) ||
    (user?.email && user.email.charAt(0).toUpperCase()) ||
    '?';

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname.startsWith(href);

  return (
    <header className="w-full border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#2563EB] flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-[#2563EB]/30">
            S
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-[#1E293B] tracking-tight">
              Saturn
            </span>
            <span className="text-[11px] text-[#64748B]">
              Messagerie temps réel
            </span>
          </div>
        </div>

        <nav className="flex items-center gap-4 text-xs sm:text-sm">
          <Link
            href="/friends"
            className={classNames(
              'px-3 py-1.5 rounded-full transition border border-transparent',
              isActive('/friends')
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#F1F5F9] text-[#64748B] hover:border-slate-200',
            )}
          >
            Amis
          </Link>
          <Link
            href="/chat"
            className={classNames(
              'px-3 py-1.5 rounded-full transition border border-transparent',
              isActive('/chat')
                ? 'bg-[#2563EB] text-white'
                : 'bg-[#F1F5F9] text-[#64748B] hover:border-slate-200',
            )}
          >
            Chat
          </Link>
        </nav>

        <Link
          href="/profile"
          className="flex items-center gap-2"
          aria-label="Profil utilisateur"
        >
          <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-slate-200 flex items-center justify-center text-xs font-semibold text-[#2563EB]">
            {initial}
          </div>
        </Link>
      </div>
    </header>
  );
}

