/**
 * Habillage de l'onglet navigateur pendant un appel (façon Meet/WhatsApp Web) :
 * titre explicite + favicon téléphone dessiné aux couleurs du thème actif.
 */

type CallTabState = 'incoming' | 'ringing' | 'active' | 'reconnecting';

let originalTitle: string | null = null;
let originalFavicon: string | null = null;

function themeColor(varName: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function faviconLink(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  return link;
}

/** Dessine un favicon rond aux couleurs du site avec un combiné téléphone blanc. */
function drawPhoneFavicon(background: string): string {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Pastille de fond (couleur du thème)
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = background;
  ctx.fill();

  // Combiné téléphone (path Feather « phone », recentré et agrandi)
  ctx.save();
  ctx.translate(size * 0.22, size * 0.22);
  ctx.scale(1.5, 1.5);
  const phone = new Path2D(
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.84a16 16 0 0 0 6.25 6.25l1.95-1.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  );
  ctx.fillStyle = '#ffffff';
  ctx.fill(phone);
  ctx.restore();

  return canvas.toDataURL('image/png');
}

/** Active l'habillage d'appel de l'onglet. */
export function setCallTab(state: CallTabState, peerName?: string) {
  if (typeof document === 'undefined') return;
  const link = faviconLink();
  if (originalTitle === null) originalTitle = document.title;
  if (originalFavicon === null) originalFavicon = link.href || '/icon.png';

  const titles: Record<CallTabState, string> = {
    incoming: `Appel entrant${peerName ? ` de ${peerName}` : ''} — Saturn`,
    ringing: `Appel en cours${peerName ? ` · ${peerName}` : ''} — Saturn`,
    active: `En appel${peerName ? ` avec ${peerName}` : ''} — Saturn`,
    reconnecting: 'Reconnexion de l\'appel… — Saturn',
  };
  document.title = titles[state];

  // Sonnerie/entrant : couleur d'accent du site. Actif : vert « en ligne ».
  const color =
    state === 'active'
      ? themeColor('--sat-online', '#22C55E')
      : state === 'reconnecting'
        ? '#F59E0B'
        : themeColor('--sat-accent', '#C17629');
  const icon = drawPhoneFavicon(color);
  if (icon) link.href = icon;
}

/** Restaure le titre et le favicon d'origine (fin d'appel). */
export function clearCallTab() {
  if (typeof document === 'undefined') return;
  if (originalTitle !== null) document.title = originalTitle;
  if (originalFavicon !== null) faviconLink().href = originalFavicon;
  originalTitle = null;
  originalFavicon = null;
}
