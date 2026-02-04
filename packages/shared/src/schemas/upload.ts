import { z } from "zod";

/**
 * Allowed MIME types for file uploads
 * Only common image formats are allowed by default
 */
export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Presigned URL expiration time in seconds (5 minutes)
 */
export const PRESIGNED_URL_EXPIRES_IN = 300;

/**
 * Request schema for generating presigned upload URL
 */
export const presignUploadSchema = z.object({
  filename: z
    .string()
    .min(1, "Filename is required")
    .max(255, "Filename too long")
    .regex(/^[a-zA-Z0-9._-]+$/, "Filename contains invalid characters"),
  contentType: z.enum(ALLOWED_MIME_TYPES, {
    errorMap: () => ({ message: "File type not allowed" }),
  }),
  size: z
    .number()
    .int()
    .positive("File size must be positive")
    .max(MAX_FILE_SIZE, `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`),
});

export type PresignUploadInput = z.infer<typeof presignUploadSchema>;

/**
 * Response data for presigned upload URL
 */
export interface PresignUploadResponse {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

/**
 * Helper function to check if a MIME type is allowed
 */
export function isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
  return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
}

/**
 * Helper function to get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: AllowedMimeType): string {
  const extensions: Record<AllowedMimeType, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
  };
  return extensions[mimeType];
}
