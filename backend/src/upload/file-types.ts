/**
 * Types de fichiers acceptés à l'upload, avec l'extension imposée côté serveur.
 * L'extension du nom d'origine n'est jamais réutilisée : un `piege.html`
 * envoyé avec un faux type `image/png` devient `<uuid>.png` et sera rejeté
 * par la vérification de signature ci-dessous.
 */
export const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'audio/mp4': '.m4a',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
};

/** Normalise un type MIME (`audio/webm;codecs=opus` → `audio/webm`). */
export function baseMime(mime: string): string {
  return (mime || '').split(';')[0].trim().toLowerCase();
}

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function ascii(buf: Buffer, text: string, offset = 0): boolean {
  return startsWith(
    buf,
    [...text].map((c) => c.charCodeAt(0)),
    offset,
  );
}

/**
 * Vérifie que les premiers octets du fichier correspondent au type annoncé
 * (le type MIME envoyé par le navigateur est contrôlé par le client).
 */
export function matchesSignature(mime: string, head: Buffer): boolean {
  switch (baseMime(mime)) {
    case 'image/jpeg':
      return startsWith(head, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/gif':
      return ascii(head, 'GIF87a') || ascii(head, 'GIF89a');
    case 'image/webp':
      return ascii(head, 'RIFF') && ascii(head, 'WEBP', 8);
    case 'video/webm':
    case 'audio/webm':
      return startsWith(head, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'video/mp4':
    case 'audio/mp4':
      return ascii(head, 'ftyp', 4);
    case 'audio/ogg':
      return ascii(head, 'OggS');
    case 'audio/mpeg':
      return (
        ascii(head, 'ID3') ||
        (head.length > 1 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0)
      );
    case 'application/pdf':
      return ascii(head, '%PDF-');
    case 'text/plain': {
      // Texte brut : pas d'octet nul, et pas de balisage HTML en tête
      if (head.includes(0)) return false;
      const start = head
        .toString('utf8')
        .trimStart()
        .slice(0, 64)
        .toLowerCase();
      return !start.startsWith('<');
    }
    default:
      return false;
  }
}

/** Les médias s'affichent dans le chat ; le reste est forcé en téléchargement. */
export function isInlineMedia(ext: string): boolean {
  return /^\.(jpg|png|gif|webp|mp4|webm|ogg|mp3|m4a)$/i.test(ext);
}
