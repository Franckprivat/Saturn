'use client';

import { useEffect, useState } from 'react';
import { PhoneIcon, VideoIcon } from '@/components/Icons';
import { Avatar } from '@/components/Avatar';
import { type CallEntry, loadCallLog } from '@/lib/callLog';

export type { CallEntry };

function formatDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}min ${s % 60}s`;
}

function formatRelative(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'Hier';
  if (diffD < 7) return date.toLocaleDateString('fr-FR', { weekday: 'long' });
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
}

export default function CallsPage() {
  const [calls, setCalls] = useState<CallEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  useEffect(() => { setCalls(loadCallLog()); }, []);

  const displayed = filter === 'missed' ? calls.filter((c) => c.status === 'missed') : calls;

  const clearLog = () => {
    localStorage.removeItem('saturn_call_log');
    setCalls([]);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--sat-main)' }}>
      {/* Header */}
      <div className="h-14 px-5 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)', background: 'var(--sat-main)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(37,99,235,0.1)' }}>
            <PhoneIcon size={16} style={{ color: 'var(--sat-accent)' }} />
          </div>
          <div>
            <h1 className="text-[15px] font-bold" style={{ color: 'var(--sat-text)' }}>Journal d'appels</h1>
            <p className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>{calls.length} appel{calls.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {calls.length > 0 && (
          <button onClick={clearLog} className="px-3 py-1.5 rounded-lg text-xs transition"
            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.15)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}>
            Effacer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="px-5 py-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--sat-border)' }}>
        {(['all', 'missed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition"
            style={{ background: filter === f ? 'var(--sat-accent)' : 'var(--sat-hover)', color: filter === f ? '#fff' : 'var(--sat-muted)' }}>
            {f === 'all' ? 'Tous' : 'Manqués'}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 pb-20">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center" style={{ background: 'var(--sat-surface)' }}>
              <PhoneIcon size={34} style={{ color: 'var(--sat-faint)' }} />
            </div>
            <div className="text-center">
              <p className="font-bold text-base" style={{ color: 'var(--sat-text)' }}>
                {filter === 'missed' ? 'Aucun appel manqué' : 'Aucun appel'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--sat-muted)' }}>
                {filter === 'missed' ? 'Tous vos appels ont été répondus.' : 'Lance un appel depuis une conversation.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--sat-border)' }}>
            {displayed.map((call) => {
              const isMissed = call.status === 'missed';
              const isOutgoing = call.direction === 'outgoing';
              return (
                <div key={call.id} className="flex items-center gap-3.5 px-5 py-3.5 transition"
                  style={{ background: 'var(--sat-main)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--sat-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--sat-main)')}>
                  <div className="relative flex-shrink-0">
                    <Avatar user={{ nickname: call.withNickname, email: call.withName, image: call.withImage }} size="md" />
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--sat-sidebar)', border: '2px solid var(--sat-sidebar)' }}>
                      {call.type === 'video'
                        ? <VideoIcon size={11} style={{ color: isMissed ? '#EF4444' : 'var(--sat-accent)' }} />
                        : <PhoneIcon size={11} style={{ color: isMissed ? '#EF4444' : 'var(--sat-accent)' }} />}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: isMissed ? '#EF4444' : 'var(--sat-text)' }}>
                      {call.withNickname || call.withName}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                        strokeLinecap="round" style={{ color: isMissed ? '#EF4444' : isOutgoing ? 'var(--sat-accent)' : '#10B981', flexShrink: 0 }}>
                        {isOutgoing
                          ? <><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></>
                          : <><line x1="17" y1="7" x2="7" y2="17" /><polyline points="17 17 7 17 7 7" /></>}
                      </svg>
                      <span className="text-[11px]" style={{ color: 'var(--sat-muted)' }}>
                        {isMissed ? 'Manqué' : isOutgoing ? 'Sortant' : 'Entrant'}
                        {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] flex-shrink-0" style={{ color: 'var(--sat-faint)' }}>{formatRelative(call.timestamp)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
