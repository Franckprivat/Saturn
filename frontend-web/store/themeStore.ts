import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'dark' | 'light' | 'solarized' | 'midnight' | 'forest';
export type AccentColor = 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'pink';

export const THEMES: Record<ThemeName, {
  label: string;
  bg: string; surface: string; border: string; text: string; muted: string;
}> = {
  dark: {
    label: 'Dark',
    bg: '#F8FAFC', surface: '#0C0C14', border: 'rgba(255,255,255,0.06)',
    text: '#ffffff', muted: 'rgba(255,255,255,0.3)',
  },
  midnight: {
    label: 'Midnight',
    bg: '#0D0D1A', surface: '#12122A', border: 'rgba(100,80,255,0.15)',
    text: '#e8e8ff', muted: 'rgba(200,180,255,0.35)',
  },
  solarized: {
    label: 'Solarized',
    bg: '#002b36', surface: '#073642', border: 'rgba(147,161,161,0.2)',
    text: '#fdf6e3', muted: 'rgba(253,246,227,0.45)',
  },
  forest: {
    label: 'Forest',
    bg: '#0d1f0d', surface: '#142114', border: 'rgba(80,160,80,0.15)',
    text: '#e8f5e8', muted: 'rgba(150,200,150,0.4)',
  },
  light: {
    label: 'Light',
    bg: '#F8FAFC', surface: '#FFFFFF', border: 'rgba(30,41,59,0.08)',
    text: '#1E293B', muted: '#64748B',
  },
};

export const ACCENTS: Record<AccentColor, { label: string; primary: string; secondary: string; hex: string }> = {
  purple: { label: 'Violet', primary: '#7C3AED', secondary: '#A78BFA', hex: '#7C3AED' },
  blue:   { label: 'Bleu',   primary: '#2563EB', secondary: '#60A5FA', hex: '#2563EB' },
  green:  { label: 'Vert',   primary: '#10B981', secondary: '#34D399', hex: '#10B981' },
  red:    { label: 'Rouge',  primary: '#EF4444', secondary: '#F97316', hex: '#EF4444' },
  orange: { label: 'Orange', primary: '#F97316', secondary: '#EAB308', hex: '#F97316' },
  pink:   { label: 'Rose',   primary: '#EC4899', secondary: '#F43F5E', hex: '#EC4899' },
};

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
        const { theme, accent } = get();
        const t = THEMES[theme];
        const a = ACCENTS[accent];
        const root = document.documentElement;
        root.style.setProperty('--bg', t.bg);
        root.style.setProperty('--surface', t.surface);
        root.style.setProperty('--border', t.border);
        root.style.setProperty('--text', t.text);
        root.style.setProperty('--muted', t.muted);
        root.style.setProperty('--accent', a.primary);
        root.style.setProperty('--accent2', a.secondary);
        root.style.setProperty('--accent-hex', a.hex);
      },
    }),
    { name: 'saturn-theme' },
  ),
);
