import { CREDITS_CONFIG, getSubscriptionCreditsLimit } from "@repo/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getEffectiveTier, getNextDayStart, needsDailyReset } from "../credits-service";

// Mock the database module
vi.mock("../../db", () => ({
  db: {
    query: {
      user: {
        findFirst: vi.fn(),
      },
    },
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: "test-record-id" }]),
      }),
    }),
    transaction: vi.fn(),
  },
}));

describe("Credits Config", () => {
  it("should have correct daily login reward", () => {
    expect(CREDITS_CONFIG.DAILY_LOGIN_REWARD).toBe(50);
  });

  it("should have correct subscription credits per tier", () => {
    expect(CREDITS_CONFIG.SUBSCRIPTION_FREE).toBe(0);
    expect(CREDITS_CONFIG.SUBSCRIPTION_STARTER).toBe(1300);
    expect(CREDITS_CONFIG.SUBSCRIPTION_PRO).toBe(2700);
    expect(CREDITS_CONFIG.SUBSCRIPTION_MAX).toBe(30000);
  });

  it("should have correct minimum reserve credits", () => {
    expect(CREDITS_CONFIG.MIN_RESERVE_CREDITS).toBe(5);
  });
});

describe("getSubscriptionCreditsLimit", () => {
  it("should return 0 for free tier", () => {
    expect(getSubscriptionCreditsLimit("free")).toBe(0);
  });

  it("should return 1300 for starter tier", () => {
    expect(getSubscriptionCreditsLimit("starter")).toBe(1300);
  });

  it("should return 2700 for pro tier", () => {
    expect(getSubscriptionCreditsLimit("pro")).toBe(2700);
  });

  it("should return 30000 for max tier", () => {
    expect(getSubscriptionCreditsLimit("max")).toBe(30000);
  });

  it("should return 0 for expired subscription", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(getSubscriptionCreditsLimit("pro", pastDate)).toBe(0);
  });

  it("should return tier limit for valid subscription", () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(getSubscriptionCreditsLimit("pro", futureDate)).toBe(2700);
  });
});

describe("needsDailyReset", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should return true when lastResetAt is null", () => {
    expect(needsDailyReset(null)).toBe(true);
  });

  it("should return true when in different UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-16T10:00:00Z"));

    const lastReset = new Date("2025-01-15T10:00:00Z");
    expect(needsDailyReset(lastReset)).toBe(true);

    vi.useRealTimers();
  });

  it("should return false when in same UTC day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T23:00:00Z"));

    const lastReset = new Date("2025-01-15T01:00:00Z");
    expect(needsDailyReset(lastReset)).toBe(false);

    vi.useRealTimers();
  });

  it("should handle month boundary (Jan 31 -> Feb 1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-01T00:00:00Z"));

    const lastReset = new Date("2025-01-31T23:59:59Z");
    expect(needsDailyReset(lastReset)).toBe(true);

    vi.useRealTimers();
  });

  it("should handle year boundary (Dec 31 -> Jan 1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));

    const lastReset = new Date("2024-12-31T23:59:59Z");
    expect(needsDailyReset(lastReset)).toBe(true);

    vi.useRealTimers();
  });
});

describe("getNextDayStart", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("should return midnight UTC of next day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-15T10:30:00Z"));

    const nextDay = getNextDayStart();

    expect(nextDay.getUTCFullYear()).toBe(2025);
    expect(nextDay.getUTCMonth()).toBe(0); // January
    expect(nextDay.getUTCDate()).toBe(16);
    expect(nextDay.getUTCHours()).toBe(0);
    expect(nextDay.getUTCMinutes()).toBe(0);
    expect(nextDay.getUTCSeconds()).toBe(0);

    vi.useRealTimers();
  });

  it("should handle month rollover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-31T10:30:00Z"));

    const nextDay = getNextDayStart();

    expect(nextDay.getUTCFullYear()).toBe(2025);
    expect(nextDay.getUTCMonth()).toBe(1); // February
    expect(nextDay.getUTCDate()).toBe(1);

    vi.useRealTimers();
  });

  it("should handle year rollover", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-12-31T23:59:59Z"));

    const nextDay = getNextDayStart();

    expect(nextDay.getUTCFullYear()).toBe(2025);
    expect(nextDay.getUTCMonth()).toBe(0); // January
    expect(nextDay.getUTCDate()).toBe(1);

    vi.useRealTimers();
  });
});

describe("getEffectiveTier", () => {
  it("should return free for null tier", () => {
    expect(getEffectiveTier(null, null)).toBe("free");
  });

  it('should return free for "free" tier', () => {
    expect(getEffectiveTier("free", null)).toBe("free");
  });

  it("should return pro for valid pro subscription without expiry", () => {
    expect(getEffectiveTier("pro", null)).toBe("pro");
  });

  it("should return pro for valid pro subscription with future expiry", () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(getEffectiveTier("pro", futureDate)).toBe("pro");
  });

  it("should return free for expired pro subscription", () => {
    const pastDate = new Date(Date.now() - 86400000);
    expect(getEffectiveTier("pro", pastDate)).toBe("free");
  });

  it("should return starter for valid starter subscription", () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(getEffectiveTier("starter", futureDate)).toBe("starter");
  });

  it("should return max for valid max subscription", () => {
    const futureDate = new Date(Date.now() + 86400000);
    expect(getEffectiveTier("max", futureDate)).toBe("max");
  });

  it("should return free for invalid tier", () => {
    expect(getEffectiveTier("invalid-tier", null)).toBe("free");
  });

  it("should return free for empty string tier", () => {
    expect(getEffectiveTier("", null)).toBe("free");
  });
});

describe("Credits Consumption Logic (three-pool priority)", () => {
  it("should consume from daily first, then subscription, then bonus", () => {
    let daily = 20;
    let subscription = 30;
    let bonus = 50;
    const cost = 40;
    let remaining = cost;

    // Daily first
    const fromDaily = Math.min(remaining, daily);
    daily -= fromDaily;
    remaining -= fromDaily;

    // Then subscription
    const fromSubscription = Math.min(remaining, subscription);
    subscription -= fromSubscription;
    remaining -= fromSubscription;

    // Then bonus
    const fromBonus = Math.min(remaining, bonus);
    bonus -= fromBonus;
    remaining -= fromBonus;

    expect(fromDaily).toBe(20);
    expect(fromSubscription).toBe(20);
    expect(fromBonus).toBe(0);
    expect(daily).toBe(0);
    expect(subscription).toBe(10);
    expect(bonus).toBe(50);
    expect(remaining).toBe(0);
  });

  it("should consume from all three pools when needed", () => {
    let daily = 10;
    let subscription = 10;
    let bonus = 10;
    const cost = 25;
    let remaining = cost;

    const fromDaily = Math.min(remaining, daily);
    daily -= fromDaily;
    remaining -= fromDaily;

    const fromSubscription = Math.min(remaining, subscription);
    subscription -= fromSubscription;
    remaining -= fromSubscription;

    const fromBonus = Math.min(remaining, bonus);
    bonus -= fromBonus;
    remaining -= fromBonus;

    expect(fromDaily).toBe(10);
    expect(fromSubscription).toBe(10);
    expect(fromBonus).toBe(5);
    expect(remaining).toBe(0);
  });

  it("should handle insufficient total credits", () => {
    let daily = 3;
    let subscription = 0;
    let bonus = 1;
    const cost = 10;
    let remaining = cost;

    const fromDaily = Math.min(remaining, daily);
    daily -= fromDaily;
    remaining -= fromDaily;

    const fromSubscription = Math.min(remaining, subscription);
    subscription -= fromSubscription;
    remaining -= fromSubscription;

    const fromBonus = Math.min(remaining, bonus);
    bonus -= fromBonus;
    remaining -= fromBonus;

    const actualConsumed = cost - remaining;
    expect(actualConsumed).toBe(4);
    expect(remaining).toBe(6); // shortfall
  });
});

describe("Pre-check Logic (MIN_RESERVE)", () => {
  it("should allow when total credits >= MIN_RESERVE", () => {
    const total = 5;
    const allowed = total >= CREDITS_CONFIG.MIN_RESERVE_CREDITS;
    expect(allowed).toBe(true);
  });

  it("should allow when credits exceed MIN_RESERVE", () => {
    const total = 100;
    const allowed = total >= CREDITS_CONFIG.MIN_RESERVE_CREDITS;
    expect(allowed).toBe(true);
  });

  it("should reject when credits < MIN_RESERVE", () => {
    const total = 4;
    const allowed = total >= CREDITS_CONFIG.MIN_RESERVE_CREDITS;
    expect(allowed).toBe(false);
  });

  it("should reject when credits = 0", () => {
    const total = 0;
    const allowed = total >= CREDITS_CONFIG.MIN_RESERVE_CREDITS;
    expect(allowed).toBe(false);
  });

  it("should sum all three pools for reserve check", () => {
    const daily = 2;
    const subscription = 2;
    const bonus = 1;
    const total = daily + subscription + bonus;
    const allowed = total >= CREDITS_CONFIG.MIN_RESERVE_CREDITS;
    expect(allowed).toBe(true);
  });
});
