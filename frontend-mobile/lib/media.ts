import { SERVER_URL } from './config';

const LEGACY_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Résout une URL de média stockée par le backend (même logique que le site) :
 * - `/uploads/xxx` (relatif)                → `<serveur>/uploads/xxx`
 * - `http://localhost:3001/uploads/xxx`     → réécrite vers le serveur courant
 * - URL absolue externe (DiceBear, R2…)     → inchangée
 */
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/')) return `${SERVER_URL}${url}`;
  const match = url.match(/^https?:\/\/([^/:]+)(?::\d+)?(\/uploads\/.*)$/);
  if (match && LEGACY_HOSTS.has(match[1])) return `${SERVER_URL}${match[2]}`;
  return url;
}

/**
 * Couleur d'avatar : le site stocke des classes Tailwind
 * (« from-[#2563EB] to-[#60A5FA] ») ; on en extrait les couleurs hexadécimales.
 */
export function avatarColors(avatarColor: string | null | undefined): [string, string] {
  const hexes = avatarColor?.match(/#[0-9a-fA-F]{3,8}/g);
  if (hexes && hexes.length >= 2) return [hexes[0], hexes[1]];
  if (hexes && hexes.length === 1) return [hexes[0], hexes[0]];
  return ['#2563EB', '#60A5FA'];
}
