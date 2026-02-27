import { describe, expect, it } from "vitest";
import { getPoolForType } from "../credit-records";

describe("getPoolForType", () => {
  it("should return bonus for signup_bonus", () => {
    expect(getPoolForType("signup_bonus")).toBe("bonus");
  });

  it("should return bonus for referral_inviter", () => {
    expect(getPoolForType("referral_inviter")).toBe("bonus");
  });

  it("should return bonus for referral_invitee", () => {
    expect(getPoolForType("referral_invitee")).toBe("bonus");
  });

  it("should return bonus for admin_grant", () => {
    expect(getPoolForType("admin_grant")).toBe("bonus");
  });

  it("should return bonus for purchase", () => {
    expect(getPoolForType("purchase")).toBe("bonus");
  });

  it("should return daily for daily_login", () => {
    expect(getPoolForType("daily_login")).toBe("daily");
  });

  it("should return subscription for subscription_reset", () => {
    expect(getPoolForType("subscription_reset")).toBe("subscription");
  });

  it("should return mixed for generation", () => {
    expect(getPoolForType("generation")).toBe("mixed");
  });
});
