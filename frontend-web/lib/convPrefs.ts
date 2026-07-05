/**
 * Préférences locales par conversation (façon WhatsApp) :
 * fond d'écran et couleur des bulles propres à UNE conversation.
 *
 * Stockées en localStorage, par utilisateur : elles ne sont visibles que par
 * toi et n'affectent jamais l'autre utilisateur.
 */

export interface ConvPrefs {
  /** Fond d'écran de cette conversation. Absent = hériter du fond global du profil. */
  wallpaper?: string | null;
  /** Couleur des bulles ("hex1|hex2" → dégradé). Absent = accent du thème. */
  bubble?: string;
}

/** Palette de couleurs de conversation (dégradés de bulles). */
export const BUBBLE_COLORS: { id: string; label: string; value: string }[] = [
  { id: 'blue', label: 'Bleu', value: '#2563EB|#60A5FA' },
  { id: 'green', label: 'Vert', value: '#10B981|#34D399' },
  { id: 'purple', label: 'Violet', value: '#7C3AED|#A78BFA' },
  { id: 'pink', label: 'Rose', value: '#EC4899|#F43F5E' },
  { id: 'orange', label: 'Orange', value: '#F97316|#EAB308' },
  { id: 'red', label: 'Rouge', value: '#EF4444|#F97316' },
  { id: 'teal', label: 'Turquoise', value: '#0D9488|#2DD4BF' },
  { id: 'slate', label: 'Ardoise', value: '#475569|#94A3B8' },
];

function key(userId: string, conversationId: string) {
  return `saturn_convprefs_${userId}_${conversationId}`;
}

export function getConvPrefs(userId: string, conversationId: string): ConvPrefs {
  if (typeof window === 'undefined' || !userId || !conversationId) return {};
  try {
    return JSON.parse(localStorage.getItem(key(userId, conversationId)) || '{}');
  } catch {
    return {};
  }
}

export function setConvPrefs(userId: string, conversationId: string, patch: Partial<ConvPrefs>) {
  if (typeof window === 'undefined') return;
  const next: ConvPrefs = { ...getConvPrefs(userId, conversationId) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) delete (next as any)[k];
    else (next as any)[k] = v;
  }
  if (Object.keys(next).length === 0) localStorage.removeItem(key(userId, conversationId));
  else localStorage.setItem(key(userId, conversationId), JSON.stringify(next));
}

/** CSS du dégradé de bulle pour une valeur "hex1|hex2". */
export function bubbleGradient(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const [c1, c2] = value.split('|');
  if (!c1 || !c2) return undefined;
  return `linear-gradient(135deg, ${c1}, ${c2})`;
}
