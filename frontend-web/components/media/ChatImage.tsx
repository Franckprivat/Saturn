'use client';

import { useState } from 'react';
import { mediaUrl } from '@/lib/media';
import { ImageLightbox } from './ImageLightbox';

interface ChatImageProps {
  url: string;
  name?: string;
  /** Largeur max de la vignette dans la bulle. */
  maxWidth?: number;
}

/**
 * Image de conversation façon WhatsApp :
 * skeleton animé pendant le chargement, lazy loading, fondu à l'apparition,
 * état d'erreur explicite, clic → visionneuse plein écran avec zoom.
 */
export function ChatImage({ url, name = '', maxWidth = 240 }: ChatImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const src = mediaUrl(url);

  if (!src || failed) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-1.5 rounded-xl"
        style={{
          width: maxWidth, height: 140,
          background: 'var(--sat-hover)', border: '1px dashed var(--sat-border-2)',
          color: 'var(--sat-faint)',
        }}
        title={name}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /><line x1="3" y1="3" x2="21" y2="21" />
        </svg>
        <span className="text-[11px] font-medium">Image indisponible</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => loaded && setLightbox(true)}
        className="relative block overflow-hidden rounded-xl text-left"
        style={{ maxWidth, border: '1px solid var(--sat-border-2)', cursor: loaded ? 'zoom-in' : 'default' }}
        title={name || 'Agrandir'}
        aria-label={name ? `Agrandir l'image ${name}` : "Agrandir l'image"}
      >
        {/* Skeleton shimmer tant que l'image n'est pas chargée */}
        {!loaded && (
          <div
            className="animate-pulse"
            style={{ width: maxWidth, height: 160, background: 'var(--sat-hover)' }}
          />
        )}
        <img
          src={src}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className="block object-cover"
          style={{
            maxWidth, maxHeight: 280,
            opacity: loaded ? 1 : 0,
            transition: 'opacity 250ms ease',
            position: loaded ? 'static' : 'absolute',
            inset: 0,
          }}
        />
      </button>
      {lightbox && <ImageLightbox src={src} alt={name} onClose={() => setLightbox(false)} />}
    </>
  );
}
