interface SaturnLogoProps {
  size?: number;
  className?: string;
}

export function SaturnLogo({ size = 40, className = '' }: SaturnLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Masque de chat — inspiré du logo */}
      <path
        d="M50 85 C28 85 15 68 15 50 C15 32 50 5 50 5 C50 5 85 32 85 50 C85 68 72 85 50 85Z"
        fill="white"
      />
      {/* Oreille gauche */}
      <path
        d="M22 40 C18 28 15 15 20 10 C28 18 32 30 30 42Z"
        fill="white"
      />
      {/* Oreille droite */}
      <path
        d="M78 40 C82 28 85 15 80 10 C72 18 68 30 70 42Z"
        fill="white"
      />
      {/* Oeil gauche */}
      <ellipse cx="36" cy="50" rx="9" ry="12" fill="#1a1a2e" />
      {/* Oeil droit */}
      <ellipse cx="64" cy="50" rx="9" ry="12" fill="#1a1a2e" />
      {/* Nez */}
      <path d="M50 60 L46 68 L54 68 Z" fill="#1a1a2e" opacity="0.4" />
    </svg>
  );
}

export function SaturnLogoGradient({ size = 40, className = '' }: SaturnLogoProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#60A5FA] shadow-lg shadow-[#2563EB]/30 ${className}`}
      style={{ width: size, height: size }}
    >
      <SaturnLogo size={size * 0.65} />
    </div>
  );
}
