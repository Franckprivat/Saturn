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

  const initial =
    (user?.nickname && user.nickname.charAt(0).toUpperCase()) ||
    (user?.email && user.email.charAt(0).toUpperCase()) ||
    '?';

  const isActive = (href: string) =>
    href === '/'
      ? pathname === '/'
      : pathname.startsWith(href);

  return (
    <header className="w-full border-b border-white/10 bg-[#0F0F14]/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-2xl bg-[#A016D9] flex items-center justify-center text-xs font-bold shadow-lg shadow-[#A016D9]/50">
            S
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold text-white tracking-tight">
              Saturn
            </span>
            <span className="text-[11px] text-[#B6B6B6]">
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
                ? 'bg-[#A016D9] text-white'
                : 'bg-black/30 text-[#B6B6B6] hover:border-white/20',
            )}
          >
            Amis
          </Link>
          <Link
            href="/chat"
            className={classNames(
              'px-3 py-1.5 rounded-full transition border border-transparent',
              isActive('/chat')
                ? 'bg-[#A016D9] text-white'
                : 'bg-black/30 text-[#B6B6B6] hover:border-white/20',
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
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-xs font-semibold text-white">
            {initial}
          </div>
        </Link>
      </div>
    </header>
  );
}

