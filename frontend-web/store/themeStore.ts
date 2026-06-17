import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'light' | 'dark';
export type AccentColor = 'blue' | 'violet' | 'cyan' | 'emerald' | 'rose' | 'amber';

export const THEMES: Record<ThemeName, {
  label: string;
  bg: string; surface: string; border: string; text: string; muted: string;
}> = {
  light: {
    label: 'Clair',
    bg: '#F8FAFC', surface: '#FFFFFF', border: '#E2E8F0',
    text: '#1E293B', muted: '#64748B',
  },
  dark: {
    label: 'Sombre',
    bg: '#0F172A', surface: '#1E293B', border: '#334155',
    text: '#F1F5F9', muted: '#94A3B8',
  },
};

export const ACCENTS: Record<AccentColor, {
  label: string;
  primary: string; secondary: string;
  dark: string; darkSecondary: string;
  hex: string;
}> = {
  blue:    { label: 'Bleu',    primary: '#2563EB', secondary: '#60A5FA', dark: '#3B82F6', darkSecondary: '#60A5FA', hex: '#2563EB' },
  violet:  { label: 'Violet',  primary: '#8B5CF6', secondary: '#A78BFA', dark: '#A78BFA', darkSecondary: '#C4B5FD', hex: '#8B5CF6' },
  cyan:    { label: 'Cyan',    primary: '#0EA5E9', secondary: '#38BDF8', dark: '#38BDF8', darkSecondary: '#7DD3FC', hex: '#0EA5E9' },
  emerald: { label: 'Émeraude',primary: '#10B981', secondary: '#34D399', dark: '#34D399', darkSecondary: '#6EE7B7', hex: '#10B981' },
  rose:    { label: 'Rose',    primary: '#F43F5E', secondary: '#FB7185', dark: '#FB7185', darkSecondary: '#FDA4AF', hex: '#F43F5E' },
  amber:   { label: 'Ambre',   primary: '#F59E0B', secondary: '#FBBF24', dark: '#FBBF24', darkSecondary: '#FCD34D', hex: '#F59E0B' },
};

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface ThemeState {
  theme: ThemeName;
  accent: AccentColor;
  setTheme: (t: ThemeName) => void;
  setAccent: (a: AccentColor) => void;
  apply: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      accent: 'blue',
      setTheme: (theme) => { set({ theme }); get().apply(); },
      setAccent: (accent) => { set({ accent }); get().apply(); },
      apply: () => {
        if (typeof document === 'undefined') return;
        const { theme, accent } = get();
        const mode: ThemeName = theme === 'dark' ? 'dark' : 'light';
        const a = ACCENTS[accent] ?? ACCENTS.blue;
        const root = document.documentElement;

        // Bascule clair / sombre (les surfaces sont gérées en CSS)
        root.setAttribute('data-theme', mode);

        // Accent dynamique (override des variables --sat-accent*)
        const primary = mode === 'dark' ? a.dark : a.primary;
        const secondary = mode === 'dark' ? a.darkSecondary : a.secondary;
        root.style.setProperty('--sat-accent', primary);
        root.style.setProperty('--sat-accent2', secondary);
        root.style.setProperty('--sat-accent3', secondary);
        root.style.setProperty('--sat-accent-glow', hexToRgba(primary, mode === 'dark' ? 0.30 : 0.22));
      },
    }),
    { name: 'saturn-theme' },
  ),
);
