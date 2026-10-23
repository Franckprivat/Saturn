'use client';

import { useEffect, useState } from 'react';
import { disablePush, enablePush, getPushState, type PushState } from '@/lib/push';
import { toast } from '@/components/Toast';

const HINTS: Record<PushState, string> = {
  on: 'Tu reçois tes messages et invitations même quand Saturn est fermé.',
  off: 'Active-les pour être prévenu quand Saturn est fermé.',
  denied: 'Bloquées par ton navigateur : autorise-les dans les réglages du site.',
  unsupported: 'Ton navigateur ne gère pas les notifications push.',
  unconfigured: "Pas encore disponibles sur ce serveur.",
};

/** Interrupteur « notifications sur cet appareil » (Web Push). */
export function PushToggle({ className = '' }: { className?: string }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getPushState().then(setState).catch(() => setState('unsupported')); }, []);

  const toggle = async () => {
    setBusy(true);
    try {
      if (state === 'on') { await disablePush(); setState('off'); }
      else setState(await enablePush());
    } catch {
      toast('Impossible de modifier les notifications', 'error');
    } finally { setBusy(false); }
  };

  const on = state === 'on';
  const usable = state === 'on' || state === 'off';
  return (
    <div className={`flex items-center justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--sat-text)]">Notifications sur cet appareil</p>
        <p className="text-xs text-[var(--sat-muted)] mt-0.5">{state ? HINTS[state] : '…'}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Notifications sur cet appareil"
        disabled={!usable || busy}
        onClick={toggle}
        className="relative w-11 h-6 rounded-full flex-shrink-0 transition disabled:opacity-40"
        style={{ background: on ? 'var(--sat-accent)' : 'var(--sat-border-2)' }}
      >
        <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </button>
    </div>
  );
}
