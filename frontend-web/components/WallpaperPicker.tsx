'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { WALLPAPER_PRESETS } from '@/lib/wallpapers';

interface WallpaperPickerProps {
  /** Valeur actuelle (`preset:<id>`, `url:<...>` ou null). */
  value: string | null;
  /** Appelé après persistance réussie. */
  onChange: (value: string | null) => void;
}

/**
 * Bouton + panneau de choix du fond d'écran de discussion (façon WhatsApp).
 * Le choix est persisté dans le profil (PATCH /users/me) : chaque utilisateur
 * retrouve son fond sur tous ses appareils.
 */
export function WallpaperPicker({ value, onChange }: WallpaperPickerProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const persist = async (next: string | null) => {
    setSaving(true);
    setUploadError('');
    try {
      await api.patch('/users/me', { chatWallpaper: next });
      onChange(next);
    } catch {
      setUploadError('Impossible d\'enregistrer le fond.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setUploadError('Choisis une image.'); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError('Image trop lourde (10 Mo max).'); return; }
    setSaving(true);
    setUploadError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/upload', fd);
      await persist(`url:${res.data.url}`);
    } catch {
      setUploadError('Erreur lors de l\'upload.');
      setSaving(false);
    }
  };

  const isCustom = !!value?.startsWith('url:');

  return (
    <div ref={panelRef} className="relative">
      <button onClick={() => setOpen((v) => !v)} title="Fond d'écran de la discussion"
        className="w-8 h-8 rounded flex items-center justify-center transition"
        style={{ color: open ? 'var(--sat-accent)' : 'var(--sat-muted)' }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.color = 'var(--sat-text)'; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.color = 'var(--sat-muted)'; }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-72 rounded-2xl p-4 shadow-2xl"
          style={{ background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
          <p className="text-[11px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--sat-muted)' }}>
            Fond d'écran
          </p>

          <div className="grid grid-cols-3 gap-2">
            {/* Par défaut (thème) */}
            <button onClick={() => persist(null)} disabled={saving}
              className="h-14 rounded-xl flex items-center justify-center text-[10px] font-semibold transition"
              style={{
                background: 'var(--sat-main)',
                border: !value ? '2px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
                color: 'var(--sat-muted)',
              }}>
              Défaut
            </button>

            {WALLPAPER_PRESETS.map((p) => {
              const active = value === `preset:${p.id}`;
              return (
                <button key={p.id} onClick={() => persist(`preset:${p.id}`)} disabled={saving} title={p.label}
                  className="h-14 rounded-xl transition hover:scale-[1.03]"
                  style={{
                    background: p.css,
                    backgroundColor: 'var(--sat-main)',
                    border: active ? '2px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
                  }} />
              );
            })}
          </div>

          {/* Image personnalisée */}
          <div className="mt-3 space-y-2">
            <button onClick={() => fileRef.current?.click()} disabled={saving}
              className="w-full py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
              style={{
                background: isCustom ? 'rgba(160,22,217,0.12)' : 'var(--sat-hover)',
                border: isCustom ? '1.5px solid var(--sat-accent)' : '1px solid var(--sat-border-2)',
                color: isCustom ? 'var(--sat-accent)' : 'var(--sat-text)',
              }}>
              {saving ? 'Enregistrement…' : isCustom ? '✓ Image personnalisée — en changer' : 'Importer une image'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            {uploadError && <p className="text-[11px]" style={{ color: '#EF4444' }}>{uploadError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
