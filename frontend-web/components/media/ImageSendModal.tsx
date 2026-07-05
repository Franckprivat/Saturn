'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { compressImage, formatBytes, type CompressedImage } from '@/lib/media';
import { SendIcon } from '@/components/Icons';

export interface UploadedFileInfo {
  url: string;
  name: string;
  type: string;
  size: number;
}

interface ImageSendModalProps {
  file: File;
  /** Appelé après upload réussi, avec la légende saisie (façon WhatsApp). */
  onSend: (uploaded: UploadedFileInfo, caption: string) => void;
  onClose: () => void;
}

type Status = 'preparing' | 'ready' | 'uploading' | 'error';

/**
 * Prévisualisation avant envoi d'une image (façon WhatsApp) :
 * compression automatique, légende optionnelle, barre de progression
 * pendant l'upload et bouton « Réessayer » en cas d'échec réseau.
 */
export function ImageSendModal({ file, onSend, onClose }: ImageSendModalProps) {
  const [status, setStatus] = useState<Status>('preparing');
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Compression + aperçu local
  useEffect(() => {
    let cancelled = false;
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    compressImage(file).then((result) => {
      if (cancelled) return;
      setCompressed(result);
      setStatus('ready');
      setTimeout(() => inputRef.current?.focus(), 50);
    });
    return () => { cancelled = true; URL.revokeObjectURL(objectUrl); };
  }, [file]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const upload = useCallback(async () => {
    if (!compressed) return;
    setStatus('uploading');
    setProgress(0);
    try {
      const fd = new FormData();
      fd.append('file', compressed.file);
      const res = await api.post('/upload', fd, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      onSend(res.data, caption.trim());
      onClose();
    } catch {
      setStatus('error');
    }
  }, [compressed, caption, onSend, onClose]);

  const busy = status === 'preparing' || status === 'uploading';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Envoyer une image"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
      onClick={busy ? undefined : onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--sat-border)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--sat-text)' }}>Envoyer une image</span>
          <button onClick={onClose} disabled={status === 'uploading'}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition disabled:opacity-40"
            style={{ color: 'var(--sat-muted)' }}>✕</button>
        </div>

        {/* Aperçu */}
        <div className="flex items-center justify-center p-4" style={{ background: 'var(--sat-void)', minHeight: 220 }}>
          {previewUrl && (
            <img src={previewUrl} alt="Aperçu" className="rounded-xl object-contain"
              style={{ maxHeight: 320, maxWidth: '100%' }} />
          )}
        </div>

        {/* Infos compression */}
        <div className="px-4 pt-2.5 flex items-center justify-between text-[11px]" style={{ color: 'var(--sat-faint)' }}>
          {status === 'preparing' ? (
            <span>Optimisation de l'image…</span>
          ) : compressed?.wasCompressed ? (
            <span>
              ✓ Compressée : {formatBytes(compressed.originalSize)} → <strong style={{ color: 'var(--sat-online)' }}>{formatBytes(compressed.compressedSize)}</strong>
            </span>
          ) : (
            <span>{formatBytes(file.size)}</span>
          )}
          <span className="truncate max-w-[45%]" title={file.name}>{file.name}</span>
        </div>

        {/* Barre de progression */}
        {status === 'uploading' && (
          <div className="px-4 pt-2">
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--sat-hover)' }}>
              <div className="h-full rounded-full transition-all duration-150"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,var(--sat-accent),var(--sat-accent2))' }} />
            </div>
            <p className="text-[10px] mt-1 text-right" style={{ color: 'var(--sat-muted)' }}>{progress}%</p>
          </div>
        )}

        {/* Erreur + retry */}
        {status === 'error' && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-xl flex items-center justify-between gap-2 text-xs"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }}>
            <span>⚠ Échec de l'envoi — vérifie ta connexion.</span>
            <button onClick={upload} className="font-bold underline flex-shrink-0">Réessayer</button>
          </div>
        )}

        {/* Légende + envoi */}
        <div className="p-3 flex items-center gap-2">
          <input
            ref={inputRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && status === 'ready') upload(); }}
            placeholder="Ajouter une légende…"
            disabled={busy}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm focus:outline-none disabled:opacity-60"
            style={{ background: 'var(--sat-hover)', border: '1px solid var(--sat-border-2)', color: 'var(--sat-text)' }}
          />
          <button
            onClick={upload}
            disabled={status !== 'ready' && status !== 'error'}
            title="Envoyer"
            className="w-11 h-11 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}
          >
            <SendIcon size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
