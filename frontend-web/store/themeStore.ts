import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeName = 'claude' | 'dark' | 'light' | 'solarized' | 'midnight' | 'forest';
export type AccentColor = 'clay' | 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'pink';

export interface ThemePalette {
  label: string;
  isDark: boolean;
  bg: string;          // --sat-void / --sat-main (fond app)
  sidebar: string;     // --sat-sidebar
  panel: string;       // --sat-panel
  surface: string;     // --sat-surface (cartes)
  hover: string;       // --sat-hover
  active: string;      // --sat-active
  glass: string;       // --sat-glass
  glassBorder: string; // --sat-glass-border
  border: string;      // --sat-border
  border2: string;     // --sat-border-2
  text: string;        // --sat-text
  muted: string;       // --sat-muted
  faint: string;       // --sat-faint
}

export const THEMES: Record<ThemeName, ThemePalette> = {
  claude: {
    label: 'Claude', isDark: false,
    bg: '#F5F4EE', sidebar: '#EFEDE4', panel: '#FBFAF7', surface: '#FBFAF7',
    hover: '#EDEBE2', active: '#E4E1D6',
    glass: 'rgba(245,244,238,0.85)', glassBorder: 'rgba(120,90,60,0.14)',
    border: 'rgba(60,52,40,0.10)', border2: 'rgba(60,52,40,0.16)',
    text: '#2B2A27', muted: '#6B655C', faint: '#9C968B',
  },
  light: {
    label: 'Light', isDark: false,
    bg: '#F8FAFC', sidebar: '#FFFFFF', panel: '#FFFFFF', surface: '#FFFFFF',
    hover: '#F1F5F9', active: '#E2E8F0',
    glass: 'rgba(255,255,255,0.88)', glassBorder: 'rgba(37,99,235,0.12)',
    border: 'rgba(30,41,59,0.08)', border2: 'rgba(30,41,59,0.14)',
    text: '#1E293B', muted: '#64748B', faint: '#94A3B8',
  },
  dark: {
    label: 'Dark', isDark: true,
    bg: '#0B0F19', sidebar: '#0F1623', panel: '#131C2B', surface: '#131C2B',
    hover: '#1C2638', active: '#243044',
    glass: 'rgba(19,28,43,0.85)', glassBorder: 'rgba(255,255,255,0.08)',
    border: 'rgba(255,255,255,0.07)', border2: 'rgba(255,255,255,0.12)',
    text: '#E8EDF5', muted: '#94A3B8', faint: '#64748B',
  },
  midnight: {
    label: 'Midnight', isDark: true,
    bg: '#0B0A1A', sidebar: '#110F26', panel: '#161334', surface: '#161334',
    hover: '#1F1A45', active: '#2A2356',
    glass: 'rgba(22,19,52,0.85)', glassBorder: 'rgba(124,58,237,0.18)',
    border: 'rgba(150,130,255,0.10)', border2: 'rgba(150,130,255,0.18)',
    text: '#EAE6FF', muted: '#A99FD6', faint: '#6E649E',
  },
  solarized: {
    label: 'Solarized', isDark: true,
    bg: '#002029', sidebar: '#002B36', panel: '#073642', surface: '#073642',
    hover: '#0A4351', active: '#0E5160',
    glass: 'rgba(7,54,66,0.85)', glassBorder: 'rgba(147,161,161,0.18)',
    border: 'rgba(147,161,161,0.12)', border2: 'rgba(147,161,161,0.20)',
    text: '#FDF6E3', muted: '#93A1A1', faint: '#657B83',
  },
  forest: {
    label: 'Forest', isDark: true,
    bg: '#0A1A0A', sidebar: '#0D1F0D', panel: '#142114', surface: '#142114',
    hover: '#1B2E1B', active: '#233B23',
    glass: 'rgba(20,33,20,0.85)', glassBorder: 'rgba(80,160,80,0.18)',
    border: 'rgba(80,160,80,0.12)', border2: 'rgba(80,160,80,0.20)',
    text: '#E8F5E8', muted: '#8FB98F', faint: '#5E835E',
  },
};

export interface AccentPalette {
  label: string;
  primary: string;
  secondary: string;
  hex: string;
  glow: string;
}

export const ACCENTS: Record<AccentColor, AccentPalette> = {
  clay:   { label: 'Argile', primary: '#C96442', secondary: '#DA8A6A', hex: '#C96442', glow: 'rgba(201,100,66,0.22)' },
  blue:   { label: 'Bleu',   primary: '#2563EB', secondary: '#60A5FA', hex: '#2563EB', glow: 'rgba(37,99,235,0.22)' },
  purple: { label: 'Violet', primary: '#7C3AED', secondary: '#A78BFA', hex: '#7C3AED', glow: 'rgba(124,58,237,0.22)' },
  green:  { label: 'Vert',   primary: '#10B981', secondary: '#34D399', hex: '#10B981', glow: 'rgba(16,185,129,0.22)' },
  red:    { label: 'Rouge',  primary: '#EF4444', secondary: '#F97316', hex: '#EF4444', glow: 'rgba(239,68,68,0.22)' },
  orange: { label: 'Orange', primary: '#F97316', secondary: '#EAB308', hex: '#F97316', glow: 'rgba(249,115,22,0.22)' },
  pink:   { label: 'Rose',   primary: '#EC4899', secondary: '#F43F5E', hex: '#EC4899', glow: 'rgba(236,72,153,0.22)' },
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
      theme: 'claude',
      accent: 'clay',
      setTheme: (theme) => { set({ theme }); get().apply(); },
      setAccent: (accent) => { set({ accent }); get().apply(); },
      apply: () => {
        if (typeof document === 'undefined') return;
        const { theme, accent } = get();
        const t = THEMES[theme] ?? THEMES.light;
        const a = ACCENTS[accent] ?? ACCENTS.blue;
        const r = document.documentElement.style;
        const v = (k: string, val: string) => r.setProperty(k, val);

        // Surfaces & texte (variables réellement utilisées par l'app)
        v('--sat-void', t.bg);
        v('--sat-main', t.bg);
        v('--sat-sidebar', t.sidebar);
        v('--sat-panel', t.panel);
        v('--sat-surface', t.surface);
        v('--sat-hover', t.hover);
        v('--sat-active', t.active);
        v('--sat-glass', t.glass);
        v('--sat-glass-border', t.glassBorder);
        v('--sat-border', t.border);
        v('--sat-border-2', t.border2);
        v('--sat-text', t.text);
        v('--sat-muted', t.muted);
        v('--sat-faint', t.faint);

        // Accent
        v('--sat-accent', a.primary);
        v('--sat-accent2', a.secondary);
        v('--sat-accent3', a.secondary);
        v('--sat-accent-glow', a.glow);

        // Alias legacy (--bg, --text, …)
        v('--bg', t.bg);
        v('--surface', t.surface);
        v('--border', t.border);
        v('--text', t.text);
        v('--muted', t.muted);
        v('--accent', a.primary);
        v('--accent2', a.secondary);
        v('--accent-hex', a.hex);

        // Logo adaptatif (noir sur clair, blanc sur sombre)
        v('--logo-invert', t.isDark ? '1' : '0');

        // Schéma natif (scrollbars, inputs, color-scheme)
        document.documentElement.style.colorScheme = t.isDark ? 'dark' : 'light';
      },
    }),
    {
      name: 'saturn-theme',
      version: 1,
      migrate: () => ({ theme: 'claude' as ThemeName, accent: 'clay' as AccentColor }),
    },
  ),
);
