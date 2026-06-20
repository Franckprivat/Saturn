interface SaturnLogoProps {
  size?: number;
  className?: string;
  /** Force la couleur : 'auto' suit le thème, 'dark' = noir, 'light' = blanc */
  tone?: 'auto' | 'dark' | 'light';
}

/**
 * Logo Saturn — image monochrome qui s'adapte au thème.
 * `--logo-invert` vaut 0 (noir) sur les thèmes clairs, 1 (blanc) sur les sombres.
 */
export function SaturnLogo({ size = 40, className = '', tone = 'auto' }: SaturnLogoProps) {
  const invert = tone === 'auto' ? 'var(--logo-invert, 0)' : tone === 'light' ? '1' : '0';
  return (
    <img
      src="/logo.png"
      alt="Saturn"
      width={size}
      height={size}
      className={className}
      style={{ objectFit: 'contain', display: 'block', filter: `invert(${invert})` }}
    />
  );
}
