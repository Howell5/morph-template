import { zValidator } from "@hono/zod-validator";
import { chatRequestSchema } from "@repo/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { auth } from "../auth";
import { getOpenRouter, isAIConfigured } from "../lib/ai";
import { errors, ok } from "../lib/response";

const chatRoute = new Hono().post("/", zValidator("json", chatRequestSchema), async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });
  if (!session) {
    return errors.unauthorized(c);
  }

  if (!isAIConfigured()) {
    return errors.serviceUnavailable(c, "Chat is not configured");
  }

  const { messages, model, modalities, imageConfig } = c.req.valid("json");
  const openrouter = getOpenRouter();

  const isImageGeneration = modalities.includes("image");

  // Image generation: non-streaming response with base64 images
  if (isImageGeneration) {
    const response = await openrouter.chat.send({
      chatGenerationParams: {
        model,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        modalities: modalities as ("text" | "image")[],
        ...(imageConfig && { imageConfig }),
      },
    });

    return ok(c, response);
  }

  // Text chat: streaming SSE response
  const stream = await openrouter.chat.send({
    chatGenerationParams: {
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
    },
  });

  return streamSSE(c, async (sseStream) => {
    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        await sseStream.writeSSE({
          data: JSON.stringify({ content }),
        });
      }
    }
    await sseStream.writeSSE({ data: "[DONE]" });
  });
});

export default chatRoute;
