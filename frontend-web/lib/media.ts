/**
 * Gestion centralisée des médias (images, fichiers, vocaux).
 *
 * Le backend stocke des URLs RELATIVES (`/uploads/xxx`) : c'est ce module qui
 * les résout vers l'origine API courante. Les anciennes URLs absolues
 * (`http://localhost:3001/uploads/xxx`) enregistrées avant cette refonte sont
 * réécrites à la volée — aucune migration de données nécessaire.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Origine servant les /uploads : l'origine de l'API, sans son éventuel path (/api). */
function apiOrigin(): string {
  try {
    return new URL(API_URL).origin;
  } catch {
    return 'http://localhost:3001';
  }
}

const LEGACY_HOSTS = new Set(['localhost', '127.0.0.1']);

/**
 * Résout une URL de média vers une URL affichable dans l'environnement courant.
 * - `/uploads/xxx` (relatif)                → `<origine API>/uploads/xxx`
 * - `http://localhost:3001/uploads/xxx`     → réécrite vers l'origine API courante (legacy)
 * - URL absolue externe (DiceBear, R2, …)   → inchangée
 */
export function mediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('/uploads/')) return `${apiOrigin()}${url}`;
  try {
    const parsed = new URL(url);
    if (LEGACY_HOSTS.has(parsed.hostname) && parsed.pathname.startsWith('/uploads/')) {
      return `${apiOrigin()}${parsed.pathname}`;
    }
  } catch { /* URL invalide → renvoyée telle quelle */ }
  return url;
}

// ── Compression d'image avant upload (façon WhatsApp) ────────────────────────

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
/** En-dessous de ce poids, la compression n'apporte rien. */
const SKIP_UNDER_BYTES = 150 * 1024;

export interface CompressedImage {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

/**
 * Compresse une image côté client : redimensionne à 1600px max et ré-encode en
 * JPEG. Les GIF (animation) et les petites images sont laissés intacts.
 * En cas d'échec (format exotique), renvoie le fichier original.
 */
export async function compressImage(file: File): Promise<CompressedImage> {
  const passthrough: CompressedImage = {
    file, originalSize: file.size, compressedSize: file.size, wasCompressed: false,
  };
  if (!file.type.startsWith('image/')) return passthrough;
  if (file.type === 'image/gif' || file.size < SKIP_UNDER_BYTES) return passthrough;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return passthrough;
    // Fond blanc pour les PNG transparents ré-encodés en JPEG
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob || blob.size >= file.size) return passthrough;

    const name = file.name.replace(/\.\w+$/, '') + '.jpg';
    return {
      file: new File([blob], name, { type: 'image/jpeg' }),
      originalSize: file.size,
      compressedSize: blob.size,
      wasCompressed: true,
    };
  } catch {
    return passthrough;
  }
}

/** Formate un poids de fichier lisible (« 2,4 Mo »). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} Mo`;
}
