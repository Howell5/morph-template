import { Hono } from "hono";
import { ok } from "../../lib/response";
import { servicesMiddleware } from "../../middleware/services";
import generateRoute from "./generate";
import tasksRoute from "./tasks";

const aiRoute = new Hono()
  // Inject AI service into all AI routes
  .use("*", servicesMiddleware)

  /**
   * GET /models
   * List available AI models grouped by provider
   * Public endpoint (no auth needed)
   */
  .get("/models", (c) => {
    const aiService = c.var.aiService;
    const models = aiService.getModels();
    const providers = aiService.getProviders();

    return ok(c, { models, providers });
  })

  .route("/generate", generateRoute)
  .route("/tasks", tasksRoute);

export default aiRoute;
