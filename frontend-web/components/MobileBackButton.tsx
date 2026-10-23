'use client';

// Bouton retour affiché uniquement sur téléphone (vue liste ↔ vue détail)
export function MobileBackButton({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="md:hidden -ml-2 w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition active:opacity-60"
      style={{ color: 'var(--sat-text)' }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
