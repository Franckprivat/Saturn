import { api } from './api';

export interface CallEntry {
  id: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed';
  duration?: number;
  withName: string;
  withImage?: string;
  withNickname?: string;
  conversationId?: string;
  timestamp: string;
}

function normalize(entry: any): CallEntry {
  return { ...entry, timestamp: entry.createdAt ?? entry.timestamp };
}

function localLoad(): CallEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('saturn_call_log') || '[]'); } catch { return []; }
}

export async function loadCallLog(): Promise<CallEntry[]> {
  try {
    const res = await api.get('/calls');
    return (res.data as any[]).map(normalize);
  } catch {
    return localLoad();
  }
}

export async function saveCallEntry(entry: Omit<CallEntry, 'id'>): Promise<CallEntry> {
  // Badge « Appels » : un appel entrant manqué de plus (sauf si on regarde déjà le journal)
  if (entry.status === 'missed' && entry.direction === 'incoming'
    && typeof window !== 'undefined' && !window.location.pathname.startsWith('/calls')) {
    const { useBadgeStore } = await import('@/store/badgeStore');
    useBadgeStore.getState().incrementMissedCalls();
  }
  try {
    const res = await api.post('/calls', entry);
    return normalize(res.data);
  } catch {
    const full: CallEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
    const log = localLoad();
    log.unshift(full);
    if (typeof window !== 'undefined') localStorage.setItem('saturn_call_log', JSON.stringify(log.slice(0, 100)));
    return full;
  }
}
