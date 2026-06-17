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

/** Écran de chargement plein — logo pulsant + spinner */
export function PageLoader({ label = 'Chargement...' }: { label?: string }) {
  return (
    <div
      className="flex-1 w-full h-full flex flex-col items-center justify-center gap-5"
      style={{ background: 'var(--sat-void)' }}
    >
      <div className="relative flex items-center justify-center">
        {/* Halo pulsant */}
        <span
          className="absolute rounded-full"
          style={{
            width: 80,
            height: 80,
            background: 'radial-gradient(circle, var(--sat-accent-glow), transparent 70%)',
            animation: 'pulse-dot 1.5s ease-in-out infinite',
          }}
        />
        {/* Logo */}
        <div
          className="relative w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))',
            boxShadow: '0 8px 30px var(--sat-accent-glow)',
          }}
        >
          <svg width="34" height="34" viewBox="0 0 100 100" fill="none">
            <path d="M50 85 C28 85 15 68 15 50 C15 32 50 5 50 5 C50 5 85 32 85 50 C85 68 72 85 50 85Z" fill="white" />
            <path d="M22 40 C18 28 15 15 20 10 C28 18 32 30 30 42Z" fill="white" />
            <path d="M78 40 C82 28 85 15 80 10 C72 18 68 30 70 42Z" fill="white" />
            <ellipse cx="36" cy="50" rx="9" ry="12" fill="#1a1a2e" />
            <ellipse cx="64" cy="50" rx="9" ry="12" fill="#1a1a2e" />
          </svg>
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <Spinner size={16} />
        <span className="text-sm font-medium" style={{ color: 'var(--sat-muted)' }}>{label}</span>
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
