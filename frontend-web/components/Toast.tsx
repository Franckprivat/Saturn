'use client';

import { useEffect, useRef } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

let _toastFn: ((msg: string, type?: ToastType) => void) | null = null;

export function toast(message: string, type: ToastType = 'info') {
  _toastFn?.(message, type);
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastBubble({ toast: t, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(t.id), 3500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [t.id, onRemove]);

  const bg = t.type === 'success' ? '#10B981' : t.type === 'error' ? '#EF4444' : '#2563EB';
  const icon = t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ';

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow-lg pointer-events-auto"
      style={{ background: bg, minWidth: 200, maxWidth: 340, animation: 'slideInRight 0.2s ease' }}
    >
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-white bg-opacity-20 flex items-center justify-center text-xs font-black">{icon}</span>
      <span className="flex-1">{t.message}</span>
      <button onClick={() => onRemove(t.id)} className="flex-shrink-0 opacity-70 hover:opacity-100 transition text-xs">✕</button>
    </div>
  );
}

export function useToast() {
  return { toast };
}

export function ToastProvider({ children, setToasts }: { children: React.ReactNode; setToasts: (fn: (prev: ToastItem[]) => ToastItem[]) => void }) {
  useEffect(() => {
    _toastFn = (message: string, type: ToastType = 'info') => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, message, type }]);
    };
    return () => { _toastFn = null; };
  }, [setToasts]);
  return <>{children}</>;
}
