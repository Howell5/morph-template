import { OpenRouter } from "@openrouter/sdk";

let _openrouter: OpenRouter | null = null;

/**
 * Check if OpenRouter AI is configured
 */
export function isAIConfigured(): boolean {
  return !!process.env.OPENROUTER_API_KEY;
}

/**
 * Get OpenRouter client instance (singleton)
 */
export function getOpenRouter(): OpenRouter {
  if (!_openrouter) {
    if (!process.env.OPENROUTER_API_KEY) {
      throw new Error("OPENROUTER_API_KEY is not set");
    }
    _openrouter = new OpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY,
    });
  }
  return _openrouter;
}
