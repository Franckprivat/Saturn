'use client';

import { api } from '@/lib/api';

// Notifications push : le navigateur les reçoit même quand Saturn est fermé.

export type PushState = 'unsupported' | 'unconfigured' | 'denied' | 'off' | 'on';

let publicKeyPromise: Promise<string | null> | null = null;
function getPublicKey() {
  publicKeyPromise ??= api
    .get<{ publicKey: string | null }>('/push/public-key')
    .then((r) => r.data.publicKey)
    .catch(() => { publicKeyPromise = null; return null; });
  return publicKeyPromise;
}

export function isPushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

export async function getPushState(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  if (!(await getPublicKey())) return 'unconfigured';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

/** Abonne ce navigateur (demande la permission si besoin). */
export async function enablePush(): Promise<PushState> {
  if (!isPushSupported()) return 'unsupported';
  const key = await getPublicKey();
  if (!key) return 'unconfigured';
  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription())
    ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
  await api.post('/push/subscribe', sub.toJSON());
  return 'on';
}

/** Désabonne ce navigateur (à faire aussi à la déconnexion). */
export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await api.delete('/push/subscribe', { data: { endpoint: sub.endpoint } }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

/**
 * Au chargement : si la permission est déjà accordée, (ré)enregistre
 * l'abonnement de ce navigateur pour le compte connecté.
 */
export async function syncPush(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== 'granted') return;
  await enablePush().catch(() => {});
}
