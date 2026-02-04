import { zValidator } from "@hono/zod-validator";
import { presignUploadSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../auth";
import { generatePresignedUploadUrl, isR2Configured } from "../lib/r2";
import { errors, ok } from "../lib/response";

const uploadRoute = new Hono()
  /**
   * POST /upload/presign
   * Generate a presigned URL for direct upload to R2
   * Requires authentication
   */
  .post("/presign", zValidator("json", presignUploadSchema), async (c) => {
    // Check if R2 is configured
    if (!isR2Configured()) {
      return errors.serviceUnavailable(c, "File upload is not configured");
    }

    // Check authentication
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const { contentType, size } = c.req.valid("json");

    const result = await generatePresignedUploadUrl(session.user.id, contentType, size);

    return ok(c, result);
  });

export default uploadRoute;
