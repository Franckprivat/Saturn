'use client';

import { useCallback, useEffect, useState } from 'react';

interface ImageLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

/**
 * Visionneuse plein écran façon WhatsApp : zoom (clic / molette),
 * téléchargement, fermeture par Échap ou clic sur le fond.
 */
export function ImageLightbox({ src, alt = '', onClose }: ImageLightboxProps) {
  const [zoomed, setZoomed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Entrée animée + verrouillage du scroll de la page
    requestAnimationFrame(() => setVisible(true));
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, 180);
  }, [onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={alt || 'Image en plein écran'}
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(6px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 180ms ease',
      }}
      onClick={close}
    >
      {/* Barre d'actions */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        <a
          href={src}
          download
          target="_blank"
          rel="noreferrer"
          title="Télécharger"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.14)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </a>
        <button
          onClick={close}
          title="Fermer (Échap)"
          className="w-10 h-10 rounded-full flex items-center justify-center text-white transition hover:scale-105"
          style={{ background: 'rgba(255,255,255,0.14)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        onClick={(e) => { e.stopPropagation(); setZoomed((z) => !z); }}
        className="select-none"
        style={{
          maxWidth: zoomed ? 'none' : '90vw',
          maxHeight: zoomed ? 'none' : '88vh',
          width: zoomed ? 'auto' : undefined,
          transform: `scale(${visible ? 1 : 0.92})`,
          transition: 'transform 180ms ease',
          cursor: zoomed ? 'zoom-out' : 'zoom-in',
          borderRadius: zoomed ? 0 : 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
        }}
        draggable={false}
      />
    </div>
  );
}
