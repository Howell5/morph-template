import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldSkipTurnstile, verifyTurnstile } from "../turnstile";

describe("shouldSkipTurnstile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should skip when TURNSTILE_SECRET_KEY is not set", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    expect(shouldSkipTurnstile()).toBe(true);
  });

  it("should not skip when TURNSTILE_SECRET_KEY is set", () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    expect(shouldSkipTurnstile()).toBe(false);
  });
});

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return success when no secret key configured (dev mode)", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "");
    const result = await verifyTurnstile("test-token");
    expect(result.success).toBe(true);
  });

  it("should fail when token is empty and secret is set", async () => {
    vi.stubEnv("TURNSTILE_SECRET_KEY", "test-secret");
    const result = await verifyTurnstile("");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Missing Turnstile token");
  });
});
