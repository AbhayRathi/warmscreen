'use client';

import { useState, useCallback } from 'react';
import { useRecorder } from '@/lib/voice/useRecorder';
import LevelMeter from './LevelMeter';
import { apiPost } from '@/lib/api';

interface RecorderPanelProps {
  responseId?: string;
  interviewId?: string;
  questionId?: string;
  onBeforeRecord?: () => Promise<string>;
  onTranscriptionComplete?: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 3;

export default function RecorderPanel({
  responseId: initialResponseId,
  interviewId,
  questionId,
  onBeforeRecord,
  onTranscriptionComplete,
}: RecorderPanelProps) {
  const {
    isRecording,
    isPaused,
    durationSec,
    peakLevel,
    error: recorderError,
    start,
    pause,
    resume,
    stop,
  } = useRecorder();

  const [uploadProgress, setUploadProgress] = useState<
    'idle' | 'uploading' | 'transcribing' | 'done' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeResponseId, setActiveResponseId] = useState<string | undefined>(initialResponseId);
  const [lastAudioUrl, setLastAudioUrl] = useState<string | null>(null);
  const [lastMimeType, setLastMimeType] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  /** Poll transcription status endpoint */
  const pollTranscriptionStatus = useCallback(
    async (respId: string) => {
      for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt++) {
        // First attempt has shorter delay for faster feedback
        const delay = attempt === 0 ? 2_000 : POLL_INTERVAL_MS;
        await new Promise((r) => setTimeout(r, delay));
        try {
          const res = await fetch(
            `/api/transcriptions/status?responseId=${encodeURIComponent(respId)}`,
          );
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status === 'completed') {
            setUploadProgress('done');
            onTranscriptionComplete?.();
            return;
          }
        } catch {
          // Ignore transient fetch errors during polling
        }
      }
      // After all poll attempts exhausted, surface a timeout error
      setUploadProgress('error');
      setErrorMsg('Transcription timed out — please retry.');
    },
    [onTranscriptionComplete],
  );

  /** Handle record button: obtain responseId before starting */
  const handleStart = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      let respId = activeResponseId;
      if (onBeforeRecord) {
        respId = await onBeforeRecord();
        setActiveResponseId(respId);
      }
      await start();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to start recording');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStop = async () => {
    const blob = await stop();
    if (!blob) return;

    const respId = activeResponseId;
    if (!respId) {
      setUploadProgress('error');
      setErrorMsg('No response ID available. Please try again.');
      return;
    }

    try {
      setUploadProgress('uploading');
      setErrorMsg(null);

      // 1. Get signed URL
      const ext = blob.type.includes('ogg') ? 'ogg' : 'webm';
      const signResult = await apiPost('/api/uploads/sign', {
        fileName: `recording.${ext}`,
        mimeType: blob.type,
        contentLength: blob.size,
        interviewId,
        responseId: respId,
      });

      // 2. Upload blob to signed URL
      const uploadRes = await fetch(signResult.uploadUrl, {
        method: 'PUT',
        headers: signResult.headers,
        body: blob,
      });

      if (!uploadRes.ok) {
        throw new Error(`Upload failed: HTTP ${uploadRes.status}`);
      }

      // 3. Request transcription
      setUploadProgress('transcribing');
      setLastAudioUrl(signResult.publicUrl);
      setLastMimeType(blob.type);

      const txRes = await apiPost('/api/transcriptions/request', {
        responseId: respId,
        audioUrl: signResult.publicUrl,
        mimeType: blob.type,
        durationSec,
      });

      if (txRes.status === 'accepted' || txRes.status === 'already_in_progress') {
        // Start lightweight polling for completion
        pollTranscriptionStatus(respId);
      } else if (txRes.status === 'already_completed') {
        setUploadProgress('done');
        onTranscriptionComplete?.();
      }
    } catch (err: unknown) {
      setUploadProgress('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  /** Retry transcription request */
  const handleRetry = async () => {
    const respId = activeResponseId;
    if (!respId || !lastAudioUrl || !lastMimeType) return;

    try {
      setUploadProgress('transcribing');
      setErrorMsg(null);

      await apiPost('/api/transcriptions/request', {
        responseId: respId,
        audioUrl: lastAudioUrl,
        mimeType: lastMimeType,
        durationSec,
      });

      pollTranscriptionStatus(respId);
    } catch (err: unknown) {
      setUploadProgress('error');
      setErrorMsg(err instanceof Error ? err.message : 'Retry failed');
    }
  };

  const displayError = recorderError || errorMsg;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Voice Recording</h3>
        {isRecording && (
          <span className="text-xs text-gray-500 font-mono">
            {formatTime(durationSec)}
          </span>
        )}
      </div>

      {/* Level meter */}
      {isRecording && <LevelMeter level={peakLevel} />}

      {/* Controls */}
      <div className="flex gap-2">
        {!isRecording && uploadProgress === 'idle' && (
          <button
            onClick={handleStart}
            disabled={isStarting}
            aria-label="Start recording"
            className="flex-1 bg-red-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            🎙 Record
          </button>
        )}

        {isRecording && !isPaused && (
          <>
            <button
              onClick={pause}
              aria-label="Pause recording"
              className="flex-1 bg-yellow-500 text-white text-sm py-2 px-4 rounded-lg hover:bg-yellow-600 transition"
            >
              ⏸ Pause
            </button>
            <button
              onClick={handleStop}
              aria-label="Stop recording"
              className="flex-1 bg-gray-700 text-white text-sm py-2 px-4 rounded-lg hover:bg-gray-800 transition"
            >
              ⏹ Stop
            </button>
          </>
        )}

        {isRecording && isPaused && (
          <>
            <button
              onClick={resume}
              aria-label="Resume recording"
              className="flex-1 bg-green-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-green-700 transition"
            >
              ▶ Resume
            </button>
            <button
              onClick={handleStop}
              aria-label="Stop recording"
              className="flex-1 bg-gray-700 text-white text-sm py-2 px-4 rounded-lg hover:bg-gray-800 transition"
            >
              ⏹ Stop
            </button>
          </>
        )}
      </div>

      {/* Status */}
      {uploadProgress === 'uploading' && (
        <p className="text-xs text-blue-600">Uploading audio…</p>
      )}
      {uploadProgress === 'transcribing' && (
        <p className="text-xs text-indigo-600">Transcribing…</p>
      )}
      {uploadProgress === 'done' && (
        <p className="text-xs text-green-600">Transcription complete ✓</p>
      )}

      {/* Error + Retry */}
      {displayError && (
        <div className="space-y-2">
          <p className="text-xs text-red-600">
            {uploadProgress === 'error'
              ? 'Transcription failed — please re-record or try again.'
              : displayError}
          </p>
          {uploadProgress === 'error' && lastAudioUrl && (
            <button
              onClick={handleRetry}
              aria-label="Retry transcription"
              className="text-xs bg-indigo-100 text-indigo-700 py-1 px-3 rounded hover:bg-indigo-200 transition"
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
