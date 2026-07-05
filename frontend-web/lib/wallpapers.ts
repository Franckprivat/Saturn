import type { CSSProperties } from 'react';
import { mediaUrl } from './media';

/**
 * Fonds d'écran de discussion (façon WhatsApp).
 *
 * Valeur persistée dans le profil (`user.chatWallpaper`) :
 *  - null / ''            → fond par défaut du thème
 *  - `preset:<id>`        → un des presets ci-dessous
 *  - `url:<https://...>`  → image personnalisée uploadée
 */

// Motif « doodle » : petites formes griffonnées, neutres (lisible en clair et sombre)
const DOODLE_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='140' height='140'>` +
    `<g fill='none' stroke='#7f7f7f' stroke-opacity='0.16' stroke-width='2' stroke-linecap='round'>` +
    `<circle cx='24' cy='22' r='7'/>` +
    `<path d='M70 12l6 12h-12z'/>` +
    `<path d='M112 28c-6-8 8-14 8-4 0 6-8 10-8 4z'/>` +
    `<rect x='14' y='84' width='20' height='14' rx='4'/><path d='M20 98l-5 7'/>` +
    `<path d='M76 78h14M83 71v14'/>` +
    `<circle cx='118' cy='100' r='5'/>` +
    `<path d='M40 124c4-6 12-6 16 0'/>` +
    `<path d='M96 128l4-8 4 8'/>` +
    `</g></svg>`,
);

// Motif « pois » discret
const DOTS_SVG = encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='26' height='26'>` +
    `<circle cx='13' cy='13' r='1.6' fill='#7f7f7f' fill-opacity='0.2'/>` +
    `</svg>`,
);

export interface WallpaperPreset {
  id: string;
  label: string;
  /** Valeur CSS `background` complète du preset (aussi utilisée pour l'aperçu). */
  css: string;
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'doodle', label: 'Doodle', css: `url("data:image/svg+xml,${DOODLE_SVG}") repeat` },
  { id: 'dots', label: 'Pois', css: `url("data:image/svg+xml,${DOTS_SVG}") repeat` },
  { id: 'sunset', label: 'Coucher de soleil', css: 'linear-gradient(135deg,#FF9A8B 0%,#FF6A88 55%,#FF99AC 100%)' },
  { id: 'ocean', label: 'Océan', css: 'linear-gradient(135deg,#1A2980 0%,#26D0CE 100%)' },
  { id: 'forest', label: 'Forêt', css: 'linear-gradient(135deg,#134E5E 0%,#71B280 100%)' },
  { id: 'night', label: 'Nuit', css: 'linear-gradient(135deg,#0f0c29 0%,#302b63 55%,#24243e 100%)' },
  { id: 'candy', label: 'Candy', css: 'linear-gradient(135deg,#FC5C7D 0%,#6A82FB 100%)' },
  { id: 'gold', label: 'Or', css: 'linear-gradient(135deg,#F7971E 0%,#FFD200 100%)' },
];

/** Style CSS à appliquer au fil de discussion pour une valeur persistée donnée. */
export function wallpaperStyle(value: string | null | undefined): CSSProperties {
  if (!value) return {};
  if (value.startsWith('preset:')) {
    const preset = WALLPAPER_PRESETS.find((p) => p.id === value.slice(7));
    return preset ? { background: preset.css } : {};
  }
  if (value.startsWith('url:')) {
    const url = mediaUrl(value.slice(4));
    if (!url) return {};
    // Voile sombre léger pour garder les bulles lisibles sur n'importe quelle photo
    return {
      background: `linear-gradient(rgba(0,0,0,0.28),rgba(0,0,0,0.28)), url("${url}") center / cover no-repeat`,
    };
  }
  return {};
}
