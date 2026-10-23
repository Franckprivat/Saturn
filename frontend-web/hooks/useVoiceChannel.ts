'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
} from 'livekit-client';
import { api } from '@/lib/api';
import { toast } from '@/components/Toast';
import { apiErrorMessage } from '@/lib/errors';

export interface VoicePeer {
  userId: string;
  muted: boolean;
  speaking: boolean;
}

/**
 * Salon vocal façon Discord, via le serveur média LiveKit (SFU) : chaque
 * participant envoie sa voix une seule fois au serveur, qui la redistribue.
 * Le socket annonce seulement l'entrée et la sortie (liste « en vocal »).
 */
export function useVoiceChannel(socket: Socket | null) {
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [peers, setPeers] = useState<Record<string, VoicePeer>>({}); // userId -> peer
  const [selfMuted, setSelfMuted] = useState(false);
  const [selfSpeaking, setSelfSpeaking] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const roomRef = useRef<Room | null>(null);
  const activeRef = useRef<string | null>(null);
  const pendingRef = useRef<string | null>(null); // salon en cours de connexion
  const audiosRef = useRef<Map<string, HTMLMediaElement>>(new Map()); // trackSid -> <audio>
  const selfMutedRef = useRef(false);
  const deafenedRef = useRef(false);

  const peerFrom = (p: Participant, speaking = p.isSpeaking): VoicePeer => ({
    userId: p.identity,
    muted: !p.isMicrophoneEnabled,
    speaking,
  });

  const syncPeers = useCallback((room: Room) => {
    const next: Record<string, VoicePeer> = {};
    room.remoteParticipants.forEach((p) => { next[p.identity] = peerFrom(p); });
    setPeers(next);
  }, []);

  const cleanup = useCallback(() => {
    audiosRef.current.forEach((el) => { el.srcObject = null; el.remove(); });
    audiosRef.current.clear();
    roomRef.current = null;
    activeRef.current = null;
    setActiveChannelId(null);
    setPeers({});
    setSelfSpeaking(false);
  }, []);

  const leave = useCallback(() => {
    const ch = activeRef.current;
    pendingRef.current = null;
    if (socket && ch) socket.emit('voice_leave', { channelId: ch });
    const room = roomRef.current;
    cleanup();
    room?.disconnect().catch(() => {});
  }, [socket, cleanup]);

  const join = useCallback(async (channelId: string) => {
    if (!socket || activeRef.current === channelId || pendingRef.current === channelId) return;
    if (activeRef.current) leave();
    pendingRef.current = channelId;
    setConnecting(true);
    const room = new Room({ adaptiveStream: true, dynacast: true });
    try {
      const { data } = await api.post<{ url: string; token: string }>(`/voice/${channelId}/token`);

      room
        .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind !== Track.Kind.Audio || !track.sid) return;
          // Un même son peut être ré-abonné (reconnexion) : on réutilise son <audio>
          const existing = audiosRef.current.get(track.sid);
          const el = existing ? track.attach(existing) : track.attach();
          el.muted = deafenedRef.current;
          if (!existing) document.body.appendChild(el);
          audiosRef.current.set(track.sid, el);
        })
        .on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
          track.detach().forEach((el) => el.remove());
          // LiveKit peut avoir déjà détaché la piste : on retire aussi notre élément
          if (track.sid) {
            audiosRef.current.get(track.sid)?.remove();
            audiosRef.current.delete(track.sid);
          }
        })
        .on(RoomEvent.ParticipantConnected, () => syncPeers(room))
        .on(RoomEvent.ParticipantDisconnected, () => syncPeers(room))
        .on(RoomEvent.TrackMuted, () => syncPeers(room))
        .on(RoomEvent.TrackUnmuted, () => syncPeers(room))
        .on(RoomEvent.TrackPublished, () => syncPeers(room))
        .on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) => {
          const ids = new Set(speakers.map((p) => p.identity));
          setSelfSpeaking(!selfMutedRef.current && ids.has(room.localParticipant.identity));
          syncPeers(room);
        })
        .on(RoomEvent.Disconnected, () => {
          // Plus aucun son de ce salon, même s'il n'est plus le salon courant
          room.remoteParticipants.forEach((p) => p.trackPublications.forEach((pub) => {
            pub.track?.detach().forEach((el) => el.remove());
            if (pub.trackSid) {
              audiosRef.current.get(pub.trackSid)?.remove();
              audiosRef.current.delete(pub.trackSid);
            }
          }));
          // Coupure côté serveur (exclusion, salon fermé) : on nettoie l'état local
          if (roomRef.current !== room) return;
          if (socket && activeRef.current) socket.emit('voice_leave', { channelId: activeRef.current });
          cleanup();
        });

      await room.connect(data.url, data.token);
      // Salon quitté (ou autre salon choisi) pendant la connexion
      if (pendingRef.current !== channelId) {
        await room.disconnect();
        return;
      }
      pendingRef.current = null;
      await room.localParticipant.setMicrophoneEnabled(!selfMutedRef.current);
      roomRef.current = room;
      activeRef.current = channelId;
      setActiveChannelId(channelId);
      syncPeers(room);
      socket.emit('voice_join', { channelId });
    } catch (err) {
      if (pendingRef.current === channelId) pendingRef.current = null;
      await room.disconnect().catch(() => {});
      toast(apiErrorMessage(err, 'Connexion au salon vocal impossible (micro autorisé ?)'), 'error');
    } finally {
      setConnecting(false);
    }
  }, [socket, leave, cleanup, syncPeers]);

  const toggleMute = useCallback(() => {
    const next = !selfMutedRef.current;
    selfMutedRef.current = next;
    setSelfMuted(next);
    if (next) setSelfSpeaking(false);
    roomRef.current?.localParticipant.setMicrophoneEnabled(!next).catch(() => {});
  }, []);

  const toggleDeafen = useCallback(() => {
    const next = !deafenedRef.current;
    deafenedRef.current = next;
    setDeafened(next);
    // Couper / rétablir l'audio entrant
    audiosRef.current.forEach((el) => { el.muted = next; });
    // Discord : se rendre sourd coupe aussi le micro
    if (next && !selfMutedRef.current) {
      selfMutedRef.current = true;
      setSelfMuted(true);
      setSelfSpeaking(false);
      roomRef.current?.localParticipant.setMicrophoneEnabled(false).catch(() => {});
    }
  }, []);

  useEffect(() => () => { if (activeRef.current) leave(); }, [leave]);

  return { activeChannelId, peers, selfMuted, selfSpeaking, deafened, connecting, join, leave, toggleMute, toggleDeafen };
}
