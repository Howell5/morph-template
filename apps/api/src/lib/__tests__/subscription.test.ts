import {
  PLAN_LIMITS,
  PRICING_PLANS,
  getAnnualMonthlyPrice,
  getAnnualPrice,
  getCreditPackage,
  getPriceDisplay,
  getPriceInCents,
  getPricingPlan,
} from "@repo/shared";
import { describe, expect, it } from "vitest";

describe("Subscription Pricing", () => {
  it("should have correct monthly pricing", () => {
    expect(PLAN_LIMITS.STARTER_PRICE).toBe(12);
    expect(PLAN_LIMITS.PRO_PRICE).toBe(24);
    expect(PLAN_LIMITS.MAX_PRICE).toBe(240);
  });

  it("should have correct annual pricing", () => {
    expect(PLAN_LIMITS.STARTER_ANNUAL_PRICE).toBe(108);
    expect(PLAN_LIMITS.PRO_ANNUAL_PRICE).toBe(228);
    expect(PLAN_LIMITS.MAX_ANNUAL_PRICE).toBe(2400);
  });
});

describe("getAnnualPrice", () => {
  it("should return correct annual prices for each tier", () => {
    expect(getAnnualPrice(12)).toBe(108);
    expect(getAnnualPrice(24)).toBe(228);
    expect(getAnnualPrice(240)).toBe(2400);
  });

  it("should fallback to 12x monthly for unknown prices", () => {
    expect(getAnnualPrice(50)).toBe(600);
  });
});

describe("getAnnualMonthlyPrice", () => {
  it("should return monthly equivalent of annual pricing", () => {
    expect(getAnnualMonthlyPrice(12)).toBe(9); // $108/12 = $9
    expect(getAnnualMonthlyPrice(24)).toBe(19); // $228/12 = $19
    expect(getAnnualMonthlyPrice(240)).toBe(200); // $2400/12 = $200
  });
});

describe("getPriceInCents", () => {
  it("should return monthly price in cents", () => {
    expect(getPriceInCents(12, "month")).toBe(1200);
    expect(getPriceInCents(24, "month")).toBe(2400);
    expect(getPriceInCents(240, "month")).toBe(24000);
  });

  it("should return annual price in cents", () => {
    expect(getPriceInCents(12, "year")).toBe(10800); // $108 * 100
    expect(getPriceInCents(24, "year")).toBe(22800); // $228 * 100
    expect(getPriceInCents(240, "year")).toBe(240000); // $2400 * 100
  });
});

describe("getPricingPlan", () => {
  it("should find plans by ID", () => {
    expect(getPricingPlan("free")?.name).toBe("Free");
    expect(getPricingPlan("starter")?.name).toBe("Starter");
    expect(getPricingPlan("pro")?.name).toBe("Pro");
    expect(getPricingPlan("max")?.name).toBe("Max");
  });

  it("should return undefined for invalid plan", () => {
    expect(getPricingPlan("invalid")).toBeUndefined();
  });
});

describe("getCreditPackage", () => {
  it("should find credit packages by ID", () => {
    expect(getCreditPackage("small")?.credits).toBe(100);
    expect(getCreditPackage("medium")?.credits).toBe(250);
    expect(getCreditPackage("large")?.credits).toBe(600);
  });

  it("should return undefined for invalid package", () => {
    expect(getCreditPackage("invalid")).toBeUndefined();
  });
});

describe("getPriceDisplay", () => {
  it("should show 0 for free plan", () => {
    const free = PRICING_PLANS[0];
    const display = getPriceDisplay(free, "month");
    expect(display.displayPrice).toBe(0);
  });

  it("should show monthly price for monthly billing", () => {
    const pro = PRICING_PLANS.find((p) => p.id === "pro")!;
    const display = getPriceDisplay(pro, "month");
    expect(display.displayPrice).toBe(24);
    expect(display.interval).toBe("month");
    expect(display.originalPrice).toBeUndefined();
  });

  it("should show discounted price for annual billing", () => {
    const pro = PRICING_PLANS.find((p) => p.id === "pro")!;
    const display = getPriceDisplay(pro, "year");
    expect(display.displayPrice).toBe(19); // $228/12 = $19
    expect(display.originalPrice).toBe(24);
    expect(display.totalAnnual).toBe(228);
    expect(display.savings).toBe(60); // $24*12 - $228 = $60
  });
});
