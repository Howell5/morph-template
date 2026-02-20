import type { AIModelInfo, CreateTaskParams } from "../providers/types";

export interface AITask {
  id: string;
  userId: string;
  provider: string;
  type: string;
  model: string;
  status: string;
  prompt: string;
  negativePrompt: string | null;
  aspectRatio: string | null;
  duration: number | null;
  mode: string | null;
  inputImageUrl: string | null;
  providerTaskId: string | null;
  resultUrl: string | null;
  r2Key: string | null;
  creditsUsed: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface ListTasksQuery {
  page: number;
  limit: number;
  status?: string;
  type?: string;
  provider?: string;
}

export interface IAIService {
  getProviders(): string[];
  getModels(provider?: string): AIModelInfo[];
  createTask(userId: string, params: CreateTaskParams): Promise<AITask>;
  queryTask(taskId: string, userId: string): Promise<AITask>;
  listTasks(userId: string, query: ListTasksQuery): Promise<{ tasks: AITask[]; total: number }>;
  isConfigured(): boolean;
}
