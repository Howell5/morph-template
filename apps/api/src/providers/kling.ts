import jwt from "jsonwebtoken";
import type { AIModelInfo, AIProvider, AIProviderTask, CreateTaskParams } from "./types";

const KLING_BASE_URL = "https://api.klingai.com";

// JWT token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Kling API response format
 */
interface KlingResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: "submitted" | "processing" | "succeed" | "failed";
    task_status_msg: string;
    task_result?: {
      videos?: Array<{ id: string; url: string; duration: string }>;
      images?: Array<{ index: number; url: string }>;
    };
    created_at: number;
    updated_at: number;
  };
}

/**
 * Generate JWT token for Kling API authentication
 */
function generateToken(accessKey: string, secretKey: string): string {
  const now = Math.floor(Date.now() / 1000);

  // Check cache (refresh 5 minutes before expiry)
  if (cachedToken && cachedToken.expiresAt > now + 300) {
    return cachedToken.token;
  }

  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5, // 5 seconds leeway
  };

  const token = jwt.sign(payload, secretKey, {
    algorithm: "HS256",
    header: { alg: "HS256", typ: "JWT" },
  });

  cachedToken = { token, expiresAt: now + 1800 };
  return token;
}

/**
 * Map task type to Kling API endpoint paths
 */
function getEndpointPath(type: string): string {
  switch (type) {
    case "text-to-video":
      return "/v1/videos/text2video";
    case "image-to-video":
      return "/v1/videos/image2video";
    case "text-to-image":
      return "/v1/images/generations";
    default:
      throw new Error(`Unsupported task type: ${type}`);
  }
}

/**
 * Map Kling task status to unified status
 */
function mapStatus(klingStatus: string): AIProviderTask["status"] {
  switch (klingStatus) {
    case "submitted":
      return "pending";
    case "processing":
      return "processing";
    case "succeed":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "processing";
  }
}

/**
 * Extract result URL from Kling task result
 */
function extractResultUrl(
  type: string,
  taskResult?: KlingResponse["data"]["task_result"],
): string | undefined {
  if (!taskResult) return undefined;

  if (type === "text-to-image" && taskResult.images?.[0]) {
    return taskResult.images[0].url;
  }
  if ((type === "text-to-video" || type === "image-to-video") && taskResult.videos?.[0]) {
    return taskResult.videos[0].url;
  }
  return undefined;
}

/**
 * Make authenticated request to Kling API
 */
async function klingFetch(path: string, options: RequestInit = {}): Promise<KlingResponse> {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error("Kling API credentials not configured");
  }

  const token = generateToken(accessKey, secretKey);

  const response = await fetch(`${KLING_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Kling API error: HTTP ${response.status}`);
  }

  const data = (await response.json()) as KlingResponse;

  if (data.code !== 0) {
    throw new Error(`Kling API error: ${data.message} (code: ${data.code})`);
  }

  return data;
}

/**
 * Build request body for Kling task creation
 */
function buildCreateBody(params: CreateTaskParams): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model_name: params.model,
    prompt: params.prompt,
  };

  if (params.negativePrompt) {
    body.negative_prompt = params.negativePrompt;
  }

  if (params.aspectRatio) {
    body.aspect_ratio = params.aspectRatio;
  }

  if (params.mode) {
    body.mode = params.mode;
  }

  // Video-specific params
  if (params.type === "text-to-video" || params.type === "image-to-video") {
    if (params.duration) {
      body.duration = String(params.duration);
    }
  }

  // Image-to-video specific params
  if (params.type === "image-to-video" && params.imageUrl) {
    body.image = params.imageUrl;
  }

  return body;
}

export const klingProvider: AIProvider = {
  name: "kling",

  isConfigured(): boolean {
    return !!(process.env.KLING_ACCESS_KEY && process.env.KLING_SECRET_KEY);
  },

  getAvailableModels(): AIModelInfo[] {
    return [
      {
        id: "kling-v1",
        name: "Kling v1",
        provider: "kling",
        types: ["text-to-video", "image-to-video"],
        defaultMode: "std",
      },
      {
        id: "kling-v1-5",
        name: "Kling v1.5",
        provider: "kling",
        types: ["text-to-video", "image-to-video"],
        defaultMode: "std",
      },
      {
        id: "kling-v2",
        name: "Kling v2",
        provider: "kling",
        types: ["text-to-video", "image-to-video"],
        defaultMode: "std",
      },
      {
        id: "kling-v2-master",
        name: "Kling v2 Master",
        provider: "kling",
        types: ["text-to-video", "image-to-video"],
        defaultMode: "std",
      },
      {
        id: "kolors-virtual-try-on",
        name: "Kolors Virtual Try-On",
        provider: "kling",
        types: ["text-to-image"],
      },
    ];
  },

  async createTask(params: CreateTaskParams): Promise<AIProviderTask> {
    const path = getEndpointPath(params.type);
    const body = buildCreateBody(params);

    const response = await klingFetch(path, {
      method: "POST",
      body: JSON.stringify(body),
    });

    return {
      providerTaskId: response.data.task_id,
      status: mapStatus(response.data.task_status),
      resultUrl: extractResultUrl(params.type, response.data.task_result),
      error: response.data.task_status === "failed" ? response.data.task_status_msg : undefined,
    };
  },

  async queryTask(providerTaskId: string, type: string): Promise<AIProviderTask> {
    const path = getEndpointPath(type);
    const response = await klingFetch(`${path}/${providerTaskId}`);

    return {
      providerTaskId: response.data.task_id,
      status: mapStatus(response.data.task_status),
      resultUrl: extractResultUrl(type, response.data.task_result),
      error: response.data.task_status === "failed" ? response.data.task_status_msg : undefined,
    };
  },
};
