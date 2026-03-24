'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSec: number;
  peakLevel: number;
  error: string | null;
}

export interface UseRecorderReturn extends RecorderState {
  start: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => Promise<Blob | null>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useRecorder(): UseRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const levelFrameRef = useRef<number | null>(null);
  const resolveStopRef = useRef<((blob: Blob | null) => void) | null>(null);

  // Cleanup helper
  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (levelFrameRef.current !== null) {
      cancelAnimationFrame(levelFrameRef.current);
      levelFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  // ------- Level metering (AnalyserNode) -------
  const startLevelMetering = useCallback(
    (stream: MediaStream) => {
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(dataArray);
          let max = 0;
          for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > max) max = dataArray[i];
          }
          setPeakLevel(max / 255);
          levelFrameRef.current = requestAnimationFrame(tick);
        };
        tick();
      } catch {
        // AnalyserNode may not be available in all environments
      }
    },
    [],
  );

  // ------- Public API -------

  const start = useCallback(async () => {
    try {
      setError(null);
      cleanup();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/ogg';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        resolveStopRef.current?.(blob);
        resolveStopRef.current = null;
      };

      recorder.start(1000); // collect chunks every second
      setIsRecording(true);
      setIsPaused(false);
      setDurationSec(0);

      // Duration timer
      timerRef.current = setInterval(() => {
        setDurationSec((d) => d + 1);
      }, 1000);

      // Level metering
      startLevelMetering(stream);
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Microphone permission denied'
          : 'Failed to start recording';
      setError(msg);
    }
  }, [cleanup, startLevelMetering]);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerRef.current = setInterval(() => {
        setDurationSec((d) => d + 1);
      }, 1000);
    }
  }, []);

  const stop = useCallback(async (): Promise<Blob | null> => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === 'inactive'
    ) {
      return null;
    }

    return new Promise<Blob | null>((resolve) => {
      resolveStopRef.current = resolve;
      mediaRecorderRef.current!.stop();
      setIsRecording(false);
      setIsPaused(false);
      setPeakLevel(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (levelFrameRef.current !== null) {
        cancelAnimationFrame(levelFrameRef.current);
        levelFrameRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    });
  }, []);

  return {
    isRecording,
    isPaused,
    durationSec,
    peakLevel,
    error,
    start,
    pause,
    resume,
    stop,
  };
}
