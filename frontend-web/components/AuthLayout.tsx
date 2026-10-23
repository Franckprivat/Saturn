'use client';

import { ReactNode } from 'react';
import { SaturnLogo } from './SaturnLogo';

/* ── Carte photo flottante (placeholder dégradé + silhouette) ── */
function PhotoCard({
  gradient, rotate, float, delay, style,
}: {
  gradient: string; rotate: number; float: 'a' | 'b'; delay: number; style: React.CSSProperties;
}) {
  return (
    <div className="absolute" style={style}>
      <div className={float === 'a' ? 'auth-float' : 'auth-float-2'} style={{ animationDelay: `${delay}s` }}>
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            width: '100%', height: '100%',
            transform: `rotate(${rotate}deg)`,
            background: gradient,
            border: '3px solid #fff',
            boxShadow: '0 16px 40px rgba(201,100,66,0.20)',
          }}
        >
          <svg viewBox="0 0 80 96" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <rect width="80" height="60" fill="rgba(255,255,255,0.16)" />
            <rect y="60" width="80" height="36" fill="rgba(0,0,0,0.10)" />
            <circle cx="40" cy="36" r="13" fill="rgba(255,255,255,0.35)" />
            <path d="M16 78 Q40 58 64 78 L64 96 L16 96 Z" fill="rgba(255,255,255,0.28)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ── Mockup téléphone (style messagerie, écran clair) ── */
function PhoneMockup() {
  const messages = [
    { text: 'Le brunch était incroyable ! 🥐', own: false },
    { text: 'Carrément 🔥', own: true },
    { text: "On remet ça bientôt c'est sûr", own: false },
    { text: 'Oui carrément, on planifie ça !', own: true },
  ];

  return (
    <div className="relative" style={{ width: 360, height: 480 }}>
      {/* Cartes photos flottantes */}
      <PhotoCard gradient="linear-gradient(145deg,#A0593C,#C96442)" rotate={-9} float="a" delay={0}   style={{ width: 84, height: 100, left: 0,  top: 56  }} />
      <PhotoCard gradient="linear-gradient(145deg,#B5734A,#D9A574)" rotate={7}  float="b" delay={0.8} style={{ width: 72, height: 86,  left: 8,  top: 190 }} />
      <PhotoCard gradient="linear-gradient(145deg,#C96442,#DA8A6A)" rotate={-6} float="a" delay={1.6} style={{ width: 76, height: 90,  left: 2,  top: 312 }} />
      <PhotoCard gradient="linear-gradient(145deg,#8C7B68,#B8AA97)" rotate={9}  float="b" delay={0.4} style={{ width: 80, height: 94,  right: 0, top: 78  }} />
      <PhotoCard gradient="linear-gradient(145deg,#DA8A6A,#E8B89A)" rotate={-8} float="a" delay={1.2} style={{ width: 70, height: 84,  right: 6, top: 232 }} />

      {/* Halo */}
      <div
        className="absolute rounded-full blur-3xl pointer-events-none auth-blob"
        style={{ width: 260, height: 260, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: 'rgba(218,138,106,0.35)' }}
      />

      {/* Téléphone */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden auth-pop"
        style={{
          width: 224, height: 464, borderRadius: 40,
          background: '#FFFFFF',
          border: '1px solid rgba(30,41,59,0.08)',
          boxShadow: '0 40px 90px rgba(201,100,66,0.28), 0 8px 24px rgba(30,41,59,0.10)',
        }}
      >
        {/* Dynamic island */}
        <div className="mx-auto mt-3 rounded-full bg-[#0f172a] flex-shrink-0" style={{ width: 70, height: 20 }} />

        {/* Status bar */}
        <div className="flex justify-between items-center px-5 mt-1.5 flex-shrink-0">
          <span className="text-[#94A3B8] font-semibold" style={{ fontSize: 9 }}>9:41</span>
          <div className="flex gap-0.5 items-end">{[3, 4, 5].map((h) => (<div key={h} className="rounded-sm bg-[#94A3B8]" style={{ width: 3, height: h }} />))}</div>
        </div>

        {/* Header conversation */}
        <div className="flex items-center gap-2 px-3 py-2 mt-1 border-b border-[#F1F5F9] flex-shrink-0">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0" style={{ width: 26, height: 26, fontSize: 10, background: 'linear-gradient(135deg,#C96442,#DA8A6A)' }}>A</div>
          <div className="flex-1 min-w-0">
            <div className="text-[#2B2A27] font-semibold leading-none" style={{ fontSize: 10 }}>Anna Dominik</div>
            <div className="text-[#10B981] mt-0.5 font-medium" style={{ fontSize: 8 }}>Active à l&apos;instant</div>
          </div>
          {[
            <path key="p" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />,
            <g key="v"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></g>,
          ].map((icon, i) => (
            <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C96442" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 px-3 py-2.5 flex flex-col gap-1.5 overflow-hidden">
          {messages.map(({ text, own }, i) => (
            <div key={i} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
              <div
                className="leading-snug"
                style={{
                  fontSize: 9.5, maxWidth: '80%', padding: '6px 10px',
                  background: own ? 'linear-gradient(135deg,#C96442,#DA8A6A)' : '#F1F5F9',
                  color: own ? '#fff' : '#2B2A27',
                  borderRadius: own ? '15px 15px 4px 15px' : '15px 15px 15px 4px',
                }}
              >{text}</div>
            </div>
          ))}
        </div>

        {/* Réactions */}
        <div className="flex gap-2 px-3 py-1 flex-shrink-0">{['😍', '❤️', '😂', '👍', '🥐'].map((e) => (<span key={e} style={{ fontSize: 13 }}>{e}</span>))}</div>

        {/* Barre d'envoi */}
        <div className="px-3 pb-5 pt-1 flex-shrink-0 flex items-center gap-2">
          <div className="flex-1 flex items-center justify-between px-3 rounded-full bg-[#F1F5F9]" style={{ height: 30 }}>
            <span className="text-[#94A3B8]" style={{ fontSize: 10 }}>Aa</span>
            <span style={{ fontSize: 11 }}>😊</span>
          </div>
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ width: 30, height: 30, background: 'linear-gradient(135deg,#C96442,#DA8A6A)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Showcase (panneau gauche desktop / haut tablette) ── */
function Showcase({ tagline }: { tagline: [string, string] }) {
  return (
    <div
      className="hidden md:flex flex-col relative overflow-hidden lg:w-[55%] lg:min-h-screen px-10 py-10"
      style={{ background: 'linear-gradient(160deg,#F0EEE6 0%,#F5F4EE 55%,#EDE8DC 100%)' }}
    >
      {/* Grille décorative */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(#2B2A27 1px, transparent 1px), linear-gradient(90deg, #2B2A27 1px, transparent 1px)',
        backgroundSize: '44px 44px', opacity: 0.035,
      }} />
      {/* Blobs */}
      <div className="absolute -top-24 -left-16 w-80 h-80 rounded-full blur-3xl pointer-events-none auth-blob" style={{ background: 'rgba(201,100,66,0.16)' }} />
      <div className="absolute bottom-0 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none auth-float-2" style={{ background: 'rgba(218,138,106,0.18)' }} />

      {/* Logo */}
      <div className="flex items-center gap-3 relative z-10 auth-rise">
        <SaturnLogo size={72} tone="dark" glow />
        <span className="font-display font-semibold text-xl tracking-tight text-[#2B2A27]">Saturn</span>
      </div>

      {/* Phone */}
      <div className="flex-1 flex items-center justify-center relative z-10 my-8">
        <PhoneMockup />
      </div>

      {/* Tagline */}
      <div className="relative z-10 auth-rise" style={{ animationDelay: '0.1s' }}>
        <p className="font-display text-[#2B2A27] text-[30px] font-medium leading-tight">{tagline[0]}</p>
        <p className="font-display text-[30px] font-medium italic leading-tight text-[#C96442]">{tagline[1]}</p>
        <p className="mt-4 text-sm text-[#6B655C]">Messages · Communautés · Appels chiffrés</p>
      </div>
    </div>
  );
}

/* ── Hero compact mobile ── */
function MobileHero({ tagline }: { tagline: [string, string] }) {
  return (
    <div
      className="md:hidden relative overflow-hidden px-6 pt-10 pb-8"
      style={{ background: 'linear-gradient(160deg,#F0EEE6 0%,#F5F4EE 100%)' }}
    >
      <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl pointer-events-none auth-blob" style={{ background: 'rgba(201,100,66,0.18)' }} />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-3 mb-4 auth-rise">
          <SaturnLogo size={64} tone="dark" glow />
          <span className="font-display font-semibold text-2xl tracking-tight text-[#2B2A27]">Saturn</span>
        </div>
        {/* Mini bulles teaser */}
        <div className="flex items-end gap-2 mb-4 auth-pop" style={{ animationDelay: '0.1s' }}>
          <div className="px-3 py-1.5 rounded-2xl rounded-bl-md bg-[#EDEBE2] text-[#2B2A27]" style={{ fontSize: 11 }}>Le brunch était top 🥐</div>
          <div className="px-3 py-1.5 rounded-2xl rounded-br-md text-white" style={{ fontSize: 11, background: 'linear-gradient(135deg,#C96442,#DA8A6A)' }}>Carrément 🔥</div>
        </div>
        <h2 className="font-display text-xl font-medium text-[#2B2A27] leading-tight">
          {tagline[0]}{' '}
          <span className="italic text-[#C96442]">{tagline[1]}</span>
        </h2>
      </div>
    </div>
  );
}

/* ── Layout exporté ── */
export function AuthLayout({ tagline, children }: { tagline: [string, string]; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#F5F4EE]">
      <Showcase tagline={tagline} />
      <MobileHero tagline={tagline} />

      {/* Panneau formulaire */}
      <div className="flex-1 lg:w-[45%] flex items-start md:items-center justify-center px-5 sm:px-8 py-8 md:py-12 lg:bg-[#FBFAF7]">
        <div className="w-full max-w-sm auth-rise" style={{ animationDelay: '0.05s' }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Champ réutilisable (thème clair) ── */
export function AuthInput({
  label, type = 'text', value, onChange, placeholder, hint, minLength, autoComplete, action,
}: {
  label: string; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; minLength?: number; autoComplete?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6B655C]">{label}</label>
        {action}
      </div>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} required minLength={minLength} autoComplete={autoComplete}
        className="w-full px-4 py-3 rounded-xl bg-white border border-[rgba(60,52,40,0.14)] text-[#2B2A27] text-sm placeholder:text-[#9C968B] outline-none transition-all focus:border-[#C96442] focus:ring-4 focus:ring-[#C96442]/10"
      />
      {hint && <p className="text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

/* ── Bouton primaire réutilisable ── */
export function AuthButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full mt-1 py-3.5 rounded-xl text-white font-bold text-[15px] bg-gradient-to-r from-[#C96442] to-[#DA8A6A] shadow-lg shadow-[#C96442]/25 transition-all hover:shadow-[#C96442]/40 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0"
    >
      {loading ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Un instant…
        </span>
      ) : children}
    </button>
  );
}

/* ── Bandeau d'erreur ── */
export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 text-sm rounded-xl px-4 py-3 bg-[#FEF2F2] border border-[#FECACA] text-[#EF4444]">
      <span className="mt-px">⚠</span><span>{message}</span>
    </div>
  );
}
