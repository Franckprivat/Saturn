'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '@/components/Icons';
import { saveCallEntry } from '@/lib/callLog';
import { mediaUrl } from '@/lib/media';
import { setCallTab, clearCallTab } from '@/lib/callTab';

interface CallModalProps {
  socket: any;
  conversationId: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
  callerName?: string;
  callerImage?: string;
  incomingOffer?: RTCSessionDescriptionInit;
  onClose: () => void;
}

const RING_TIMEOUT = 35000;
const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

type Status = 'ringing' | 'connecting' | 'active' | 'reconnecting' | 'ended';
type Quality = 'good' | 'medium' | 'poor';

/** Qualité de connexion depuis les stats WebRTC (RTT du candidat actif). */
async function measureQuality(pc: RTCPeerConnection): Promise<Quality | null> {
  try {
    const stats = await pc.getStats();
    let rtt: number | undefined;
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && (report as any).nominated && (report as any).currentRoundTripTime !== undefined) {
        rtt = (report as any).currentRoundTripTime;
      }
    });
    if (rtt === undefined) return null;
    if (rtt < 0.15) return 'good';
    if (rtt < 0.4) return 'medium';
    return 'poor';
  } catch {
    return null;
  }
}

function QualityBars({ quality }: { quality: Quality | null }) {
  if (!quality) return null;
  const levels = { poor: 1, medium: 2, good: 3 } as const;
  const colors = { poor: '#EF4444', medium: '#F59E0B', good: '#10B981' } as const;
  const active = levels[quality];
  const label = quality === 'good' ? 'Bonne connexion' : quality === 'medium' ? 'Connexion moyenne' : 'Connexion faible';
  return (
    <div className="flex items-end gap-[2px]" title={label} aria-label={label}>
      {[1, 2, 3].map((lvl) => (
        <span key={lvl} className="rounded-sm"
          style={{
            width: 3, height: 4 + lvl * 3,
            background: lvl <= active ? colors[quality] : 'rgba(255,255,255,0.25)',
          }} />
      ))}
    </div>
  );
}

export function CallModal({ socket, conversationId, callType, isIncoming, callerName, callerImage, incomingOffer, onClose }: CallModalProps) {
  const [status, setStatus] = useState<Status>('ringing');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [quality, setQuality] = useState<Quality | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ICE candidates reçus avant que la remoteDescription soit posée → mis en tampon
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const closedRef = useRef(false);
  const loggedRef = useRef(false);
  // Vrai pendant un ICE restart : onnegotiationneeded doit émettre une nouvelle offre
  const renegotiatingRef = useRef(false);

  const formatDuration = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const clearTimers = useCallback(() => {
    if (durationRef.current) { clearInterval(durationRef.current); durationRef.current = null; }
    if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
    if (qualityTimerRef.current) { clearInterval(qualityTimerRef.current); qualityTimerRef.current = null; }
    if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
  }, []);

  const logCall = useCallback((st: 'answered' | 'missed', secs?: number) => {
    if (loggedRef.current) return;
    loggedRef.current = true;
    saveCallEntry({
      type: callType,
      direction: isIncoming ? 'incoming' : 'outgoing',
      status: st,
      duration: secs,
      withName: callerName || 'Inconnu',
      withNickname: callerName,
      withImage: callerImage,
      conversationId,
      timestamp: new Date().toISOString(),
    }).catch(() => {});
  }, [callType, isIncoming, callerName, callerImage, conversationId]);

  const teardown = useCallback(() => {
    clearTimers();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    try { pcRef.current?.close(); } catch { /* noop */ }
    pcRef.current = null;
  }, [clearTimers]);

  // Ferme proprement (et notifie le pair une seule fois)
  const finish = useCallback((notify: boolean) => {
    if (closedRef.current) return;
    closedRef.current = true;
    if (notify) socket?.emit('call_end', { conversationId });
    teardown();
    setStatus('ended');
    setTimeout(onClose, 1200);
  }, [socket, conversationId, onClose, teardown]);

  const flushCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pc.remoteDescription) return;
    const pending = pendingCandidatesRef.current;
    pendingCandidatesRef.current = [];
    for (const c of pending) {
      try { await pc.addIceCandidate(c); } catch { /* ignore */ }
    }
  }, []);

  const attachRemote = (stream: MediaStream) => {
    if (remoteRef.current) {
      remoteRef.current.srcObject = stream;
      remoteRef.current.play?.().catch(() => {});
    }
  };

  const buildPeer = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call_ice_candidate', { conversationId, candidate: e.candidate.toJSON() });
    };
    pc.ontrack = (e) => { if (e.streams[0]) attachRemote(e.streams[0]); };

    // Renégociation après ICE restart : seul l'appelant initie (évite le glare)
    pc.onnegotiationneeded = async () => {
      if (!renegotiatingRef.current) return;
      renegotiatingRef.current = false;
      try {
        const offer = await pc.createOffer({ iceRestart: true });
        await pc.setLocalDescription(offer);
        socket.emit('call_renegotiate', { conversationId, offer });
      } catch { /* la connexion finira par échouer → finish */ }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        setStatus('active');
        logCall('answered');
        if (!durationRef.current) durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
        if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; }
        if (reconnectTimerRef.current) { clearTimeout(reconnectTimerRef.current); reconnectTimerRef.current = null; }
        // Mesure de qualité toutes les 3 s
        if (!qualityTimerRef.current) {
          qualityTimerRef.current = setInterval(async () => {
            const q = await measureQuality(pc);
            if (q) setQuality(q);
          }, 3000);
        }
      } else if (st === 'disconnected' || st === 'failed') {
        // Coupure réseau : on tente de récupérer avant d'abandonner
        setStatus((s) => (s === 'active' ? 'reconnecting' : s));
        setQuality('poor');
        if (!isIncoming) {
          renegotiatingRef.current = true;
          try { pc.restartIce(); } catch { /* ignoré */ }
        }
        if (!reconnectTimerRef.current) {
          reconnectTimerRef.current = setTimeout(() => {
            if (pc.connectionState !== 'connected') finish(true);
          }, 15000);
        }
      } else if (st === 'closed') {
        finish(false);
      }
    };
    return pc;
  }, [socket, conversationId, logCall, finish, isIncoming]);

  const getLocalStream = useCallback(async () => {
    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (callType === 'video' && localRef.current) localRef.current.srcObject = stream;
    return stream;
  }, [callType]);

  // ── Accepter (destinataire) ──
  const handleAccept = useCallback(async () => {
    if (!incomingOffer) return;
    setStatus('connecting');
    try {
      const stream = await getLocalStream();
      const pc = buildPeer(stream);
      await pc.setRemoteDescription(incomingOffer);
      await flushCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call_answer', { conversationId, answer });
    } catch {
      finish(true);
    }
  }, [incomingOffer, getLocalStream, buildPeer, flushCandidates, socket, conversationId, finish]);

  // ── Refuser (destinataire) ──
  const handleReject = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    socket?.emit('call_reject', { conversationId });
    logCall('missed');
    teardown();
    onClose();
  }, [socket, conversationId, logCall, teardown, onClose]);

  const handleEnd = useCallback(() => finish(true), [finish]);

  // ── Démarrage appel sortant ──
  useEffect(() => {
    if (isIncoming) return;
    let cancelled = false;
    (async () => {
      try {
        const stream = await getLocalStream();
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        const pc = buildPeer(stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_offer', { conversationId, offer, callType });
      } catch {
        finish(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Timeout de sonnerie (entrant non décroché OU sortant sans réponse) ──
  useEffect(() => {
    if (status !== 'ringing' && status !== 'connecting') return;
    ringTimeoutRef.current = setTimeout(() => {
      if (closedRef.current) return;
      logCall('missed');
      if (!isIncoming) socket?.emit('call_end', { conversationId });
      teardown();
      setStatus('ended');
      setTimeout(onClose, 1200);
      closedRef.current = true;
    }, RING_TIMEOUT);
    return () => { if (ringTimeoutRef.current) { clearTimeout(ringTimeoutRef.current); ringTimeoutRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // ── Évènements socket ──
  useEffect(() => {
    if (!socket) return;
    const onAnswered = async ({ answer }: any) => {
      try {
        await pcRef.current?.setRemoteDescription(answer);
        await flushCandidates();
        setStatus((s) => (s === 'ringing' ? 'connecting' : s));
      } catch { /* ignore */ }
    };
    const onIce = async ({ candidate }: any) => {
      if (!candidate) return;
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(candidate); } catch { /* ignore */ }
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    };
    // Renégociation reçue (l'appelant a fait un ICE restart) → on répond
    const onRenegotiate = async ({ offer }: any) => {
      const pc = pcRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(offer);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call_answer', { conversationId, answer });
      } catch { /* ignore */ }
    };

    const onEnded = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      teardown();
      setStatus('ended');
      setTimeout(onClose, 1200);
    };
    const onRejected = () => {
      if (closedRef.current) return;
      closedRef.current = true;
      logCall('missed');
      teardown();
      setStatus('ended');
      setTimeout(onClose, 1200);
    };

    socket.on('call_answered', onAnswered);
    socket.on('call_ice_candidate', onIce);
    socket.on('call_renegotiate', onRenegotiate);
    socket.on('call_ended', onEnded);
    socket.on('call_rejected', onRejected);
    return () => {
      socket.off('call_answered', onAnswered);
      socket.off('call_ice_candidate', onIce);
      socket.off('call_renegotiate', onRenegotiate);
      socket.off('call_ended', onEnded);
      socket.off('call_rejected', onRejected);
    };
  }, [socket, flushCandidates, teardown, onClose, logCall, conversationId]);

  useEffect(() => () => teardown(), [teardown]);

  const toggleMute = () => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
    setMuted(next);
  };
  const toggleCamera = () => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !next; });
    setCameraOff(next);
  };

  // Habillage de l'onglet : titre + favicon téléphone aux couleurs du thème
  useEffect(() => {
    if (status === 'ended') { clearCallTab(); return; }
    const tabState =
      status === 'active' ? 'active'
      : status === 'reconnecting' ? 'reconnecting'
      : isIncoming ? 'incoming'
      : 'ringing';
    setCallTab(tabState, callerName);
  }, [status, isIncoming, callerName]);
  useEffect(() => () => clearCallTab(), []);

  // Plein écran pour la vidéo
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const toggleFullscreen = () => {
    const el = videoContainerRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  };

  const initial = (callerName || '?').charAt(0).toUpperCase();
  const statusLabel =
    status === 'ringing' ? (isIncoming ? 'Appel entrant…' : 'Sonnerie…')
    : status === 'connecting' ? 'Connexion…'
    : status === 'reconnecting' ? 'Reconnexion…'
    : status === 'active' ? formatDuration(duration)
    : 'Appel terminé';

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }}>

      {callType === 'video' ? (
        <div className="relative rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 'min(92vw, 720px)', background: 'var(--sat-void)', border: '1px solid var(--sat-border-2)' }}>
          <div ref={videoContainerRef} className="relative aspect-video" style={{ background: 'var(--sat-void)' }}>
            <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
            {(status !== 'active' && status !== 'reconnecting') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'var(--sat-void)' }}>
                <Avatar image={callerImage} initial={initial} ringing={status === 'ringing'} />
                <p className="font-bold text-lg" style={{ color: 'var(--sat-text)' }}>{callerName}</p>
                <p className="text-sm" style={{ color: 'var(--sat-muted)' }}>{statusLabel}</p>
              </div>
            )}
            {/* Aperçu local en miroir (vue selfie) */}
            <div className="absolute bottom-3 right-3 rounded-xl overflow-hidden shadow-lg"
              style={{ width: 112, height: 80, border: '2px solid var(--sat-accent)', background: 'var(--sat-surface)' }}>
              <video ref={localRef} autoPlay playsInline muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', display: cameraOff ? 'none' : 'block' }} />
              {cameraOff && (
                <div className="w-full h-full flex items-center justify-center" style={{ color: 'var(--sat-faint)' }}>
                  <VideoOffIcon size={20} />
                </div>
              )}
            </div>
            {(status === 'active' || status === 'reconnecting') && (
              <>
                <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-2" style={{ background: 'rgba(0,0,0,0.45)' }}>
                  {callerName}
                  <QualityBars quality={quality} />
                </div>
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <div className="px-3 py-1 rounded-full text-white text-xs font-semibold tabular-nums" style={{ background: 'rgba(0,0,0,0.45)' }}>
                    {status === 'reconnecting' ? 'Reconnexion…' : formatDuration(duration)}
                  </div>
                  <button onClick={toggleFullscreen} title="Plein écran"
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white transition hover:scale-105"
                    style={{ background: 'rgba(0,0,0,0.45)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
                    </svg>
                  </button>
                </div>
              </>
            )}
          </div>
          <CallControls status={status} isIncoming={isIncoming} callType={callType}
            muted={muted} cameraOff={cameraOff}
            onAccept={handleAccept} onReject={handleReject} onEnd={handleEnd}
            onToggleMute={toggleMute} onToggleCamera={toggleCamera} />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-2xl"
          style={{ width: 320, background: 'var(--sat-surface)', border: '1px solid var(--sat-border-2)' }}>
          <audio ref={remoteRef as any} autoPlay />
          <div className="flex flex-col items-center pt-10 pb-6 px-6 gap-4 relative">
            <Avatar image={callerImage} initial={initial} ringing={status === 'ringing'} />
            <div className="text-center z-10">
              <p className="font-bold text-xl mb-1" style={{ color: 'var(--sat-text)' }}>{callerName || 'Appel'}</p>
              <p className="text-sm tabular-nums flex items-center justify-center gap-2" style={{ color: 'var(--sat-muted)' }}>
                {statusLabel}
                {(status === 'active' || status === 'reconnecting') && <QualityBars quality={quality} />}
              </p>
            </div>
          </div>
          <CallControls status={status} isIncoming={isIncoming} callType={callType}
            muted={muted} cameraOff={cameraOff}
            onAccept={handleAccept} onReject={handleReject} onEnd={handleEnd}
            onToggleMute={toggleMute} onToggleCamera={toggleCamera} />
        </div>
      )}
    </div>
  );
}

function Avatar({ image, initial, ringing }: { image?: string; initial: string; ringing: boolean }) {
  return (
    <div className="relative flex items-center justify-center">
      {ringing && (
        <>
          <span className="absolute w-32 h-32 rounded-full animate-ping" style={{ background: 'var(--sat-accent-glow)', animationDuration: '1.5s' }} />
          <span className="absolute w-28 h-28 rounded-full animate-ping" style={{ background: 'var(--sat-accent-glow)', animationDuration: '1.5s', animationDelay: '0.4s' }} />
        </>
      )}
      <div className="relative w-24 h-24 rounded-full overflow-hidden shadow-xl z-10" style={{ border: '3px solid var(--sat-border-2)' }}>
        {image
          ? <img src={mediaUrl(image)} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-3xl font-black text-white"
              style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))' }}>{initial}</div>}
      </div>
    </div>
  );
}

function CallControls({
  status, isIncoming, callType, muted, cameraOff,
  onAccept, onReject, onEnd, onToggleMute, onToggleCamera,
}: {
  status: Status; isIncoming: boolean; callType: 'audio' | 'video';
  muted: boolean; cameraOff: boolean;
  onAccept: () => void; onReject: () => void; onEnd: () => void;
  onToggleMute: () => void; onToggleCamera: () => void;
}) {
  return (
    <div className="px-5 py-5 flex flex-col items-center gap-3"
      style={{ background: 'var(--sat-panel)', borderTop: '1px solid var(--sat-border)' }}>
      {status === 'ringing' && isIncoming ? (
        <div className="flex gap-8">
          <div className="flex flex-col items-center gap-2">
            <button onClick={onReject} className="w-16 h-16 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
              style={{ background: '#EF4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
              <PhoneOffIcon size={26} />
            </button>
            <span className="text-[11px] font-medium" style={{ color: 'var(--sat-muted)' }}>Refuser</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button onClick={onAccept} className="w-16 h-16 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,var(--sat-accent),var(--sat-accent2))', boxShadow: '0 6px 20px var(--sat-accent-glow)' }}>
              <PhoneIcon size={26} />
            </button>
            <span className="text-[11px] font-medium" style={{ color: 'var(--sat-muted)' }}>Répondre</span>
          </div>
        </div>
      ) : status === 'ended' ? (
        <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--sat-hover)' }}>
          <PhoneOffIcon size={20} style={{ color: 'var(--sat-faint)' }} />
        </div>
      ) : (
        <div className="flex gap-3 items-center">
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={onToggleMute} className="w-12 h-12 rounded-full flex items-center justify-center transition hover:scale-105 active:scale-95"
              style={{
                background: muted ? '#EF4444' : 'var(--sat-hover)',
                color: muted ? '#fff' : 'var(--sat-text)',
                border: muted ? 'none' : '1px solid var(--sat-border-2)',
              }}>
              {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
            </button>
            <span className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>{muted ? 'Muet' : 'Micro'}</span>
          </div>
          {callType === 'video' && (
            <div className="flex flex-col items-center gap-1.5">
              <button onClick={onToggleCamera} className="w-12 h-12 rounded-full flex items-center justify-center transition hover:scale-105 active:scale-95"
                style={{
                  background: cameraOff ? '#EF4444' : 'var(--sat-hover)',
                  color: cameraOff ? '#fff' : 'var(--sat-text)',
                  border: cameraOff ? 'none' : '1px solid var(--sat-border-2)',
                }}>
                {cameraOff ? <VideoOffIcon size={20} /> : <VideoIcon size={20} />}
              </button>
              <span className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>{cameraOff ? 'Off' : 'Caméra'}</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-1.5">
            <button onClick={onEnd} className="w-14 h-14 rounded-full flex items-center justify-center text-white transition hover:scale-105 active:scale-95"
              style={{ background: '#EF4444', boxShadow: '0 6px 20px rgba(239,68,68,0.4)' }}>
              <PhoneOffIcon size={24} />
            </button>
            <span className="text-[10px]" style={{ color: 'var(--sat-faint)' }}>Raccrocher</span>
          </div>
        </div>
      )}
    </div>
  );
}
