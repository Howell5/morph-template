import { createMiddleware } from "hono/factory";
import { AIService } from "../services/ai.service";
import type { IAIService } from "../services/types";

// Singleton instances
let _aiService: AIService | null = null;

function getAIService(): AIService {
  if (!_aiService) {
    _aiService = new AIService();
  }
  return _aiService;
}

/**
 * Extend Hono's context variables with service instances
 */
declare module "hono" {
  interface ContextVariableMap {
    aiService: IAIService;
  }
}

/**
 * DI middleware that injects service instances into the Hono context
 */
export const servicesMiddleware = createMiddleware(async (c, next) => {
  c.set("aiService", getAIService());
  await next();
});
