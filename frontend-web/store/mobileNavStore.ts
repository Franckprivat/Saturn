import { useEffect } from 'react';
import { create } from 'zustand';

// Sur téléphone, la barre de navigation du bas est masquée quand une
// conversation (ou un salon) est ouverte en plein écran, comme sur WhatsApp.
interface MobileNavState {
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
}

export const useMobileNavStore = create<MobileNavState>((set) => ({
  hidden: false,
  setHidden: (hidden) => set({ hidden }),
}));

// Masque la barre du bas tant que `hidden` est vrai, et la réaffiche en quittant la page
export function useHideMobileNav(hidden: boolean) {
  const setHidden = useMobileNavStore((s) => s.setHidden);
  useEffect(() => {
    setHidden(hidden);
    return () => setHidden(false);
  }, [hidden, setHidden]);
}
