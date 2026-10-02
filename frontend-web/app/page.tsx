import Link from 'next/link';
import { SaturnLogo } from '@/components/SaturnLogo';
import { PhoneMockup } from '@/components/AuthLayout';
import { DemoLoginButton } from '@/components/DemoLoginButton';

const FEATURES = [
  {
    title: 'Messages en temps réel',
    text: 'Conversations privées et groupes, accusés de lecture, réactions, réponses et messages épinglés.',
    icon: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  },
  {
    title: 'Communautés',
    text: 'Des serveurs façon Discord : salons textuels et vocaux, rôles, liens d’invitation et modération.',
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    title: 'Appels audio et vidéo',
    text: 'Appels directement dans le navigateur grâce à WebRTC, avec historique des appels manqués.',
    icon: (
      <>
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="5" width="15" height="14" rx="2" />
      </>
    ),
  },
  {
    title: 'Amis et présence',
    text: 'Demandes d’amis, statut en ligne et « vu à » pour savoir qui est disponible.',
    icon: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
  },
];

const STACK = ['Next.js', 'NestJS', 'Prisma', 'PostgreSQL', 'Socket.IO', 'WebRTC', 'Docker'];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F4EE] text-[#2B2A27] overflow-x-hidden">
      {/* ── En-tête ── */}
      <header className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-5">
        <Link href="/" className="flex items-center gap-2">
          <SaturnLogo size={56} tone="dark" />
          <span className="font-display font-semibold text-xl tracking-tight">Saturn</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4 text-sm font-semibold whitespace-nowrap">
          <Link href="/login" className="px-3 py-2 text-[#6B655C] hover:text-[#2B2A27] transition-colors">
            Se connecter
          </Link>
          <Link
            href="/signup"
            className="hidden sm:inline-block px-4 py-2 rounded-xl text-white bg-gradient-to-r from-[#C96442] to-[#DA8A6A] shadow-md shadow-[#C96442]/20 hover:shadow-[#C96442]/40 transition-shadow"
          >
            Créer un compte
          </Link>
        </nav>
      </header>

      {/* ── Hero ── */}
      <main>
        <section className="relative max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 items-center px-5 sm:px-8 pt-6 pb-16 lg:pt-12">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl pointer-events-none auth-blob" style={{ background: 'rgba(201,100,66,0.14)' }} />

          <div className="relative z-10 text-center lg:text-left auth-rise">
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-medium leading-[1.08]">
              Tes conversations,
              <br />
              <span className="italic text-[#C96442]">en un seul endroit.</span>
            </h1>
            <p className="mt-5 text-base sm:text-lg text-[#6B655C] max-w-xl mx-auto lg:mx-0">
              Saturn est une messagerie temps réel : messages privés, groupes, communautés et appels vidéo,
              le tout dans le navigateur.
            </p>

            <div className="mt-8 flex flex-col gap-3 max-w-sm mx-auto lg:mx-0">
              <Link
                href="/chat"
                prefetch={false}
                className="w-full py-3.5 rounded-xl text-center text-white font-bold text-[15px] bg-gradient-to-r from-[#C96442] to-[#DA8A6A] shadow-lg shadow-[#C96442]/25 transition-all hover:shadow-[#C96442]/40 hover:-translate-y-0.5"
              >
                Ouvrir l&apos;application
              </Link>
              <DemoLoginButton />
            </div>
          </div>

          <div className="relative z-10 hidden sm:flex justify-center auth-pop" style={{ animationDelay: '0.1s' }}>
            <PhoneMockup />
          </div>
        </section>

        {/* ── Fonctionnalités ── */}
        <section className="bg-[#FBFAF7] border-y border-[rgba(60,52,40,0.08)]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <h2 className="font-display text-3xl font-medium text-center">Tout ce qu&apos;il faut pour discuter</h2>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl bg-white p-6 border border-[rgba(60,52,40,0.08)] shadow-sm">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-gradient-to-br from-[#C96442] to-[#DA8A6A]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      {f.icon}
                    </svg>
                  </div>
                  <h3 className="mt-4 font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-[#6B655C] leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Stack ── */}
        <section className="max-w-6xl mx-auto px-5 sm:px-8 py-14 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9C968B]">Construit avec</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {STACK.map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-full text-sm font-medium bg-[#EDEBE2] text-[#6B655C]">
                {s}
              </span>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-[rgba(60,52,40,0.08)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-[#9C968B]">
          <span>Saturn · projet portfolio</span>
          <a
            href="https://github.com/Franckprivat/Saturn"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:text-[#C96442] transition-colors"
          >
            Code source sur GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
