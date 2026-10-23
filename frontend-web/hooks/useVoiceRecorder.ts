'use client';

import { useEffect, useRef, useState } from 'react';

// Enregistrement d'un message vocal (façon WhatsApp). `onRecorded` reçoit le
// fichier prêt à envoyer, sauf si l'enregistrement a été annulé.
export function useVoiceRecorder({
  onRecorded,
  onError,
}: {
  onRecorded: (blob: Blob, ext: string) => void;
  onError: (message: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const discardRef = useRef(false);
  // Toujours la dernière version des callbacks (la conversation peut changer)
  const callbacksRef = useRef({ onRecorded, onError });
  useEffect(() => { callbacksRef.current = { onRecorded, onError }; });

  const startRecording = async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4']
        .find((t) => MediaRecorder.isTypeSupported(t)) || '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];
      discardRef.current = false;
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (discardRef.current) return;
        const blob = new Blob(audioChunksRef.current, { type: mr.mimeType || 'audio/webm' });
        if (blob.size < 800) { callbacksRef.current.onError('Message vocal trop court.'); return; }
        const ext = mr.mimeType?.includes('mp4') ? 'mp4' : mr.mimeType?.includes('ogg') ? 'ogg' : 'webm';
        callbacksRef.current.onRecorded(blob, ext);
      };
      // timeslice → des chunks sont produits régulièrement (fiable même pour les clips courts)
      mr.start(200);
      mediaRecorderRef.current = mr;
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch { callbacksRef.current.onError('Micro inaccessible — autorise l\'accès au microphone.'); }
  };

  const finishRecording = (discard: boolean) => {
    discardRef.current = discard;
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
    if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    setRecordSeconds(0);
  };

  useEffect(() => () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); }, []);

  return { recording, recordSeconds, startRecording, finishRecording };
}
