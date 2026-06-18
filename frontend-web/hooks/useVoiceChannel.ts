'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export interface VoicePeer {
  userId: string;
  muted: boolean;
  speaking: boolean;
}

/**
 * Salon vocal façon Discord — topologie mesh.
 * Chaque participant ouvre une connexion WebRTC directe avec chaque autre.
 * Le nouvel arrivant initie l'offre vers les pairs déjà présents.
 */
export function useVoiceChannel(socket: Socket | null) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({}); // socketId -> peer
  const [selfMuted, setSelfMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const activeRef = useRef<string | null>(null);
  const selfMutedRef = useRef(false);

  const cleanupPeer = useCallback((socketId: string) => {
    const pc = pcsRef.current.get(socketId);
    if (pc) { pc.close(); pcsRef.current.delete(socketId); }
    const a = audiosRef.current.get(socketId);
    if (a) { a.srcObject = null; a.remove(); audiosRef.current.delete(socketId); }
    setPeers((prev) => { const n = { ...prev }; delete n[socketId]; return n; });
  }, []);

  const createPeer = useCallback((socketId: string, userId: string, initiator: boolean) => {
    if (!socket) return null;
    const pc = new RTCPeerConnection(ICE_CONFIG);
    pcsRef.current.set(socketId, pc);

    localStreamRef.current?.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current!));

    pc.onicecandidate = (e) => {
      if (e.candidate) socket.emit('voice_signal', { targetSocketId: socketId, signal: { kind: 'ice', data: e.candidate } });
    };
    pc.ontrack = (e) => {
      let a = audiosRef.current.get(socketId);
      if (!a) {
        a = new Audio();
        a.autoplay = true;
        (a as any).playsInline = true;
        audiosRef.current.set(socketId, a);
        document.body.appendChild(a);
      }
      a.srcObject = e.streams[0];
      a.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) cleanupPeer(socketId);
    };

    setPeers((prev) => ({ ...prev, [socketId]: { userId, muted: false, speaking: false } }));

    if (initiator) {
      pc.onnegotiationneeded = async () => {
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('voice_signal', { targetSocketId: socketId, signal: { kind: 'offer', data: offer } });
        } catch { /* ignore */ }
      };
    }
    return pc;
  }, [socket, cleanupPeer]);

  const leave = useCallback(() => {
    const ch = activeRef.current;
    if (socket && ch) socket.emit('voice_leave', { channelId: ch });
    pcsRef.current.forEach((pc) => pc.close());
    pcsRef.current.clear();
    audiosRef.current.forEach((a) => { a.srcObject = null; a.remove(); });
    audiosRef.current.clear();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    activeRef.current = null;
    setActiveChannelId(null);
    setPeers({});
  }, [socket]);

  const join = useCallback(async (channelId: string) => {
    if (!socket || activeRef.current === channelId) return;
    if (activeRef.current) leave();
    setConnecting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      if (selfMutedRef.current) stream.getAudioTracks().forEach((t) => { t.enabled = false; });
      activeRef.current = channelId;
      setActiveChannelId(channelId);
      socket.emit('voice_join', { channelId });
    } catch {
      activeRef.current = null;
      setActiveChannelId(null);
    } finally {
      setConnecting(false);
    }
  }, [socket, leave]);

  const toggleMute = useCallback(() => {
    setSelfMuted((m) => {
      const next = !m;
      selfMutedRef.current = next;
      localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !next; });
      if (socket && activeRef.current) socket.emit('voice_mute', { channelId: activeRef.current, muted: next });
      return next;
    });
  }, [socket]);

  useEffect(() => {
    if (!socket) return;

    const onExisting = ({ channelId, peers: existing }: any) => {
      if (channelId !== activeRef.current) return;
      for (const p of existing) createPeer(p.socketId, p.userId, true);
    };
    const onSignal = async ({ fromSocketId, fromUserId, signal }: any) => {
      let pc = pcsRef.current.get(fromSocketId);
      try {
        if (signal.kind === 'offer') {
          if (!pc) pc = createPeer(fromSocketId, fromUserId, false)!;
          await pc.setRemoteDescription(signal.data);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('voice_signal', { targetSocketId: fromSocketId, signal: { kind: 'answer', data: answer } });
        } else if (signal.kind === 'answer') {
          if (pc) await pc.setRemoteDescription(signal.data);
        } else if (signal.kind === 'ice') {
          if (pc) await pc.addIceCandidate(signal.data).catch(() => {});
        }
      } catch { /* ignore */ }
    };
    const onLeft = ({ socketId }: any) => cleanupPeer(socketId);
    const onMute = ({ socketId, muted }: any) =>
      setPeers((prev) => (prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], muted } } : prev));

    socket.on('voice_existing_peers', onExisting);
    socket.on('voice_signal', onSignal);
    socket.on('voice_peer_left', onLeft);
    socket.on('voice_peer_mute', onMute);
    return () => {
      socket.off('voice_existing_peers', onExisting);
      socket.off('voice_signal', onSignal);
      socket.off('voice_peer_left', onLeft);
      socket.off('voice_peer_mute', onMute);
    };
  }, [socket, createPeer, cleanupPeer]);

  useEffect(() => () => { if (activeRef.current) leave(); }, [leave]);

  return { activeChannelId, peers, selfMuted, connecting, join, leave, toggleMute };
}
