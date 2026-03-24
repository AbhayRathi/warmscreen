import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { voiceEnv } from '@/lib/env';

// ---------------------------------------------------------------------------
// S3/R2 client singleton
// ---------------------------------------------------------------------------

let _client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (_client) return _client;

  const isR2 = voiceEnv.STORAGE_PROVIDER === 'r2';

  _client = new S3Client({
    region: isR2 ? 'auto' : voiceEnv.STORAGE_REGION,
    ...(isR2 && voiceEnv.R2_ACCOUNT_ID
      ? {
          endpoint: `https://${voiceEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        }
      : {}),
    credentials: {
      accessKeyId: voiceEnv.STORAGE_ACCESS_KEY_ID,
      secretAccessKey: voiceEnv.STORAGE_SECRET_ACCESS_KEY,
    },
  });

  return _client;
}

/** Reset client – useful for tests */
export function resetS3Client(): void {
  _client = null;
}

// ---------------------------------------------------------------------------
// Signed URL generation
// ---------------------------------------------------------------------------

export interface SignedPutUrlParams {
  key: string;
  contentType: string;
  contentLength: number;
}

export interface SignedPutUrlResult {
  uploadUrl: string;
  headers: Record<string, string>;
  publicUrl: string;
  ttlSec: number;
}

const SIGNED_URL_TTL_SEC = 300; // 5 minutes

/**
 * Generate a pre-signed PUT URL for uploading to S3/R2.
 * Scopes the URL to PUT-only with strict content-type enforcement.
 */
export async function getSignedPutUrl(
  params: SignedPutUrlParams,
): Promise<SignedPutUrlResult> {
  const { key, contentType, contentLength } = params;
  const client = getS3Client();

  const command = new PutObjectCommand({
    Bucket: voiceEnv.STORAGE_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: SIGNED_URL_TTL_SEC,
  });

  const publicUrl = voiceEnv.STORAGE_PUBLIC_BASE_URL
    ? `${voiceEnv.STORAGE_PUBLIC_BASE_URL.replace(/\/+$/, '')}/${key}`
    : `https://${voiceEnv.STORAGE_BUCKET}.s3.${voiceEnv.STORAGE_REGION}.amazonaws.com/${key}`;

  return {
    uploadUrl,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(contentLength),
    },
    publicUrl,
    ttlSec: SIGNED_URL_TTL_SEC,
  };
}

/**
 * Generate a pre-signed GET URL for downloading from S3/R2.
 * Used internally by transcription-service to fetch audio securely.
 */
export async function getSignedGetUrl(
  key: string,
  ttlSec = 600,
): Promise<string> {
  const client = getS3Client();

  const command = new GetObjectCommand({
    Bucket: voiceEnv.STORAGE_BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn: ttlSec });
}
