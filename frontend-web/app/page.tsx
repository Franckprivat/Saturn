import Image, { type StaticImageData } from 'next/image';
import Link from 'next/link';
import { SaturnLogo } from '@/components/SaturnLogo';
import { DemoLoginButton } from '@/components/DemoLoginButton';
import shotConversation from '@/public/landing/conversation.jpg';
import shotGroup from '@/public/landing/groupe.jpg';
import shotCommunity from '@/public/landing/communaute.jpg';

// Vraies captures de l'application (compte démo), pas de maquettes.
const TOUR: { title: string; text: string; image: StaticImageData; alt: string }[] = [
  {
    title: 'Des groupes pour s’organiser',
    text: 'Un groupe pour le projet, un autre pour le week-end. On répond à un message précis, on réagit d’un emoji, on épingle ce qui compte pour ne pas le perdre.',
    image: shotGroup,
    alt: 'Conversation de groupe « Projet Saturn » avec quatre membres',
  },
  {
    title: 'Des communautés, façon Discord',
    text: 'Pour les groupes plus grands : des salons textuels et vocaux rangés par catégorie, des rôles, des liens d’invitation qui expirent, et de quoi modérer.',
    image: shotCommunity,
    alt: 'Communauté « Dev & Café » avec ses salons et la liste des membres',
  },
];

function Screenshot({ image, alt, priority = false }: { image: StaticImageData; alt: string; priority?: boolean }) {
  return (
    <div className="rounded-xl overflow-hidden border border-[rgba(60,52,40,0.14)] bg-white shadow-[0_12px_40px_rgba(60,52,40,0.12)]">
      <Image src={image} alt={alt} priority={priority} unoptimized className="w-full h-auto block" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F5F4EE] text-[#2B2A27] overflow-x-hidden">
      <header className="max-w-6xl mx-auto flex items-center justify-between px-5 sm:px-8 py-5">
        <Link href="/" className="flex items-center gap-2">
          <SaturnLogo size={48} tone="dark" />
          <span className="font-display font-semibold text-xl tracking-tight">Saturn</span>
        </Link>
        <Link href="/login" className="text-sm font-semibold text-[#6B655C] hover:text-[#2B2A27] transition-colors whitespace-nowrap">
          Se connecter
        </Link>
      </header>

      <main>
        {/* ── Intro ── */}
        <section className="max-w-6xl mx-auto grid lg:grid-cols-[1fr_1.25fr] gap-10 lg:gap-14 items-center px-5 sm:px-8 pt-8 pb-20">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl font-medium leading-[1.1]">
              Discuter, tout simplement.
            </h1>
            <p className="mt-6 text-lg text-[#6B655C] leading-relaxed">
              Saturn est une messagerie que j’ai créée seul, pendant mon master. On y écrit à ses proches,
              on monte un groupe pour un projet ou une communauté pour ses passions, et on s’appelle en
              vidéo sans rien installer. Entre, essaie, et dis-moi ce que tu en penses.
            </p>

            <div className="mt-8 flex flex-col gap-3 max-w-sm">
              <Link
                href="/chat"
                prefetch={false}
                className="w-full py-3.5 rounded-xl text-center text-white font-bold text-[15px] bg-[#C96442] hover:bg-[#B5573A] transition-colors"
              >
                Ouvrir l&apos;application
              </Link>
              <DemoLoginButton />
            </div>
            <p className="mt-4 text-sm text-[#9C968B]">
              Pas encore de compte ?{' '}
              <Link href="/signup" className="font-semibold text-[#C96442] hover:underline">
                Inscris-toi
              </Link>
              , c&apos;est gratuit.
            </p>
          </div>

          <Screenshot image={shotConversation} alt="Conversation privée avec Léa dans Saturn" priority />
        </section>

        {/* ── Visite ── */}
        <section className="bg-[#FBFAF7] border-y border-[rgba(60,52,40,0.08)]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20 flex flex-col gap-20">
            {TOUR.map((item, i) => (
              <div
                key={item.title}
                className={`grid gap-8 lg:gap-14 items-center ${i % 2 === 1 ? 'lg:grid-cols-[1.4fr_1fr]' : 'lg:grid-cols-[1fr_1.4fr]'}`}
              >
                <div className={i % 2 === 1 ? 'lg:order-2' : ''}>
                  <h2 className="font-display text-3xl font-medium">{item.title}</h2>
                  <p className="mt-4 text-[#6B655C] leading-relaxed">{item.text}</p>
                </div>
                <Screenshot image={item.image} alt={item.alt} />
              </div>
            ))}
          </div>
        </section>

        {/* ── Pour les curieux (et les recruteurs) ── */}
        <section className="max-w-3xl mx-auto px-5 sm:px-8 py-20">
          <h2 className="font-display text-3xl font-medium">Comment c’est fait</h2>
          <div className="mt-5 space-y-4 text-[#6B655C] leading-relaxed">
            <p>
              Le serveur tourne sous NestJS avec PostgreSQL et Prisma. Les messages, les accusés de lecture et la
              présence passent en temps réel par Socket.IO, et les appels audio et vidéo en pair-à-pair avec WebRTC.
            </p>
            <p>
              L’interface est en Next.js et Tailwind. Le tout se lance avec Docker derrière Nginx, et une version
              mobile en React Native est en préparation.
            </p>
          </div>
          <a
            href="https://github.com/Franckprivat/Saturn"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block mt-6 font-semibold text-[#C96442] hover:underline"
          >
            Lire le code sur GitHub →
          </a>
        </section>
      </main>

      <footer className="border-t border-[rgba(60,52,40,0.08)]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 text-sm text-[#9C968B]">
          Saturn, un projet personnel de Franck.
        </div>
      </footer>
    </div>
  );
}
