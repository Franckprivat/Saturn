'use client';

import { useEffect, useRef, useState } from 'react';

// Motif de barres déterministe (stable pour une même URL) — évite de décoder l'audio.
function bars(seed: string, count = 34): number[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(0.3 + (h % 1000) / 1000 * 0.7); // 0.3 → 1.0
  }
  return out;
}

const SPEEDS = [1, 1.5, 2];

export function VoiceMessage({ url, mine }: { url: string; mine?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ready, setReady] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(0);
  const waveform = useRef(bars(url)).current;

  useEffect(() => {
    const a = new Audio();
    a.preload = 'metadata';
    a.src = url;
    audioRef.current = a;
    let fixing = false;

    const setReal = (d: number) => { if (isFinite(d) && d > 0) { setDuration(d); setReady(true); } };

    const onMeta = () => {
      // Bug connu : les webm de MediaRecorder ont duration = Infinity → on force le calcul.
      if (isFinite(a.duration) && a.duration > 0) { setReal(a.duration); return; }
      if (fixing) return;
      fixing = true;
      const onUpdate = () => {
        if (isFinite(a.duration) && a.duration > 0) {
          setReal(a.duration);
          a.removeEventListener('timeupdate', onUpdate);
          a.currentTime = 0;
          fixing = false;
        }
      };
      a.addEventListener('timeupdate', onUpdate);
      a.currentTime = 1e7; // seek « à la fin » → le navigateur recalcule la vraie durée
    };
    const onTime = () => setCurrent(a.currentTime);
    const onEnd = () => { setPlaying(false); setCurrent(0); a.currentTime = 0; };

    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('durationchange', onMeta);
    a.addEventListener('timeupdate', onTime);
    a.addEventListener('ended', onEnd);
    a.addEventListener('canplay', () => setReady(true));

    return () => {
      a.pause();
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('durationchange', onMeta);
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('ended', onEnd);
      audioRef.current = null;
    };
  }, [url]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else {
      a.playbackRate = SPEEDS[speedIdx];
      a.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const cycleSpeed = () => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * duration;
    setCurrent(a.currentTime);
  };

  const progress = duration ? current / duration : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const timeLabel = playing || current > 0 ? fmt(current) : ready ? fmt(duration) : '· · ·';

  const fg = mine ? '#fff' : 'var(--sat-accent)';
  const dim = mine ? 'rgba(255,255,255,0.45)' : 'var(--sat-faint)';

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 shadow-sm"
      style={{
        background: mine ? 'linear-gradient(135deg, var(--sat-accent), var(--sat-accent2))' : 'var(--sat-surface)',
        borderRadius: 18, width: 250,
        border: mine ? 'none' : '1px solid var(--sat-border-2)',
      }}>
      {/* Play / Pause */}
      <button onClick={toggle} aria-label={playing ? 'Pause' : 'Lire'}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition active:scale-95"
        style={{ background: mine ? 'rgba(255,255,255,0.22)' : 'var(--sat-accent)', color: '#fff' }}>
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
        )}
      </button>

      {/* Waveform + temps */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-[2px] h-7 cursor-pointer" onClick={seek}>
          {waveform.map((h, i) => {
            const filled = i / waveform.length <= progress;
            return (
              <span key={i} className="flex-1 rounded-full transition-colors duration-100"
                style={{ height: `${h * 100}%`, minWidth: 2, background: filled ? fg : dim, opacity: filled ? 1 : 0.5 }} />
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] tabular-nums flex items-center gap-1" style={{ color: mine ? 'rgba(255,255,255,0.8)' : 'var(--sat-muted)' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" /></svg>
            {timeLabel}
          </span>
          <span className="flex items-center gap-1">
            <button onClick={cycleSpeed} aria-label="Vitesse de lecture"
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full transition"
              style={{ background: mine ? 'rgba(255,255,255,0.22)' : 'var(--sat-hover)', color: mine ? '#fff' : 'var(--sat-muted)' }}>
              {SPEEDS[speedIdx]}×
            </button>
            <a href={url} download title="Télécharger le vocal" aria-label="Télécharger le vocal"
              className="w-5 h-5 rounded-full flex items-center justify-center transition hover:opacity-80"
              style={{ background: mine ? 'rgba(255,255,255,0.22)' : 'var(--sat-hover)', color: mine ? '#fff' : 'var(--sat-muted)' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
          </span>
        </div>
      </div>
    </div>
  );
}
