interface SpinnerProps {
  size?: number;
  className?: string;
}

/** Spinner simple — anneau qui tourne aux couleurs Saturn */
export function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <span
      className={`inline-block rounded-full animate-spin ${className}`}
      style={{
        width: size,
        height: size,
        border: `${Math.max(2, size / 12)}px solid var(--sat-border-2)`,
        borderTopColor: 'var(--sat-accent)',
      }}
    />
  );
}

/** Écran de chargement plein — badge Saturn (anneau qui tourne + halo + respiration) */
export function PageLoader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div
      className="flex-1 w-full h-full flex flex-col items-center justify-center gap-8"
      style={{ background: 'var(--sat-void)' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
        {/* Halo large qui respire */}
        <span
          className="absolute rounded-full"
          style={{
            width: 160, height: 160,
            background: 'radial-gradient(circle, var(--sat-accent-glow), transparent 65%)',
            animation: 'loader-breathe 1.8s ease-in-out infinite',
          }}
        />
        {/* Anneau qui tourne */}
        <span
          className="absolute rounded-full animate-spin"
          style={{
            width: 148, height: 148,
            border: '3px solid var(--sat-border-2)',
            borderTopColor: 'var(--sat-accent)',
          }}
        />
        {/* Logo avec respiration douce */}
        <img
          src="/logo.png"
          alt="Saturn"
          width={112}
          height={112}
          className="relative"
          style={{
            objectFit: 'contain',
            display: 'block',
            filter: 'invert(var(--logo-invert, 0)) drop-shadow(0 0 12px var(--sat-accent-glow)) drop-shadow(0 0 24px var(--sat-accent-glow)) drop-shadow(0 4px 10px rgba(0,0,0,0.15))',
            animation: 'loader-bob 1.8s ease-in-out infinite',
          }}
        />
      </div>
      <div className="flex flex-col items-center gap-1">
        <span className="font-display text-lg font-medium" style={{ color: 'var(--sat-text)' }}>Saturn</span>
        <span className="text-xs tracking-widest uppercase" style={{ color: 'var(--sat-muted)' }}>{label}</span>
      </div>
    </div>
  );
}

/** Trois points qui rebondissent — pour "en train d'écrire" ou chargement inline */
export function DotsLoader({ color = 'var(--sat-muted)' }: { color?: string }) {
  return (
    <span className="inline-flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full animate-bounce"
          style={{ background: color, animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </span>
  );
}
