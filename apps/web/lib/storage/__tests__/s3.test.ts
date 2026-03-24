import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock AWS SDK
const mockGetSignedUrl = vi.fn().mockResolvedValue('https://bucket.s3.amazonaws.com/test?signed=1');

vi.mock('@aws-sdk/client-s3', () => {
  class MockS3Client {
    constructor() {}
  }
  class MockPutObjectCommand {
    constructor(public params: unknown) {}
  }
  class MockGetObjectCommand {
    constructor(public params: unknown) {}
  }
  return {
    S3Client: MockS3Client,
    PutObjectCommand: MockPutObjectCommand,
    GetObjectCommand: MockGetObjectCommand,
  };
});

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

vi.mock('@/lib/env', () => ({
  voiceEnv: {
    STORAGE_PROVIDER: 's3',
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
    STORAGE_ACCESS_KEY_ID: 'test-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    STORAGE_REGION: 'us-east-1',
    R2_ACCOUNT_ID: '',
  },
}));

import { getSignedPutUrl, getSignedGetUrl, resetS3Client } from '@/lib/storage/s3';

describe('storage/s3', () => {
  beforeEach(() => {
    resetS3Client();
    mockGetSignedUrl.mockClear();
  });

  describe('getSignedPutUrl', () => {
    it('returns a signed upload URL with correct shape', async () => {
      const result = await getSignedPutUrl({
        key: 'interviews/abc/responses/def.webm',
        contentType: 'audio/webm',
        contentLength: 1000,
      });

      expect(result.uploadUrl).toContain('https://');
      expect(result.headers['Content-Type']).toBe('audio/webm');
      expect(result.headers['Content-Length']).toBe('1000');
      expect(result.ttlSec).toBe(300);
      expect(result.publicUrl).toBe(
        'https://cdn.example.com/interviews/abc/responses/def.webm',
      );
    });

    it('calls getSignedUrl from presigner', async () => {
      await getSignedPutUrl({
        key: 'test/key.webm',
        contentType: 'audio/webm',
        contentLength: 500,
      });

      expect(mockGetSignedUrl).toHaveBeenCalledTimes(1);
    });
  });

  describe('getSignedGetUrl', () => {
    it('returns a signed download URL', async () => {
      const url = await getSignedGetUrl('test/key.webm');
      expect(url).toContain('https://');
      expect(mockGetSignedUrl).toHaveBeenCalled();
    });
  });
});
