'use client';

import { useEffect } from 'react';

interface DeleteMessageDialogProps {
  /** Proposer « supprimer pour tous » (mes messages, ou modération). */
  canDeleteForAll: boolean;
  onDeleteForMe: () => void;
  onDeleteForAll: () => void;
  onClose: () => void;
}

/**
 * Choix de suppression façon WhatsApp :
 * — « Pour moi » masque le message sur cet appareil uniquement.
 * — « Pour tout le monde » le retire chez tous (fenêtre de 24 h côté serveur).
 */
export function DeleteMessageDialog({ canDeleteForAll, onDeleteForMe, onDeleteForAll, onClose }: DeleteMessageDialogProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Supprimer le message"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-2xl p-5 shadow-2xl"
        style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-bold mb-1" style={{ color: 'var(--sat-text)' }}>
          Supprimer ce message ?
        </p>
        <p className="text-xs mb-4" style={{ color: 'var(--sat-muted)' }}>
          {canDeleteForAll
            ? 'La suppression pour tout le monde est possible pendant 24 h.'
            : 'Le message sera masqué uniquement sur cet appareil.'}
        </p>
        <div className="flex flex-col gap-2">
          {canDeleteForAll && (
            <button onClick={() => { onDeleteForAll(); onClose(); }}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
              style={{ background: '#EF4444' }}>
              Supprimer pour tout le monde
            </button>
          )}
          <button onClick={() => { onDeleteForMe(); onClose(); }}
            className="w-full py-2.5 rounded-xl text-xs font-bold transition hover:opacity-90"
            style={{ background: 'var(--sat-hover)', color: 'var(--sat-text)', border: '1px solid var(--sat-border-2)' }}>
            Supprimer pour moi
          </button>
          <button onClick={onClose}
            className="w-full py-2.5 rounded-xl text-xs font-semibold transition hover:opacity-80"
            style={{ background: 'transparent', color: 'var(--sat-muted)' }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
