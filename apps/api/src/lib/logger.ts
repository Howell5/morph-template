import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport: process.env.NODE_ENV !== "production" ? { target: "pino-pretty" } : undefined,
});

// Child loggers for key modules
export const aiLogger = logger.child({ module: "ai" });
export const creditsLogger = logger.child({ module: "credits" });
export const webhookLogger = logger.child({ module: "webhook" });
export const queueLogger = logger.child({ module: "queue" });
