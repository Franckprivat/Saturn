interface SaturnLogoProps {
  size?: number;
  className?: string;
  /** Force la couleur : 'auto' suit le thème, 'dark' = noir, 'light' = blanc */
  tone?: 'auto' | 'dark' | 'light';
  /** Ajoute un drop-shadow coloré (accent) + ombre douce pour que le logo ressorte */
  glow?: boolean;
}

export function SaturnLogo({ size = 40, className = '', tone = 'auto', glow = false }: SaturnLogoProps) {
  const invert = tone === 'auto' ? 'var(--logo-invert, 0)' : tone === 'light' ? '1' : '0';
  const filter = glow
    ? `invert(${invert}) drop-shadow(0 0 10px var(--sat-accent-glow)) drop-shadow(0 0 20px var(--sat-accent-glow)) drop-shadow(0 3px 10px rgba(0,0,0,0.18))`
    : `invert(${invert})`;
  return (
    <img
      src="/logo.png"
      alt="Saturn"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block', filter }}
    />
  );
}

/**
 * Logo Saturn dans un squircle dégradé accent — version "badge" bien visible.
 * Utilise toujours le logo blanc (sur fond coloré).
 */
export function SaturnLogoBadge({
  size = 48,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const pad = Math.round(size * 0.12);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: '28%',
        background: 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))',
        boxShadow: '0 4px 18px var(--sat-accent-glow), 0 1px 4px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <img
        src="/logo.png"
        alt="Saturn"
        width={size - pad * 2}
        height={size - pad * 2}
        style={{ objectFit: 'contain', display: 'block', filter: 'invert(1)' }}
      />
    </div>
  );
}
