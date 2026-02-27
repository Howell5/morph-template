# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Morph Template is a full-stack TypeScript monorepo featuring end-to-end type safety through Hono's RPC-style architecture. The backend exports an `AppType` that the frontend imports, enabling automatic type inference across the API boundary without manual type definitions.

**Key Technology Stack:**
- **Backend**: Hono (web framework) + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend**: React + Vite + TanStack Query + shadcn/ui + Tailwind CSS
- **Task Queue**: pg-boss (PostgreSQL-based, zero extra infrastructure)
- **Payments**: Stripe (Checkout + Webhooks + Subscriptions)
- **Credits**: Three-pool system (daily/subscription/bonus) with audit trail
- **AI**: OpenRouter SDK (unified access to 300+ LLMs)
- **File Storage**: Cloudflare R2 (S3-compatible, frontend direct upload)
- **Email**: Resend (transactional emails, optional in dev)
- **Bot Protection**: Cloudflare Turnstile (optional in dev)
- **Monorepo**: pnpm workspaces + Turborepo
- **Tooling**: Biome (linting/formatting), Vitest (testing), TypeScript strict mode

**Architecture Documentation**: See `docs/ARCHITECTURE.md` for comprehensive technical details.

## Development Commands

```bash
# Start development (both API and Web concurrently)
pnpm dev

# Build all packages
pnpm build

# Linting and formatting
pnpm lint          # Lint all packages
pnpm format        # Format code with Biome
pnpm check         # Check and fix code issues
pnpm check:lines   # Check file line count (max 500 lines)

# Database operations
pnpm db:push       # Push schema changes to database (development)
pnpm db:studio     # Open Drizzle Studio (database GUI)
pnpm docker:up     # Start PostgreSQL container
pnpm docker:down   # Stop PostgreSQL container

# Individual workspace commands
cd apps/api
pnpm dev           # Start API only (port 3000)
pnpm db:generate   # Generate migration files (production)

cd apps/web
pnpm dev           # Start Web only (port 5173)
pnpm build         # Build frontend for production
```

## Architecture Principles

### Unified API Response Format

All API endpoints return a consistent response structure:

**Success Response:**
```typescript
{
  success: true,
  data: T  // The actual response data
}
```

**Error Response:**
```typescript
{
  success: false,
  error: {
    message: string,
    code?: string,      // e.g., "UNAUTHORIZED", "NOT_FOUND"
    issues?: unknown[]  // For Zod validation errors
  }
}
```

### RPC-Style Type Safety

The core architecture relies on Hono's `AppType` export for end-to-end type safety:

1. **Backend exports AppType** (`apps/api/src/index.ts`):
```typescript
export type AppType = typeof app;
```

2. **Pre-compiled RPC client** (`apps/api/src/client.ts`):
```typescript
// Types are pre-computed at build time for better IDE performance
export type ApiClient = ReturnType<typeof hc<typeof app>>;
export const hcWithType = (...args: Parameters<typeof hc>): ApiClient =>
  hc<typeof app>(...args);
```

3. **Frontend uses pre-compiled client** (`apps/web/src/lib/api.ts`):
```typescript
import { hcWithType } from "@repo/api/client";
import { isPaywallError } from "@repo/shared";
import { toast } from "sonner";

// Custom error class with error code support
export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.code = code;
  }
}

// apiFetch automatically shows toast for non-paywall errors
async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, { ...init, credentials: "include" });

  if (!response.ok) {
    const clonedResponse = response.clone();
    let errorMessage = `HTTP ${response.status}`;
    let errorCode: string | undefined;
    try {
      const errorData = await clonedResponse.json();
      errorMessage = errorData.error?.message || errorMessage;
      errorCode = errorData.error?.code;
    } catch {}

    // Auto toast for non-paywall errors
    if (!isPaywallError(errorCode)) {
      toast.error(errorMessage);
    }

    throw new ApiError(errorMessage, errorCode);
  }
  return response;
}

export const api = hcWithType(env.VITE_API_URL, { fetch: apiFetch });

// Helper type to extract data from ApiSuccess<T>
export type ExtractData<T> = T extends ApiSuccess<infer D> ? D : never;
```

4. **All API calls are fully typed**:
```typescript
// Frontend automatically knows request/response types
const response = await api.api.posts.$get();
const json = await response.json();
// json is typed as { success: true, data: { posts: Post[], pagination: {...} } }
const posts = json.data.posts;
```

### Shared Validation Schemas

Zod schemas in `packages/shared` are the single source of truth for validation:

- **Define once** in `packages/shared/src/schemas/`
- **Use in backend** with `@hono/zod-validator` for request validation
- **Use in frontend** with `react-hook-form` + `@hookform/resolvers` for form validation
- **Export types** via `z.infer<>` for TypeScript

Example flow:
1. `packages/shared/src/schemas/post.ts` - Define `createPostSchema`
2. `apps/api/src/routes/posts.ts` - Validate with `zValidator('json', createPostSchema)`
3. `apps/web/src/pages/posts.tsx` - Use with `zodResolver(createPostSchema)`

### Authentication Flow

Better Auth provides session-based authentication:

**Backend** (`apps/api/src/auth.ts`):
- Configured with Drizzle adapter for PostgreSQL
- Mounts auth routes at `/api/auth/**`
- Session checks: `auth.api.getSession({ headers: c.req.raw.headers })`

**Frontend** (`apps/web/src/lib/auth-client.ts`):
- Uses `better-auth/react` client
- Hook: `useSession()` for accessing current user
- Credentials sent via cookies (requires `credentials: 'include'`)

**Important**: The custom `apiFetch` wrapper in `apps/web/src/lib/api.ts` ensures `credentials: 'include'` is set on all requests.

**Development Mode (Zero-Config Auth)**:
- Email/password auth is automatically enabled when `NODE_ENV !== "production"`
- A test account (`test@test.com` / `password123`) is seeded on startup via `apps/api/src/lib/seed-dev.ts`
- The login page (`apps/web/src/pages/login.tsx`) shows a pre-filled email/password form in dev mode (using `import.meta.env.DEV`)
- No OAuth credentials needed for local development

### Credits System (Three-Pool)

The template uses a three-pool credits system for flexible monetization:

**Three Pools** (consumption priority: daily → subscription → bonus):
1. **Daily credits** (50/day) - Login reward, expires at UTC midnight
2. **Subscription credits** - Based on tier (starter: 1300, pro: 2700, max: 30000), resets on renewal
3. **Bonus credits** - From purchases, referrals, admin grants - never expire

**Key Files**:
- `packages/shared/src/config/credits.ts` - CREDITS_CONFIG constants
- `apps/api/src/lib/credits-service.ts` - Core logic (getUserCreditsBalance, consumeCredits, grantDailyLoginReward)
- `apps/api/src/lib/credits-admin.ts` - Admin grant operations
- `apps/api/src/lib/credit-records.ts` - Audit trail for all credit changes
- `apps/api/src/lib/entitlements.ts` - Feature gating by subscription tier (cached 5 min)

**Database** (user table columns):
- `dailyCredits`, `dailyCreditsResetAt` - Daily pool
- `subscriptionCredits`, `subscriptionCreditsResetAt` - Subscription pool
- `bonusCredits` - Bonus pool
- `subscriptionTier`, `subscriptionExpiresAt` - Subscription state
- `creditRecords` table - Full audit trail of all credit changes

### Payments & Subscriptions (Stripe)

**Credit Packages** (`packages/shared/src/config/pricing.ts`):
- Small (100/$5), Medium (250/$10), Large (600/$20)
- Purchased credits go to bonus pool (never expire)

**Subscription Plans**: Free, Starter ($12/mo), Pro ($24/mo), Max ($240/mo)

**API Routes**:
- `POST /api/checkout` - One-time credit purchase
- `POST /api/checkout/subscription` - Create subscription checkout
- `POST /api/checkout/manage` - Stripe billing portal URL
- `GET /api/orders` - Order history
- `POST /api/webhooks/stripe` - Handles checkout.session.completed, customer.subscription.created/updated/deleted

**Configuration** (optional in development):
```bash
STRIPE_SECRET_KEY=sk_test_...      # Stripe secret key
STRIPE_WEBHOOK_SECRET=whsec_...    # Webhook signing secret
```

### Admin System

Role-based admin routes (`apps/api/src/routes/admin.ts`):
- `GET /api/admin/check` - Verify admin status
- `GET /api/admin/users/search` - Search users by email
- `POST /api/admin/credits/grant` - Grant bonus credits with audit trail
- `GET /api/admin/credits/records` - View credit records with filtering
- `GET /api/admin/feedback` / `PATCH /api/admin/feedback` - Manage user feedback

Admin actions are logged via `apps/api/src/lib/audit-log.ts` (structured JSON).

### Referral System

Viral growth via referral codes (`apps/api/src/routes/referral.ts`):
- `POST /api/referral/apply` - Apply referral code (both parties get bonus credits)
- `GET /api/referral/stats` - Referral stats + link
- `GET /api/referral/history` - Recent referrals
- Anti-fraud: IP limit (5/IP/day), monthly credit cap (300/month), self-referral prevention
- Config: `packages/shared/src/config/referral.ts`

### Feedback System

User feedback collection (`apps/api/src/routes/feedback.ts`):
- `POST /api/feedback` - Submit bug reports/feature requests (rate limited: 5/user/hour)
- Admin management via `/api/admin/feedback` routes

### Cloudflare Turnstile (Bot Protection)

Server-side bot verification (`apps/api/src/lib/turnstile.ts`):
- `verifyTurnstile(token, options?)` - Verify Turnstile token
- Graceful degradation: allows through on timeout, skips when no secret key (dev mode)
- Config: `TURNSTILE_SECRET_KEY` env var (optional)

### Email Service (Resend)

Transactional emails (`apps/api/src/lib/email.ts`):
- `sendEmail(to, subject, html)` - Generic email sending
- `sendWelcomeEmail(to, name)` - Welcome email template
- Optional in dev: skips when `RESEND_API_KEY` not set
- Config: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` env vars (optional)

### File Upload (Cloudflare R2)

The template includes a complete file upload system using Cloudflare R2 with frontend direct upload via presigned URLs.

**Architecture**:
1. Frontend requests a presigned URL from backend
2. Backend generates presigned PUT URL (valid for 5 minutes)
3. Frontend uploads directly to R2 (bypasses backend)
4. Returns public URL for the uploaded file

**Configuration** (optional in development):
```bash
R2_ACCOUNT_ID=xxx              # Cloudflare account ID
R2_ACCESS_KEY_ID=xxx           # R2 API token access key
R2_SECRET_ACCESS_KEY=xxx       # R2 API token secret key
R2_BUCKET_NAME=xxx             # R2 bucket name
R2_PUBLIC_URL=https://xxx.r2.dev  # Optional: custom public URL
```

**API Route**:
- `POST /api/upload/presign` - Generate presigned upload URL (requires auth)

**Allowed File Types** (`packages/shared/src/schemas/upload.ts`):
- `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Max file size: 10MB
- Presigned URL expires in 5 minutes

**Frontend Usage** (`apps/web/src/lib/upload.ts`):
```typescript
import { uploadFile, validateFile } from "@/lib/upload";

// Simple upload
const result = await uploadFile(file);
console.log(result.publicUrl);  // https://xxx.r2.dev/uploads/userId/timestamp-uuid.png

// Upload with progress tracking
const result = await uploadFile(file, (progress) => {
  console.log(`${progress.percentage}%`);  // 0-100
});

// Validate file before upload (optional, uploadFile does this internally)
const validation = validateFile(file);
if (!validation.valid) {
  console.error(validation.error);
}
```

**File Storage Structure**:
```
uploads/
└── {userId}/
    └── {timestamp}-{uuid}.{ext}
```

### Task Queue (pg-boss)

The template includes a PostgreSQL-based task queue using pg-boss for background job processing. No Redis or additional infrastructure required -- it reuses the existing PostgreSQL database.

**Architecture**:
- Singleton client pattern (`apps/api/src/lib/queue.ts`) -- same as `stripe.ts`, `r2.ts`, `ai.ts`
- pg-boss stores jobs in a dedicated `pgboss` schema within PostgreSQL
- Workers run in the same API process (no separate worker container)
- Built-in retry, delayed tasks, priority queues, cron scheduling, dead letter queues

**Key Files**:
- `apps/api/src/lib/queue.ts` -- pg-boss singleton (getQueue)
- `apps/api/src/jobs/index.ts` -- Registers all job handlers
- `apps/api/src/jobs/*.ts` -- Individual job definitions
- `apps/api/src/routes/tasks.ts` -- Task submission + status query API
- `packages/shared/src/schemas/task.ts` -- Task-related Zod schemas

**Lifecycle**:
- Started in `index.ts` after server listen: `await boss.start()` + `registerAllJobs(boss)`
- Stopped during graceful shutdown: `await boss.stop({ graceful: true, timeout: 30000 })`

**Enqueueing Jobs**:
```typescript
import { getQueue } from "../lib/queue";

const boss = getQueue();
await boss.send("ai-generation", {
  taskId: task.id,
  userId: session.user.id,
  model: "some-model",
  prompt: "...",
});

// With options
await boss.send("job-name", payload, {
  retryLimit: 5,
  retryDelay: 60,
  startAfter: 30,           // Delay start by 30 seconds
  priority: 1,              // Higher = processed first
  singletonKey: uniqueId,   // Deduplicate by key
});
```

**Defining Jobs**:
```typescript
// apps/api/src/jobs/my-job.ts
import type PgBoss from "pg-boss";

interface MyPayload {
  taskId: string;
  userId: string;
}

export function registerMyJob(boss: PgBoss) {
  boss.work<MyPayload>("my-job", { teamConcurrency: 5 }, async (job) => {
    // Update status to processing
    // Do the work
    // Update status to completed/failed
    // Throw to trigger retry
  });
}

// apps/api/src/jobs/index.ts -- register it
export async function registerAllJobs(boss: PgBoss) {
  registerMyJob(boss);
  // Cron example
  await boss.schedule("cleanup", "0 3 * * *", {});
}
```

**Frontend Task Polling** (TanStack Query):
```typescript
const { data: task } = useQuery({
  queryKey: ["task", taskId],
  queryFn: async () => {
    const res = await api.api.tasks[":id"].$get({ param: { id: taskId } });
    return (await res.json()).data;
  },
  enabled: !!taskId,
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (status === "completed" || status === "failed") return false;
    return 2000; // Poll every 2 seconds
  },
});
```

**Configuration**: Uses `DATABASE_URL` (already required). No additional env vars needed.

### AI Chat (OpenRouter)

The template includes an AI chat endpoint powered by the OpenRouter SDK (`@openrouter/sdk`), providing unified access to 300+ language models.

**Architecture**:
- Singleton client pattern (`apps/api/src/lib/ai.ts`) — same as `stripe.ts` and `r2.ts`
- `isAIConfigured()` check before use, returns 503 if not configured
- Shared Zod schemas in `packages/shared/src/schemas/chat.ts`

**API Route**:
- `POST /api/chat` — Unified chat + image generation endpoint (requires auth)

**Modes**:
- **Text chat** (`modalities: ["text"]`): Streaming SSE response via `streamSSE()` from Hono
- **Image generation** (`modalities: ["image", "text"]`): Non-streaming response with base64 images

**Configuration** (optional in development):
```bash
OPENROUTER_API_KEY=sk-or-...    # OpenRouter API key
```

**Example Models**:
- Text: `moonshotai/kimi-k2.5` (default), `minimax/minimax-m2.5`
- Image: `google/gemini-2.5-flash-image`

## Project Structure

```
morph-template/
├── apps/
│   ├── api/                    # Backend application
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── posts.ts    # Posts CRUD
│   │   │   │   ├── checkout.ts # Stripe checkout (credits + subscriptions)
│   │   │   │   ├── orders.ts   # User order history (with pagination)
│   │   │   │   ├── webhooks.ts # Stripe webhook handler (checkout + subscriptions)
│   │   │   │   ├── user.ts     # User profile, credits, subscription, usage history
│   │   │   │   ├── upload.ts   # R2 presigned URL generation
│   │   │   │   ├── chat.ts     # AI chat (streaming SSE + image gen)
│   │   │   │   ├── tasks.ts    # Task submission + status query
│   │   │   │   ├── admin.ts    # Admin: user search, credit grant, audit
│   │   │   │   ├── referral.ts # Referral system with anti-fraud
│   │   │   │   └── feedback.ts # User feedback submission
│   │   │   ├── jobs/
│   │   │   │   ├── index.ts    # Registers all job handlers
│   │   │   │   ├── ai-generation.ts  # AI generation job
│   │   │   │   └── cleanup.ts  # Scheduled cleanup job
│   │   │   ├── db/
│   │   │   │   ├── schema.ts   # Drizzle schema (user, orders, posts, aiTasks)
│   │   │   │   └── index.ts    # Database connection + health check
│   │   │   ├── lib/
│   │   │   │   ├── response.ts # ok(), err(), errors.* helpers
│   │   │   │   ├── rate-limit.ts # Sliding window rate limiter + getClientIp
│   │   │   │   ├── credits-service.ts # Three-pool credits system
│   │   │   │   ├── credits-admin.ts   # Admin credit operations
│   │   │   │   ├── credit-records.ts  # Credit audit trail
│   │   │   │   ├── entitlements.ts    # Feature gating by subscription tier
│   │   │   │   ├── referral-service.ts # Referral code logic + anti-fraud
│   │   │   │   ├── audit-log.ts   # Admin action logging
│   │   │   │   ├── turnstile.ts   # Cloudflare Turnstile verification
│   │   │   │   ├── email.ts       # Resend email service
│   │   │   │   ├── queue.ts    # pg-boss task queue singleton
│   │   │   │   ├── stripe.ts   # Stripe client singleton
│   │   │   │   ├── r2.ts       # R2 client + presigned URL generation
│   │   │   │   ├── ai.ts       # OpenRouter client singleton
│   │   │   │   └── seed-dev.ts # Dev test account seeding
│   │   │   ├── auth.ts         # Better Auth configuration (dynamic providers)
│   │   │   ├── client.ts       # Pre-compiled RPC client export
│   │   │   ├── env.ts          # Environment variable validation
│   │   │   └── index.ts        # Main app, EXPORTS AppType
│   │   └── drizzle.config.ts   # Drizzle Kit configuration
│   └── web/                    # Frontend application
│       ├── src/
│       │   ├── components/
│       │   │   ├── ui/         # shadcn/ui components
│       │   │   └── error-boundary.tsx  # React error boundary
│       │   ├── lib/
│       │   │   ├── api.ts      # Typed Hono client + ApiError + auto toast
│       │   │   ├── auth-client.ts  # Better Auth client
│       │   │   ├── query-client.ts # TanStack Query setup
│       │   │   ├── upload.ts   # File upload utilities (R2 direct upload)
│       │   │   └── utils.ts    # Utilities (cn helper)
│       │   ├── pages/          # Page components (orders.tsx, etc.)
│       │   ├── env.ts          # Frontend env validation
│       │   └── main.tsx        # React entry point
│       └── vite.config.ts
├── packages/
│   └── shared/                 # Shared schemas and types
│       └── src/
│           ├── schemas/
│           │   ├── common.ts   # ApiSuccess, ApiFailure, ERROR_CODES, isPaywallError
│           │   ├── post.ts     # Post-related schemas
│           │   ├── order.ts    # Order schemas (with pagination)
│           │   ├── user.ts     # User update schema
│           │   ├── upload.ts   # Upload schemas + file type/size constants
│           │   ├── chat.ts     # Chat message & request schemas
│           │   ├── task.ts     # Task submission + status schemas
│           │   ├── subscription.ts # Subscription tiers, plans, pricing
│           │   ├── credit-record.ts # Credit audit trail schemas
│           │   ├── admin.ts    # Admin operation schemas
│           │   ├── referral.ts # Referral code schemas
│           │   └── feedback.ts # Feedback submission schemas
│           ├── config/
│           │   ├── pricing.ts  # Subscription plans & credit packages
│           │   ├── credits.ts  # Three-pool credits config
│           │   └── referral.ts # Referral system config
│           └── index.ts        # Re-exports all schemas
└── scripts/
    └── check-file-lines.ts     # File line count checker (max 500)
```

## Adding New Features

When adding new features, follow this pattern:

### 1. Define Schemas (packages/shared)
```typescript
// packages/shared/src/schemas/comment.ts
export const createCommentSchema = z.object({
  postId: z.string().uuid(),
  content: z.string().min(1),
});

export type CreateComment = z.infer<typeof createCommentSchema>;
```

### 2. Update Database Schema (apps/api)
```typescript
// apps/api/src/db/schema.ts
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').references(() => posts.id),
  content: text('content').notNull(),
  userId: text('user_id').references(() => user.id),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Run: pnpm db:push
```

### 3. Create API Route (apps/api)
```typescript
// apps/api/src/routes/comments.ts
import { zValidator } from "@hono/zod-validator";
import { createCommentSchema } from "@repo/shared";
import { Hono } from "hono";
import { auth } from "../auth";
import { db } from "../db";
import { comments } from "../db/schema";
import { errors, ok } from "../lib/response";

const commentsRoute = new Hono()
  .post('/', zValidator('json', createCommentSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errors.unauthorized(c);
    }

    const data = c.req.valid('json');
    const [comment] = await db.insert(comments).values({
      ...data,
      userId: session.user.id,
    }).returning();

    return ok(c, comment, 201);
  })

  .get('/', async (c) => {
    const allComments = await db.query.comments.findMany();
    return ok(c, { comments: allComments });
  });

export default commentsRoute;
```

### 4. Mount Route (apps/api/src/index.ts)
```typescript
import commentsRoute from "./routes/comments";

// Use chained .route() calls to preserve type information
const app = baseApp
  .route("/api/posts", postsRoute)
  .route("/api/comments", commentsRoute);  // Add here
```

### 5. Use in Frontend (apps/web)
```typescript
// Frontend automatically has types available via hcWithType
const { mutate } = useMutation({
  mutationFn: async (data: CreateComment) => {
    const res = await api.api.comments.$post({ json: data });
    const json = await res.json();
    if (!json.success) throw new Error(json.error.message);
    return json.data;
  },
});
```

## Adding Background Jobs

When adding new background jobs, follow this pattern:

### 1. Create Job Handler (apps/api/src/jobs/)
```typescript
// apps/api/src/jobs/my-job.ts
import type PgBoss from "pg-boss";
import { eq } from "drizzle-orm";
import { db } from "../db";

interface MyJobPayload {
  taskId: string;
  userId: string;
  // ... other fields
}

export function registerMyJob(boss: PgBoss) {
  boss.work<MyJobPayload>("my-job", { teamConcurrency: 5 }, async (job) => {
    const { taskId } = job.data;
    // Do the work, throw on failure to trigger retry
  });
}
```

### 2. Register in jobs/index.ts
```typescript
import { registerMyJob } from "./my-job";

export async function registerAllJobs(boss: PgBoss) {
  registerMyJob(boss);
  // ... other jobs
}
```

### 3. Enqueue from Route Handler
```typescript
import { getQueue } from "../lib/queue";

// In route handler:
const boss = getQueue();
await boss.send("my-job", { taskId: task.id, userId: session.user.id });
```

## API Response Helpers

### Backend Response Helpers

Use helpers from `apps/api/src/lib/response.ts`:

```typescript
import { ok, errors } from "../lib/response";

// Success responses
return ok(c, { posts: allPosts });           // 200
return ok(c, newPost, 201);                  // 201 Created

// Error shortcuts
return errors.unauthorized(c);               // 401
return errors.unauthorized(c, "Custom msg"); // 401 with custom message
return errors.forbidden(c);                  // 403
return errors.notFound(c, "Post not found"); // 404
return errors.badRequest(c, "Invalid input", zodIssues); // 400
return errors.conflict(c, "Already exists"); // 409
return errors.tooManyRequests(c);            // 429
return errors.internal(c);                   // 500
return errors.serviceUnavailable(c, "Stripe not configured"); // 503
```

### API Route Design Principle

**Avoid POST operations with dynamic route parameters:**

```typescript
// ❌ Bad - verbose bracket syntax in frontend
.post("/:id/update", ...)
// Frontend: api.api.posts[':id']['update'].$post({ param: { id } })

// ✅ Good - cleaner syntax, ID in body
.post("/update", zValidator('json', updateSchema), ...)
// Frontend: api.api.posts.update.$post({ json: { id, ...data } })
```

GET/DELETE operations can use path parameters (RESTful conventions).

## Database Patterns

### Schema Definitions
- Use Drizzle's `pgTable` for table definitions
- Define relations with `relations()` for automatic joins
- Better Auth manages: `user`, `session`, `account`, `verification` tables
- **Always use `withTimezone: true`** for timestamp columns

### Development vs Production
- **Development**: Use `pnpm db:push` (direct schema sync, no migrations)
- **Production**: Use `pnpm db:generate` then `drizzle-kit migrate` (migration files)

### Querying
```typescript
// Relational query API (preferred)
const posts = await db.query.posts.findMany({
  with: {
    user: {
      columns: { id: true, name: true, email: true }
    }
  }
});

// Core query builder
const posts = await db.select().from(posts).where(eq(posts.userId, userId));
```

### Database Health Check
```typescript
import { checkDatabaseHealth, closeDatabase } from "./db";

// Health check endpoint uses this
const health = await checkDatabaseHealth();
// Returns: { healthy: boolean, error?: string }
```

## Server Features

### Health Check Endpoint
- `GET /health` - Returns `{ status: "ok" }` (200) or `{ status: "degraded" }` (503)
- During shutdown, returns `{ status: "shutting_down" }` (503)
- Used by load balancers and monitoring systems

### Graceful Shutdown
The server handles SIGTERM/SIGINT signals:
1. Sets `isShuttingDown = true` (health check returns 503)
2. Waits 5 seconds for traffic to drain
3. Closes HTTP server
4. Stops pg-boss queue (graceful: true, 30s timeout for in-progress jobs)
5. Closes database connections
6. Exits cleanly

### HTTP Proxy Support
For local development with external APIs through a proxy:
```bash
# In apps/api/.env
HTTPS_PROXY=http://127.0.0.1:7890
```

### Global Error Handler
Unhandled errors are caught and return a consistent error response:
- Development: Full error message
- Production: Generic "Internal server error"

### Rate Limiting
Use the sliding window rate limiter (`apps/api/src/lib/rate-limit.ts`):

```typescript
import { checkRateLimit, CHECKOUT_LIMIT, getClientIp } from "../lib/rate-limit";

// In route handler
const ip = getClientIp(c.req.raw.headers);
const rateLimit = checkRateLimit(`checkout:${userId}`, CHECKOUT_LIMIT);
if (rateLimit.limited) {
  return errors.tooManyRequests(c);
}
```

Available configurations:
- `API_USER_LIMIT`: 100 req/min per user
- `GLOBAL_IP_LIMIT`: 200 req/min per IP
- `CHECKOUT_LIMIT`: 5 req/hour per user
- `WEBHOOK_LIMIT`: 100 req/min per IP

### Error Codes
Standard error codes are defined in `packages/shared/src/schemas/common.ts`:

```typescript
import { ERROR_CODES, isPaywallError } from "@repo/shared";

// Backend: use error codes
return errors.unauthorized(c);  // Uses ERROR_CODES.UNAUTHORIZED

// Frontend: check error type
if (isPaywallError(error.code)) {
  // Show paywall modal instead of toast
}
```

Paywall errors (handled specially in frontend):
- `INSUFFICIENT_CREDITS`
- `PAYMENT_REQUIRED`
- `SUBSCRIPTION_REQUIRED`
- `LIMIT_REACHED`

## Environment Variables

### Backend (apps/api/.env)
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/morphdb
BETTER_AUTH_SECRET=<32+ character secret>
BETTER_AUTH_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173  # For CORS and checkout redirects

# OAuth providers (optional in development, required in production)
# If not configured, the corresponding social login won't be available
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Stripe (optional in development, required in production)
STRIPE_SECRET_KEY=sk_test_...       # Get from Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_...     # Get from Stripe CLI or Dashboard

# OpenRouter AI (optional in development)
OPENROUTER_API_KEY=sk-or-...        # OpenRouter API key

# Cloudflare R2 (optional in development, required for file uploads)
R2_ACCOUNT_ID=xxx                   # Cloudflare account ID
R2_ACCESS_KEY_ID=xxx                # R2 API token access key
R2_SECRET_ACCESS_KEY=xxx            # R2 API token secret key
R2_BUCKET_NAME=xxx                  # R2 bucket name
R2_PUBLIC_URL=https://xxx.r2.dev   # Optional: custom public URL

# Cloudflare Turnstile (optional in development)
TURNSTILE_SECRET_KEY=xxx            # Turnstile secret key

# Resend email (optional in development)
RESEND_API_KEY=re_xxx               # Resend API key
RESEND_FROM_EMAIL=noreply@example.com  # Sender email address

# Optional: HTTP proxy for external API calls
HTTPS_PROXY=http://127.0.0.1:7890
```

### Frontend (apps/web/.env)
```bash
VITE_API_URL=http://localhost:3000
```

**Important**: Environment variables are validated at startup via `validateEnv()` in both API and Web.

**Note**: OAuth providers are dynamically configured - only providers with valid credentials will be enabled.

## Important Notes

### CORS Configuration
The API automatically configures CORS based on `NODE_ENV`:
- **Development**: Allows `http://localhost:5173` and `http://localhost:5174`
- **Production**: Requires `FRONTEND_URL` environment variable

### Better Auth Tables
DO NOT manually modify these tables managed by Better Auth:
- `user`, `session`, `account`, `verification`

You can add custom columns to `user` table, but follow Better Auth's migration guide.

### Turborepo Caching
Turborepo caches build outputs. If you see stale types:
```bash
pnpm build  # Rebuild all packages
```

### Adding shadcn/ui Components
1. Visit [ui.shadcn.com](https://ui.shadcn.com/)
2. Copy component code to `apps/web/src/components/ui/`
3. Adjust imports to use `@/lib/utils` for the `cn()` helper

## Deployment (Zeabur)

The repository includes `zeabur.json` for deployment configuration. When deploying:

1. **Database**: Add PostgreSQL service via Zeabur dashboard
2. **API**: Deploy `apps/api` with environment variables set
3. **Web**: Deploy `apps/web` with `VITE_API_URL` pointing to API service
4. **Migrations**: Run `pnpm db:push` from API service console or locally with production DATABASE_URL

See README.md for detailed deployment instructions.
