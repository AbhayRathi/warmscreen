'use client';

import { useState } from 'react';
import { useRecorder } from '@/lib/voice/useRecorder';
import LevelMeter from './LevelMeter';
import { apiPost } from '@/lib/api';

interface RecorderPanelProps {
  responseId?: string;
  interviewId?: string;
  onTranscriptionComplete?: () => void;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function RecorderPanel({
  responseId,
  interviewId,
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

  const handleStop = async () => {
    const blob = await stop();
    if (!blob) return;

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
        responseId,
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
      await apiPost('/api/transcriptions/request', {
        responseId,
        audioUrl: signResult.publicUrl,
        mimeType: blob.type,
        durationSec,
      });

      setUploadProgress('done');
      onTranscriptionComplete?.();
    } catch (err: unknown) {
      setUploadProgress('error');
      setErrorMsg(err instanceof Error ? err.message : 'Upload failed');
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
            onClick={start}
            className="flex-1 bg-red-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-red-700 transition"
          >
            🎙 Record
          </button>
        )}

        {isRecording && !isPaused && (
          <>
            <button
              onClick={pause}
              className="flex-1 bg-yellow-500 text-white text-sm py-2 px-4 rounded-lg hover:bg-yellow-600 transition"
            >
              ⏸ Pause
            </button>
            <button
              onClick={handleStop}
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
              className="flex-1 bg-green-600 text-white text-sm py-2 px-4 rounded-lg hover:bg-green-700 transition"
            >
              ▶ Resume
            </button>
            <button
              onClick={handleStop}
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

      {/* Error */}
      {displayError && (
        <p className="text-xs text-red-600">{displayError}</p>
      )}
    </div>
  );
}
