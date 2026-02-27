# Template Enhancement Tasks

> Goal: Bring morph-template to production-grade SaaS level by porting key patterns from genapp.
> Method: TDD - write tests first, then implement.
> Focus: Backend infrastructure only (API + shared schemas). Frontend is out of scope for now.

## Analysis Summary

GenApp is built on top of morph-template but fills many gaps. The following features are missing or too simple in the template:

| # | Feature | Priority | Status |
|---|---------|----------|--------|
| 1 | Three-pool credits system (daily/subscription/bonus) | P0 | ✅ Done |
| 2 | Credit records audit trail | P0 | ✅ Done |
| 3 | Subscription system (Stripe recurring) | P0 | ✅ Done |
| 4 | Entitlements / feature gating | P0 | ✅ Done |
| 5 | User management enhancements (subscription status, usage history) | P1 | ✅ Done |
| 6 | Admin routes (user search, credit grant, audit logs) | P1 | ✅ Done |
| 7 | Referral system | P1 | ✅ Done |
| 8 | Feedback system | P2 | ✅ Done |
| 9 | Cloudflare Turnstile (bot protection) | P2 | ✅ Done |
| 10 | Email service (Resend) | P2 | ✅ Done |

---

## Stage 1: Three-Pool Credits System

**Goal**: Replace the single `user.credits` integer with a three-pool system (daily / subscription / bonus).

**Success Criteria**:
- User table has `dailyCredits`, `dailyCreditsResetAt`, `subscriptionCredits`, `subscriptionCreditsResetAt`, `bonusCredits` columns
- Credits service with: `getUserCreditsBalance()`, `grantDailyLoginReward()`, `checkCreditsReserve()`, `consumeCredits()`, `addBonusCredits()`
- Consumption priority: daily → subscription → bonus
- Daily credits auto-reset at UTC midnight
- Shared config: `CREDITS_CONFIG` with daily reward amount, reset logic
- Tests for all credit operations

**Files to Create/Modify**:
- `packages/shared/src/config/credits.ts` - Credit configuration constants
- `apps/api/src/db/schema.ts` - Add new user columns
- `apps/api/src/lib/credits-service.ts` - Credits service (NEW)
- `apps/api/src/lib/__tests__/credits-service.test.ts` - Tests (NEW)
- `packages/shared/src/index.ts` - Re-export new config

**Status**: ✅ Done

---

## Stage 2: Credit Records Audit Trail

**Goal**: Track every credit change with a `creditRecords` table.

**Success Criteria**:
- `creditRecords` table: id, userId, type, amount, balanceBefore, balanceAfter, creditPool, metadata (jsonb), createdAt
- Record types: `signup_bonus | daily_login | generation | purchase | subscription_reset | admin_grant | referral_inviter | referral_invitee`
- Every credit operation in credits-service creates a record
- Query functions: get records by userId, filter by type
- Tests for record creation and querying

**Files to Create/Modify**:
- `apps/api/src/db/schema.ts` - Add `creditRecords` table
- `apps/api/src/lib/credit-records.ts` - Record service (NEW)
- `apps/api/src/lib/__tests__/credit-records.test.ts` - Tests (NEW)
- `apps/api/src/lib/credits-service.ts` - Integrate record creation
- `packages/shared/src/schemas/credit-record.ts` - Zod schemas (NEW)
- `packages/shared/src/index.ts` - Re-export

**Status**: ✅ Done

---

## Stage 3: Subscription System (Stripe Recurring)

**Goal**: Add recurring subscription support alongside existing one-time credit purchases.

**Success Criteria**:
- Subscription tiers: free, starter, pro, max (defined in shared config)
- User table: `subscriptionTier`, `subscriptionExpiresAt`, `stripeCustomerId`, `stripeSubscriptionId`
- Checkout route: `POST /api/checkout/subscription` - creates Stripe subscription checkout
- Billing portal: `POST /api/checkout/manage` - returns Stripe billing portal URL
- Webhook handling: `customer.subscription.created/updated/deleted` events
- On subscription purchase: reset subscription credits, update tier
- Shared pricing config with monthly/annual pricing, plan limits
- Tests for webhook handling and subscription lifecycle

**Files to Create/Modify**:
- `packages/shared/src/config/pricing.ts` - Extend with subscription plans
- `packages/shared/src/schemas/subscription.ts` - Subscription schemas (NEW)
- `apps/api/src/db/schema.ts` - Add user subscription columns
- `apps/api/src/routes/checkout.ts` - Add subscription checkout + billing portal
- `apps/api/src/routes/webhooks.ts` - Handle subscription webhook events
- `apps/api/src/lib/credits-service.ts` - Add `resetSubscriptionCredits()`
- `packages/shared/src/index.ts` - Re-export

**Status**: ✅ Done

---

## Stage 4: Entitlements / Feature Gating

**Goal**: Provide a single function to check what features a user has access to based on their subscription tier.

**Success Criteria**:
- `getUserEntitlements(userId)` returns: tier, maxProjects, canCreateProject, hasCustomDomain, hasNoWatermark, totalCredits breakdown
- Per-tier limits defined in shared config
- Cache layer with TTL (5 min) and manual invalidation
- `isProUser()`, `canUseFeature()` helpers
- Tests for entitlement calculation per tier

**Files to Create/Modify**:
- `packages/shared/src/config/pricing.ts` - Add `PLAN_LIMITS` per tier
- `apps/api/src/lib/entitlements.ts` - Entitlements service (NEW)
- `apps/api/src/lib/__tests__/entitlements.test.ts` - Tests (NEW)
- `packages/shared/src/schemas/subscription.ts` - Add entitlement types

**Status**: ✅ Done

---

## Stage 5: User Management Enhancements

**Goal**: Enhance user routes with subscription status, usage history, and daily reward.

**Success Criteria**:
- `GET /api/user/me` - Auto-grants daily login reward, returns full profile with credits breakdown
- `GET /api/user/subscription` - Returns subscription status + entitlements
- `GET /api/user/usage-history` - Returns credit usage records (paginated)
- Tests for each endpoint

**Files to Create/Modify**:
- `apps/api/src/routes/user.ts` - Enhance with new endpoints
- `packages/shared/src/schemas/user.ts` - Add response schemas

**Status**: ✅ Done

---

## Stage 6: Admin Routes

**Goal**: Add admin panel API endpoints for user/credit/audit management.

**Success Criteria**:
- Admin middleware: check `user.role === 'admin'`
- User table: add `role` column (default: 'user')
- `GET /api/admin/check` - Check if admin
- `GET /api/admin/users/search` - Search users by email
- `POST /api/admin/credits/grant` - Grant credits with reason
- `GET /api/admin/credits/records` - View credit records with filtering
- Audit logging for all admin actions
- Tests for admin authorization and operations

**Files to Create/Modify**:
- `apps/api/src/db/schema.ts` - Add `role` column to user
- `apps/api/src/lib/audit-log.ts` - Audit logging service (NEW)
- `apps/api/src/routes/admin.ts` - Admin routes (NEW)
- `packages/shared/src/schemas/admin.ts` - Admin schemas (NEW)
- `apps/api/src/index.ts` - Mount admin routes
- `packages/shared/src/index.ts` - Re-export

**Status**: ✅ Done

---

## Stage 7: Referral System

**Goal**: Add a referral/affiliate system for viral growth.

**Success Criteria**:
- `referrals` table: referrerId, referredId, credits awarded, IP/UA tracking, status
- User table: `referralCreditsThisMonth`, `totalReferralCredits`, `totalReferrals`
- `POST /api/referral/apply` - Apply referral code after signup
- `GET /api/referral/stats` - User's referral stats + link
- `GET /api/referral/history` - Recent referrals
- Anti-fraud: IP limit (5/IP/day), monthly credit cap
- Shared referral config
- Tests for referral flow and anti-fraud

**Files to Create/Modify**:
- `packages/shared/src/config/referral.ts` - Referral config (NEW)
- `apps/api/src/db/schema.ts` - Add `referrals` table + user columns
- `apps/api/src/lib/referral-service.ts` - Referral logic (NEW)
- `apps/api/src/routes/referral.ts` - Referral routes (NEW)
- `packages/shared/src/schemas/referral.ts` - Zod schemas (NEW)
- `apps/api/src/index.ts` - Mount referral routes
- `packages/shared/src/index.ts` - Re-export

**Status**: ✅ Done

---

## Stage 8: Feedback System

**Goal**: Allow users to submit bug reports and feature requests.

**Success Criteria**:
- `feedback` table: id, userId, type (bug/feature/general), title, description, screenshotUrl, status, adminNotes
- `POST /api/feedback` - Submit feedback (rate limited)
- Admin routes: list, update status, add notes
- Shared schemas for validation
- Tests for submission and admin management

**Files to Create/Modify**:
- `apps/api/src/db/schema.ts` - Add `feedback` table
- `apps/api/src/routes/feedback.ts` - Feedback routes (NEW)
- `packages/shared/src/schemas/feedback.ts` - Zod schemas (NEW)
- `apps/api/src/routes/admin.ts` - Add feedback admin routes
- `apps/api/src/index.ts` - Mount feedback routes
- `packages/shared/src/index.ts` - Re-export

**Status**: ✅ Done

---

## Stage 9: Cloudflare Turnstile (Bot Protection)

**Goal**: Add server-side bot verification for sensitive endpoints.

**Success Criteria**:
- `verifyTurnstile(token, options?)` server function
- Graceful degradation (allow on timeout, skip in dev)
- Applied to: checkout, feedback, referral endpoints
- Dev mode: auto-skip when no secret key configured
- Shared schema for turnstile token field
- Tests for verification logic

**Files to Create/Modify**:
- `apps/api/src/lib/turnstile.ts` - Turnstile verification (NEW)
- `apps/api/src/lib/__tests__/turnstile.test.ts` - Tests (NEW)
- `packages/shared/src/schemas/common.ts` - Add turnstile token field

**Status**: ✅ Done

---

## Stage 10: Email Service (Resend)

**Goal**: Add transactional email capability for notifications.

**Success Criteria**:
- Resend client singleton with config check
- `sendEmail(to, subject, html)` generic function
- Template: welcome email, credit low warning
- Optional in development (no RESEND_API_KEY = skip)
- Tests for email service

**Files to Create/Modify**:
- `apps/api/src/lib/email.ts` - Email service (NEW)
- `apps/api/src/lib/__tests__/email.test.ts` - Tests (NEW)
- `apps/api/src/env.ts` - Add RESEND_API_KEY, RESEND_FROM_EMAIL

**Status**: ✅ Done

---

## Checkpoint Log

| Timestamp | Stage | Action | Result |
|-----------|-------|--------|--------|
| 2026-02-27 01:08 | 1+2 | Implemented three-pool credits + credit records | ✅ 42 tests pass |
| 2026-02-27 01:10 | 3 | Subscription system: schemas, checkout, webhooks, pricing plans | ✅ 56 tests pass |
| 2026-02-27 01:12 | 4 | Entitlements service with TTL cache | ✅ 60 tests pass |
| 2026-02-27 01:13 | 5 | User routes: /me with daily reward, /subscription, /usage-history | ✅ Code only |
| 2026-02-27 01:14 | 6 | Admin routes: check, user search, credit grant, records, feedback | ✅ Code only |
| 2026-02-27 01:15 | 7 | Referral system with anti-fraud | ✅ Code only |
| 2026-02-27 01:16 | 8 | Feedback submission with rate limiting | ✅ Code only |
| 2026-02-27 01:17 | 9 | Cloudflare Turnstile verification with graceful degradation | ✅ 64 tests pass |
| 2026-02-27 01:18 | 10 | Email service (Resend) with lazy init | ✅ Code only |
| 2026-02-27 01:22 | All | Integration: mounted routes, exported schemas, updated env, build+test pass | ✅ 64 tests, build green |
