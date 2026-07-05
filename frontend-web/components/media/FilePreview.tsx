'use client';

import { VoiceMessage } from '@/components/VoiceMessage';
import { mediaUrl } from '@/lib/media';
import { ChatImage } from './ChatImage';

interface FilePreviewProps {
  url: string;
  name?: string | null;
  type?: string | null;
  /** Mes messages (style du lecteur vocal). */
  mine?: boolean;
  maxWidth?: number;
}

/**
 * Rendu d'une pièce jointe de message — composant unique pour les DM,
 * groupes et salons de communauté (remplace les deux copies locales).
 */
export function FilePreview({ url, name, type, mine, maxWidth = 240 }: FilePreviewProps) {
  const safeName = name || 'fichier';
  const safeType = type || '';
  const resolved = mediaUrl(url) || '';

  if (safeType.startsWith('image/')) {
    return <ChatImage url={url} name={safeName} maxWidth={maxWidth} />;
  }
  if (safeType.startsWith('audio/')) {
    return <VoiceMessage url={resolved} mine={mine} />;
  }
  if (safeType.startsWith('video/')) {
    return (
      <video
        src={resolved}
        controls
        preload="metadata"
        className="rounded-xl"
        style={{ maxWidth: Math.max(maxWidth, 280), maxHeight: 320, border: '1px solid var(--sat-border-2)' }}
      />
    );
  }

  const icon = safeType.includes('pdf') ? '📄' : '📎';
  return (
    <a
      href={resolved}
      download={safeName}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-xl transition hover:opacity-80"
      style={{ maxWidth, background: 'var(--sat-hover)', border: '1px solid var(--sat-border-2)' }}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-xs truncate" style={{ color: 'var(--sat-text)' }}>{safeName}</span>
      <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--sat-muted)' }}>↓</span>
    </a>
  );
}
