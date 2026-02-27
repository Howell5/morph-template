import { describe, expect, it } from "vitest";
import { isProUser } from "../entitlements";

describe("isProUser", () => {
  it("should return false for free tier", () => {
    expect(isProUser("free")).toBe(false);
  });

  it("should return true for starter tier", () => {
    expect(isProUser("starter")).toBe(true);
  });

  it("should return true for pro tier", () => {
    expect(isProUser("pro")).toBe(true);
  });

  it("should return true for max tier", () => {
    expect(isProUser("max")).toBe(true);
  });
});
