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

/** Écran de chargement plein — logo Saturn (anneau qui tourne + halo + respiration) */
export function PageLoader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div
      className="flex-1 w-full h-full flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--sat-void)' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 96, height: 96 }}>
        {/* Halo qui respire */}
        <span
          className="absolute rounded-full"
          style={{
            width: 96, height: 96,
            background: 'radial-gradient(circle, var(--sat-accent-glow), transparent 70%)',
            animation: 'loader-breathe 1.8s ease-in-out infinite',
          }}
        />
        {/* Anneau qui tourne */}
        <span
          className="absolute rounded-full animate-spin"
          style={{
            width: 88, height: 88,
            border: '3px solid var(--sat-border-2)',
            borderTopColor: 'var(--sat-accent)',
          }}
        />
        {/* Logo (respiration douce, adaptatif au thème) */}
        <img
          src="/logo.png"
          alt="Saturn"
          width={48}
          height={48}
          className="relative"
          style={{ objectFit: 'contain', display: 'block', filter: 'invert(var(--logo-invert, 0))', animation: 'loader-bob 1.8s ease-in-out infinite' }}
        />
      </div>
      <span className="text-sm font-medium tracking-wide" style={{ color: 'var(--sat-muted)' }}>{label}</span>
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
