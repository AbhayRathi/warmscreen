// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Browser API mocks
// ---------------------------------------------------------------------------

const mockStop = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();
const mockMediaRecorderStart = vi.fn();
const mockMediaRecorderStop = vi.fn();

let ondataavailableHandler: ((e: { data: Blob }) => void) | null = null;
let onstopHandler: (() => void) | null = null;

class MockMediaRecorder {
  state = 'inactive';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(
    public stream: MediaStream,
    public options: { mimeType: string },
  ) {}

  start(timeslice?: number) {
    this.state = 'recording';
    mockMediaRecorderStart(timeslice);
    ondataavailableHandler = this.ondataavailable;
    onstopHandler = this.onstop;
  }

  stop() {
    this.state = 'inactive';
    mockMediaRecorderStop();
    // Emit data event then stop event
    if (ondataavailableHandler) {
      ondataavailableHandler({ data: new Blob(['audio data'], { type: 'audio/webm' }) });
    }
    if (onstopHandler) {
      onstopHandler();
    }
  }

  pause() {
    this.state = 'paused';
    mockPause();
  }

  resume() {
    this.state = 'recording';
    mockResume();
  }

  static isTypeSupported(type: string) {
    return type === 'audio/webm';
  }
}

const mockTrack = { stop: mockStop };
const mockStream = {
  getTracks: () => [mockTrack],
} as unknown as MediaStream;

const mockGetUserMedia = vi.fn().mockResolvedValue(mockStream);

// Mock AudioContext for level metering
class MockAnalyserNode {
  fftSize = 256;
  frequencyBinCount = 128;
  connect() {}
  getByteFrequencyData(arr: Uint8Array) {
    arr[0] = 128; // 50% level
  }
}

class MockAudioContext {
  createMediaStreamSource() {
    return { connect: vi.fn() };
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  close() {
    return Promise.resolve();
  }
}

// Stub browser globals
vi.stubGlobal('MediaRecorder', MockMediaRecorder);
vi.stubGlobal('AudioContext', MockAudioContext);

Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: {
      getUserMedia: mockGetUserMedia,
    },
  },
  writable: true,
});

// Mock requestAnimationFrame / cancelAnimationFrame
let rafCallback: (() => void) | null = null;
vi.stubGlobal('requestAnimationFrame', (cb: () => void) => {
  rafCallback = cb;
  return 1;
});
vi.stubGlobal('cancelAnimationFrame', vi.fn());

// ---------------------------------------------------------------------------
// Import hook (after mocks)
// ---------------------------------------------------------------------------

import { useRecorder } from '@/lib/voice/useRecorder';

describe('useRecorder', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    ondataavailableHandler = null;
    onstopHandler = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initialises with default state', () => {
    const { result } = renderHook(() => useRecorder());

    expect(result.current.isRecording).toBe(false);
    expect(result.current.isPaused).toBe(false);
    expect(result.current.durationSec).toBe(0);
    expect(result.current.peakLevel).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('starts recording and sets isRecording=true', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isRecording).toBe(true);
    expect(result.current.isPaused).toBe(false);
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockMediaRecorderStart).toHaveBeenCalledWith(1000);
  });

  it('increments duration each second while recording', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.durationSec).toBe(0);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.durationSec).toBe(3);
  });

  it('produces a Blob on stop', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(result.current.isRecording).toBe(false);
  });

  it('pause/resume toggles isPaused', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      result.current.pause();
    });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      result.current.resume();
    });
    expect(result.current.isPaused).toBe(false);
  });

  it('pausing stops the duration timer', async () => {
    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.durationSec).toBe(2);

    act(() => {
      result.current.pause();
    });

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    // Duration should not have increased while paused
    expect(result.current.durationSec).toBe(2);
  });

  it('sets error on permission denied', async () => {
    const permError = new DOMException('Permission denied', 'NotAllowedError');
    mockGetUserMedia.mockRejectedValueOnce(permError);

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe('Microphone permission denied');
    expect(result.current.isRecording).toBe(false);
  });

  it('sets generic error on other failures', async () => {
    mockGetUserMedia.mockRejectedValueOnce(new Error('Device not found'));

    const { result } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).toBe('Failed to start recording');
  });

  it('stops tracks on cleanup', async () => {
    const { result, unmount } = renderHook(() => useRecorder());

    await act(async () => {
      await result.current.start();
    });

    unmount();

    expect(mockStop).toHaveBeenCalled();
  });

  it('returns null when stop is called without active recording', async () => {
    const { result } = renderHook(() => useRecorder());

    let blob: Blob | null = null;
    await act(async () => {
      blob = await result.current.stop();
    });

    expect(blob).toBeNull();
  });
});
