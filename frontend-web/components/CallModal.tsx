'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PhoneIcon, PhoneOffIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon } from '@/components/Icons';

interface CallModalProps {
  socket: any;
  conversationId: string;
  callType: 'audio' | 'video';
  isIncoming: boolean;
  callerName?: string;
  incomingOffer?: RTCSessionDescriptionInit;
  onClose: () => void;
}

export function CallModal({ socket, conversationId, callType, isIncoming, callerName, incomingOffer, onClose }: CallModalProps) {
  const [status, setStatus] = useState<'ringing' | 'connecting' | 'active' | 'ended'>(isIncoming ? 'ringing' : 'connecting');
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
  }, []);

  const formatDuration = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const getLocalStream = useCallback(async () => {
    const constraints = callType === 'video' ? { audio: true, video: true } : { audio: true };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStreamRef.current = stream;
    if (localRef.current) localRef.current.srcObject = stream;
    return stream;
  }, [callType]);

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    });
    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('call_ice_candidate', { conversationId, candidate: e.candidate });
    };
    pc.ontrack = (e) => {
      if (remoteRef.current && e.streams[0]) remoteRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setStatus('active'); startTimer(); }
      if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) handleEnd();
    };
    pcRef.current = pc;
    return pc;
  }, [socket, conversationId, startTimer]);

  const handleAccept = useCallback(async () => {
    setStatus('connecting');
    const stream = await getLocalStream();
    const pc = createPeerConnection();
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    if (incomingOffer) {
      await pc.setRemoteDescription(incomingOffer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('call_answer', { conversationId, answer });
    }
  }, [getLocalStream, createPeerConnection, incomingOffer, socket, conversationId]);

  const handleEnd = useCallback(() => {
    socket.emit('call_end', { conversationId });
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    pcRef.current?.close();
    if (durationRef.current) clearInterval(durationRef.current);
    setStatus('ended');
    setTimeout(onClose, 1200);
  }, [socket, conversationId, onClose]);

  const handleReject = useCallback(() => {
    socket.emit('call_reject', { conversationId });
    onClose();
  }, [socket, conversationId, onClose]);

  useEffect(() => {
    if (isIncoming) return;
    (async () => {
      const stream = await getLocalStream().catch(onClose);
      if (!stream) return;
      const pc = createPeerConnection();
      (stream as MediaStream).getTracks().forEach((t) => pc.addTrack(t, stream as MediaStream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('call_offer', { conversationId, offer, callType });
    })();
    return () => {
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
      if (durationRef.current) clearInterval(durationRef.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onAnswer = async ({ answer }: any) => {
      await pcRef.current?.setRemoteDescription(answer);
    };
    const onIce = async ({ candidate }: any) => {
      await pcRef.current?.addIceCandidate(candidate).catch(() => {});
    };
    const onEnd = () => { setStatus('ended'); localStreamRef.current?.getTracks().forEach((t) => t.stop()); setTimeout(onClose, 1200); };
    socket.on('call_answered', onAnswer);
    socket.on('call_ice_candidate', onIce);
    socket.on('call_ended', onEnd);
    socket.on('call_rejected', () => { setStatus('ended'); setTimeout(onClose, 1200); });
    return () => { socket.off('call_answered', onAnswer); socket.off('call_ice_candidate', onIce); socket.off('call_ended', onEnd); socket.off('call_rejected'); };
  }, [socket, onClose]);

  const toggleMute = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
    setMuted((m) => !m);
  };

  const toggleCamera = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
    setCameraOff((c) => !c);
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="relative rounded-2xl overflow-hidden shadow-2xl" style={{ width: callType === 'video' ? 560 : 320, background: '#1a1a2e' }}>

        {callType === 'video' && (
          <div className="relative" style={{ height: 360, background: '#0f0f1a' }}>
            <video ref={remoteRef} autoPlay playsInline className="w-full h-full object-cover" />
            <video ref={localRef} autoPlay playsInline muted className="absolute bottom-3 right-3 w-24 h-18 rounded-xl object-cover border-2 border-white border-opacity-20" style={{ height: 72 }} />
          </div>
        )}

        {callType === 'audio' && (
          <div className="flex flex-col items-center py-10">
            <div className="w-20 h-20 rounded-full mb-4 flex items-center justify-center text-white" style={{ background: 'rgba(37,99,235,0.25)' }}>
              <PhoneIcon size={34} />
            </div>
            <audio ref={remoteRef as any} autoPlay />
            <audio ref={localRef as any} autoPlay muted />
          </div>
        )}

        <div className="p-5 flex flex-col items-center gap-3" style={{ background: 'rgba(0,0,0,0.4)' }}>
          <div className="text-center">
            {callerName && <p className="text-white font-bold text-base">{callerName}</p>}
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {status === 'ringing' && (isIncoming ? 'Appel entrant...' : 'Appel en cours...')}
              {status === 'connecting' && 'Connexion...'}
              {status === 'active' && formatDuration(duration)}
              {status === 'ended' && 'Appel terminé'}
            </p>
          </div>

          {status === 'ringing' && isIncoming ? (
            <div className="flex gap-4">
              <button onClick={handleReject} className="w-14 h-14 rounded-full flex items-center justify-center text-white transition hover:opacity-90" style={{ background: '#EF4444' }} title="Refuser">
                <PhoneOffIcon size={24} />
              </button>
              <button onClick={handleAccept} className="w-14 h-14 rounded-full flex items-center justify-center text-white transition hover:opacity-90" style={{ background: '#10B981' }} title="Répondre">
                <PhoneIcon size={24} />
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={toggleMute} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition" style={{ background: muted ? '#EF4444' : 'rgba(255,255,255,0.15)' }} title={muted ? 'Activer le micro' : 'Couper le micro'}>
                {muted ? <MicOffIcon size={20} /> : <MicIcon size={20} />}
              </button>
              {callType === 'video' && (
                <button onClick={toggleCamera} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition" style={{ background: cameraOff ? '#EF4444' : 'rgba(255,255,255,0.15)' }} title={cameraOff ? 'Activer la caméra' : 'Couper la caméra'}>
                  {cameraOff ? <VideoOffIcon size={20} /> : <VideoIcon size={20} />}
                </button>
              )}
              <button onClick={handleEnd} className="w-12 h-12 rounded-full flex items-center justify-center text-white transition hover:opacity-90" style={{ background: '#EF4444' }} title="Raccrocher">
                <PhoneOffIcon size={22} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
