/**
 * Provider abstraction layer types
 *
 * All AI providers implement the AIProvider interface for unified task management.
 */

export interface AIProviderTask {
  providerTaskId: string;
  status: "pending" | "processing" | "completed" | "failed";
  resultUrl?: string;
  error?: string;
}

export interface CreateTaskParams {
  type: "text-to-video" | "image-to-video" | "text-to-image";
  model: string;
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: string;
  duration?: number;
  mode?: string;
  imageUrl?: string;
}

export interface AIModelInfo {
  id: string;
  name: string;
  provider: string;
  types: string[];
  defaultMode?: string;
}

export interface AIProvider {
  readonly name: string;
  isConfigured(): boolean;
  getAvailableModels(): AIModelInfo[];
  createTask(params: CreateTaskParams): Promise<AIProviderTask>;
  queryTask(providerTaskId: string, type: string): Promise<AIProviderTask>;
}
