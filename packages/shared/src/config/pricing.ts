/**
 * Credit package pricing configuration
 * Hardcoded for simplicity - change here and redeploy to update pricing
 */

import type { BillingInterval } from "../schemas/subscription";
import { PLAN_LIMITS, getAnnualPrice } from "../schemas/subscription";
import { CREDITS_CONFIG } from "./credits";

/**
 * Credit packages (one-time purchases, added to bonus credits)
 */
export const CREDIT_PACKAGES = [
  {
    id: "small",
    name: "Small Pack",
    description: "Try it out",
    credits: 100,
    price: 500, // $5.00
    currency: "usd",
    popular: false,
  },
  {
    id: "medium",
    name: "Medium Pack",
    description: "Best for regular users",
    credits: 250, // +25% bonus
    price: 1000, // $10.00
    currency: "usd",
    popular: true,
  },
  {
    id: "large",
    name: "Large Pack",
    description: "For power users",
    credits: 600, // +50% bonus
    price: 2000, // $20.00
    currency: "usd",
    popular: false,
  },
] as const;

export type CreditPackage = (typeof CREDIT_PACKAGES)[number];

/**
 * Subscription pricing plans
 */
export interface PricingPlan {
  id: "free" | "starter" | "pro" | "max";
  name: string;
  description: string;
  monthlyPrice: number; // in dollars
  currency: string;
  popular: boolean;
  subscriptionCredits: number;
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "Get started for free",
    monthlyPrice: 0,
    currency: "usd",
    popular: false,
    subscriptionCredits: CREDITS_CONFIG.SUBSCRIPTION_FREE,
  },
  {
    id: "starter",
    name: "Starter",
    description: "For indie creators",
    monthlyPrice: PLAN_LIMITS.STARTER_PRICE,
    currency: "usd",
    popular: false,
    subscriptionCredits: CREDITS_CONFIG.SUBSCRIPTION_STARTER,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For power users",
    monthlyPrice: PLAN_LIMITS.PRO_PRICE,
    currency: "usd",
    popular: true,
    subscriptionCredits: CREDITS_CONFIG.SUBSCRIPTION_PRO,
  },
  {
    id: "max",
    name: "Max",
    description: "For agencies & teams",
    monthlyPrice: PLAN_LIMITS.MAX_PRICE,
    currency: "usd",
    popular: false,
    subscriptionCredits: CREDITS_CONFIG.SUBSCRIPTION_MAX,
  },
];

/**
 * Helper to find credit package by ID
 */
export function getCreditPackage(packageId: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((pkg) => pkg.id === packageId);
}

/**
 * Helper to find pricing plan by ID
 */
export function getPricingPlan(planId: string): PricingPlan | undefined {
  return PRICING_PLANS.find((plan) => plan.id === planId);
}

/**
 * Helper to format price for display (from cents)
 */
export function formatPrice(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Get price display info
 */
export interface PriceDisplayInfo {
  displayPrice: number; // dollars
  originalPrice?: number; // monthly price if annual
  interval: BillingInterval;
  totalAnnual?: number;
  savings?: number;
}

export function getPriceDisplay(plan: PricingPlan, interval: BillingInterval): PriceDisplayInfo {
  if (plan.monthlyPrice === 0) {
    return { displayPrice: 0, interval: "month" };
  }

  if (interval === "year") {
    const annualTotal = getAnnualPrice(plan.monthlyPrice);
    const monthlyEquivalent = Math.floor(annualTotal / 12);
    const savings = plan.monthlyPrice * 12 - annualTotal;
    return {
      displayPrice: monthlyEquivalent,
      originalPrice: plan.monthlyPrice,
      interval: "year",
      totalAnnual: annualTotal,
      savings,
    };
  }

  return { displayPrice: plan.monthlyPrice, interval: "month" };
}
