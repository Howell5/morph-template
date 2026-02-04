import {
  ALLOWED_MIME_TYPES,
  type AllowedMimeType,
  MAX_FILE_SIZE,
  type PresignUploadResponse,
  isAllowedMimeType,
} from "@repo/shared";
import { ApiError, api } from "./api";

export interface UploadResult {
  key: string;
  publicUrl: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type UploadProgressCallback = (progress: UploadProgress) => void;

/**
 * Validate file before upload
 */
export function validateFile(file: File): { valid: true } | { valid: false; error: string } {
  if (!isAllowedMimeType(file.type)) {
    return {
      valid: false,
      error: `File type "${file.type}" is not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds maximum of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

/**
 * Upload a file directly to R2 via presigned URL
 *
 * @param file - The file to upload
 * @param onProgress - Optional callback for upload progress
 * @returns Upload result with key and public URL
 */
export async function uploadFile(
  file: File,
  onProgress?: UploadProgressCallback,
): Promise<UploadResult> {
  // Validate file
  const validation = validateFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Get presigned URL from API
  const presignResponse = await api.api.upload.presign.$post({
    json: {
      filename: file.name,
      contentType: file.type as AllowedMimeType,
      size: file.size,
    },
  });

  const presignJson = await presignResponse.json();
  if (!presignJson.success) {
    throw new ApiError(presignJson.error.message, presignJson.error.code);
  }

  const { uploadUrl, key, publicUrl } = presignJson.data as PresignUploadResponse;

  // Upload file directly to R2
  if (onProgress) {
    // Use XMLHttpRequest for progress tracking
    await uploadWithProgress(uploadUrl, file, onProgress);
  } else {
    // Use fetch for simple upload
    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: {
        "Content-Type": file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
    }
  }

  return { key, publicUrl };
}

/**
 * Upload file with progress tracking using XMLHttpRequest
 */
function uploadWithProgress(
  url: string,
  file: File,
  onProgress: UploadProgressCallback,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed: Network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("Upload cancelled"));
    });

    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.send(file);
  });
}

/**
 * Re-export constants for convenience
 */
export { ALLOWED_MIME_TYPES, MAX_FILE_SIZE };
