import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PRESIGNED_URL_EXPIRES_IN, getExtensionFromMimeType } from "@repo/shared";
import type { AllowedMimeType } from "@repo/shared";

let _r2Client: S3Client | null = null;

/**
 * Check if R2 is configured
 */
export function isR2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

/**
 * Get R2 client instance (singleton)
 */
export function getR2Client(): S3Client {
  if (!_r2Client) {
    if (!isR2Configured()) {
      throw new Error("R2 is not configured");
    }

    _r2Client = new S3Client({
      region: "auto",
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _r2Client;
}

/**
 * Generate a unique file key for R2 storage
 * Format: uploads/{userId}/{timestamp}-{uuid}.{ext}
 */
export function generateFileKey(userId: string, contentType: AllowedMimeType): string {
  const ext = getExtensionFromMimeType(contentType);
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();
  return `uploads/${userId}/${timestamp}-${uuid}.${ext}`;
}

/**
 * Get public URL for a file key
 */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (publicUrl) {
    return `${publicUrl}/${key}`;
  }
  // Fallback: construct URL from bucket name (requires public access configured)
  return `https://${process.env.R2_BUCKET_NAME}.r2.dev/${key}`;
}

interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

/**
 * Generate a presigned URL for uploading a file to R2
 */
export async function generatePresignedUploadUrl(
  userId: string,
  contentType: AllowedMimeType,
  size: number,
): Promise<PresignedUrlResult> {
  const client = getR2Client();
  const key = generateFileKey(userId, contentType);

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGNED_URL_EXPIRES_IN,
  });

  return {
    uploadUrl,
    key,
    publicUrl: getPublicUrl(key),
  };
}
