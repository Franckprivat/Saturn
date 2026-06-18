export interface CallEntry {
  id: string;
  type: 'audio' | 'video';
  direction: 'incoming' | 'outgoing';
  status: 'answered' | 'missed';
  duration?: number;
  withName: string;
  withImage?: string;
  withNickname?: string;
  timestamp: string;
}

export function loadCallLog(): CallEntry[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem('saturn_call_log') || '[]'); } catch { return []; }
}

export function saveCallEntry(entry: Omit<CallEntry, 'id'>): CallEntry {
  const full: CallEntry = { ...entry, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` };
  const log = loadCallLog();
  log.unshift(full);
  localStorage.setItem('saturn_call_log', JSON.stringify(log.slice(0, 100)));
  return full;
}
