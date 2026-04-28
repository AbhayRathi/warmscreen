import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export interface ElevenLabsConfig {
  apiKey: string;
}

export interface VoiceProfile {
  voiceId: string;
  name: string;
  category?: string;
}

type AudioChunk = Uint8Array | ArrayBuffer | Buffer;
type ReaderLike = {
  read: () => Promise<{ done: boolean; value?: unknown }>;
  releaseLock?: () => void;
};
type ReaderStreamLike = { getReader: () => ReaderLike };
type AudioStreamLike = AsyncIterable<unknown> | ReaderStreamLike;

/**
 * ElevenLabsManager
 * Handles text-to-speech with voice cloning using ElevenLabs API
 */
export class ElevenLabsManager {
  private client: ElevenLabsClient;
  private defaultVoiceId: string = '21m00Tcm4TlvDq8ikWAM'; // Default Rachel voice

  constructor(config: ElevenLabsConfig) {
    this.client = new ElevenLabsClient({
      apiKey: config.apiKey,
    });
  }

  /**
   * Convert text to speech using a specific voice
   */
  async textToSpeech(
    text: string,
    voiceId?: string,
    options?: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    }
  ): Promise<Buffer> {
    const voice = voiceId || this.defaultVoiceId;
    
    const audioStream = await this.client.textToSpeech.convert(voice, {
      text,
      modelId: options?.modelId || 'eleven_multilingual_v2',
      voiceSettings: {
        stability: options?.stability ?? 0.5,
        similarityBoost: options?.similarityBoost ?? 0.75,
        style: options?.style ?? 0,
        useSpeakerBoost: options?.useSpeakerBoost ?? true,
      },
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of this.toAsyncChunkIterator(audioStream)) {
      chunks.push(this.chunkToBuffer(chunk));
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Stream text to speech (for real-time playback)
   */
  async textToSpeechStream(
    text: string,
    voiceId?: string,
    options?: {
      modelId?: string;
      stability?: number;
      similarityBoost?: number;
    }
  ): Promise<AsyncIterable<Buffer>> {
    const voice = voiceId || this.defaultVoiceId;
    
    const audioStream = await this.client.textToSpeech.convert(voice, {
      text,
      modelId: options?.modelId || 'eleven_multilingual_v2',
      voiceSettings: {
        stability: options?.stability ?? 0.5,
        similarityBoost: options?.similarityBoost ?? 0.75,
      },
    });

    // Return async generator that yields buffers
    const self = this;
    return (async function* () {
      for await (const chunk of self.toAsyncChunkIterator(audioStream)) {
        yield self.chunkToBuffer(chunk);
      }
    })();
  }

  /**
   * List all available voices (including custom cloned voices)
   */
  async listVoices(): Promise<VoiceProfile[]> {
    const response = await this.client.voices.getAll();
    
    return response.voices.map((voice: any) => ({
      voiceId: voice.voice_id,
      name: voice.name,
      category: voice.category,
    }));
  }

  /**
   * Get voice details
   */
  async getVoice(voiceId: string): Promise<any> {
    return await this.client.voices.get(voiceId);
  }

  /**
   * Clone a voice from audio samples
   * 
   * @deprecated Voice cloning via API requires manual setup.
   * Please use the ElevenLabs dashboard for voice cloning: https://elevenlabs.io/voice-lab
   * 
   * Voice cloning requires:
   * - ElevenLabs Pro+ subscription
   * - High-quality audio samples (1-3 minutes)
   * - Manual voice profile creation via dashboard
   * 
   * After cloning via dashboard, use the returned Voice ID with other TTS methods.
   * 
   * @param name - Name for the cloned voice
   * @param audioFiles - Array of audio file paths or buffers
   * @param description - Optional description
   * @throws Error indicating manual setup required
   */
  async cloneVoice(
    name: string,
    audioFiles: string[] | Buffer[],
    description?: string
  ): Promise<{ voiceId: string; name: string }> {
    throw new Error(
      'Voice cloning requires ElevenLabs Pro+ subscription and manual setup. ' +
      'Please clone voices through the ElevenLabs dashboard (https://elevenlabs.io/voice-lab) ' +
      'and use the voice ID with other TTS methods.'
    );
  }

  /**
   * Delete a cloned voice
   */
  async deleteVoice(voiceId: string): Promise<void> {
    await this.client.voices.delete(voiceId);
  }

  /**
   * Set default voice for TTS
   */
  setDefaultVoice(voiceId: string): void {
    this.defaultVoiceId = voiceId;
  }

  /**
   * Get current default voice ID
   */
  getDefaultVoiceId(): string {
    return this.defaultVoiceId;
  }

  /**
   * Get user subscription info
   */
  async getSubscriptionInfo(): Promise<any> {
    return this.client.user.subscription;
  }

  private async *toAsyncChunkIterator(stream: AudioStreamLike): AsyncIterable<AudioChunk> {
    const maybeAsyncIterable = stream as AsyncIterable<unknown>;
    if (typeof maybeAsyncIterable[Symbol.asyncIterator] === 'function') {
      for await (const chunk of maybeAsyncIterable) {
        if (this.isAudioChunk(chunk)) {
          yield chunk;
        } else if (chunk !== undefined && chunk !== null) {
          throw new Error('Unsupported ElevenLabs chunk type from async iterable stream');
        }
      }
      return;
    }

    const maybeReadable = stream as ReaderStreamLike;
    if (typeof maybeReadable.getReader === 'function') {
      const reader = maybeReadable.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (this.isAudioChunk(value)) {
            yield value;
          } else if (value !== undefined && value !== null) {
            throw new Error('Unsupported ElevenLabs chunk type from reader stream');
          }
        }
      } finally {
        reader.releaseLock?.();
      }
      return;
    }

    throw new Error('Unsupported ElevenLabs audio stream type');
  }

  private chunkToBuffer(chunk: Uint8Array | ArrayBuffer | Buffer): Buffer {
    if (Buffer.isBuffer(chunk)) return chunk;
    if (chunk instanceof Uint8Array) return Buffer.from(chunk);
    return Buffer.from(new Uint8Array(chunk));
  }

  private isAudioChunk(value: unknown): value is AudioChunk {
    return (
      Buffer.isBuffer(value) ||
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer
    );
  }
}
