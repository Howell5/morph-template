# Architecture

This document provides a comprehensive technical overview of Morph Template's architecture, design decisions, and internal patterns.

## Table of Contents

- [System Overview](#system-overview)
- [Monorepo Structure](#monorepo-structure)
- [End-to-End Type Safety](#end-to-end-type-safety)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Shared Package](#shared-package)
- [Database Layer](#database-layer)
- [Authentication](#authentication)
- [Optional Services Pattern](#optional-services-pattern)
- [Task Queue (pg-boss)](#task-queue-pg-boss)
- [Payments (Stripe)](#payments-stripe)
- [File Upload (Cloudflare R2)](#file-upload-cloudflare-r2)
- [AI Chat (OpenRouter)](#ai-chat-openrouter)
- [Server Lifecycle](#server-lifecycle)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [Data Flow](#data-flow)
- [Deployment](#deployment)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React + Vite)                  │
│  ┌──────────┐  ┌───────────────┐  ┌──────────┐  ┌───────────┐ │
│  │ Pages    │  │ TanStack Query│  │ shadcn/ui│  │ Auth Client│ │
│  └────┬─────┘  └───────┬───────┘  └──────────┘  └─────┬─────┘ │
│       │                │                               │       │
│       └────────────────┼───────────────────────────────┘       │
│                        │                                       │
│                 ┌──────▼───────┐                               │
│                 │ Typed Hono   │  ← End-to-end type safety     │
│                 │ RPC Client   │                               │
│                 └──────┬───────┘                               │
└────────────────────────┼───────────────────────────────────────┘
                         │ HTTP (credentials: include)
┌────────────────────────┼───────────────────────────────────────┐
│                  Backend (Hono)                                 │
│                        │                                       │
│  ┌─────────────────────▼─────────────────────────────────────┐ │
│  │              Middleware Stack                              │ │
│  │  Error Handler → Logger → CORS → Auth Handler             │ │
│  └─────────────────────┬─────────────────────────────────────┘ │
│                        │                                       │
│  ┌─────────────────────▼─────────────────────────────────────┐ │
│  │                   Routes                                  │ │
│  │  /api/posts  /api/checkout  /api/chat  /api/tasks  ...    │ │
│  └────┬────────────┬───────────────┬────────────┬────────────┘ │
│       │            │               │            │              │
│  ┌────▼────┐ ┌─────▼─────┐ ┌──────▼──────┐ ┌──▼──────────┐  │
│  │ Drizzle │ │  Stripe   │ │  OpenRouter  │ │  pg-boss    │  │
│  │  ORM    │ │ (optional)│ │  (optional)  │ │ Task Queue  │  │
│  └────┬────┘ └───────────┘ └─────────────┘  └──────┬──────┘  │
│       │                                             │         │
│  ┌────▼─────────────────────────────────────────────▼──────┐  │
│  │                    PostgreSQL                           │  │
│  │   app tables  │  pgboss schema  │  Better Auth tables   │  │
│  └─────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────┘
```

**Key Design Principles:**

1. **End-to-end type safety** -- Hono's RPC client eliminates manual type definitions across the API boundary
2. **Graceful degradation** -- Optional services (Stripe, R2, OpenRouter, pg-boss) return 503 if unconfigured; the app always starts
3. **PostgreSQL as the single infrastructure dependency** -- No Redis, no message broker; the database handles everything including task queuing
4. **Shared validation schemas** -- Zod schemas in `packages/shared` are the single source of truth for both backend validation and frontend forms
5. **Consistent patterns** -- Every service follows the same singleton + lazy initialization pattern

---

## Monorepo Structure

```
morph-template/
├── apps/
│   ├── api/                      # Backend: Hono + Drizzle + Better Auth
│   │   ├── src/
│   │   │   ├── routes/           # HTTP route handlers
│   │   │   ├── db/               # Database schema + connection
│   │   │   ├── lib/              # Service singletons + utilities
│   │   │   ├── jobs/             # pg-boss job handlers
│   │   │   ├── auth.ts           # Better Auth configuration
│   │   │   ├── client.ts         # Pre-compiled RPC client export
│   │   │   ├── env.ts            # Environment variable validation
│   │   │   └── index.ts          # App entry point, exports AppType
│   │   └── drizzle.config.ts
│   └── web/                      # Frontend: React + Vite + TanStack Query
│       ├── src/
│       │   ├── components/ui/    # shadcn/ui components
│       │   ├── lib/              # API client, auth client, utilities
│       │   ├── pages/            # Page components
│       │   ├── env.ts            # Frontend env validation
│       │   └── main.tsx          # React entry point
│       └── vite.config.ts
├── packages/
│   └── shared/                   # Shared Zod schemas, types, config
│       └── src/
│           ├── schemas/          # Validation schemas
│           └── config/           # Business config (pricing, etc.)
├── scripts/                      # Utility scripts
├── docker-compose.yml            # PostgreSQL only
├── turbo.json                    # Turborepo task config
└── zeabur.json                   # Deployment config
```

**Build pipeline** (via Turborepo):

```
packages/shared (build first)
    ↓ dependency
apps/api (depends on shared)
apps/web (depends on shared + api types)
```

**Package manager**: pnpm workspaces. Internal packages referenced as `@repo/shared` and `@repo/api`.

---

## End-to-End Type Safety

This is the core architectural innovation. Hono's RPC system enables the frontend to know the exact request and response types of every API endpoint -- without writing any type definitions.

### How it works

**Step 1: Backend defines routes with chained calls** (preserves type chain):
```typescript
// apps/api/src/index.ts
const app = baseApp
  .route("/api/posts", postsRoute)
  .route("/api/checkout", checkoutRoute)
  .route("/api/tasks", tasksRoute);

export type AppType = typeof app;
```

**Step 2: Pre-compiled RPC client** (computed once at build time):
```typescript
// apps/api/src/client.ts
import type { AppType } from "./index";
import { hc } from "hono/client";

export type ApiClient = ReturnType<typeof hc<AppType>>;
export const hcWithType = (...args: Parameters<typeof hc>): ApiClient =>
  hc<AppType>(...args);
```

> Why pre-compiled? Without this, TypeScript would re-compute the full AppType on every IDE keystroke, causing lag with large route definitions.

**Step 3: Frontend creates typed client**:
```typescript
// apps/web/src/lib/api.ts
import { hcWithType } from "@repo/api/client";

export const api = hcWithType(env.VITE_API_URL, { fetch: apiFetch });
```

**Step 4: Every API call is fully typed**:
```typescript
// Frontend code -- types inferred automatically
const res = await api.api.posts.$get();
const json = await res.json();
// json.data.posts is Post[], json.data.pagination is {...}
```

### Type flow diagram

```
Backend Route Definition
    │
    ├─ Input types (Zod schema → zValidator)
    │   └─ createPostSchema → { title: string, content: string }
    │
    ├─ Output types (return ok(c, data))
    │   └─ { success: true, data: { posts: Post[], pagination: {...} } }
    │
    └─ Chained on app → AppType captures all routes
         │
         └─ hcWithType creates typed client
              │
              └─ api.api.posts.$get() → knows response type
                 api.api.posts.$post({ json: {...} }) → knows request type
```

---

## Backend Architecture

### Middleware Stack

Middleware is applied in order on every request:

```
Request → Error Handler → Logger → CORS → Auth Handler → Route Handler → Response
```

1. **Global Error Handler** -- Catches unhandled exceptions. Returns full error in dev, generic message in production.
2. **Logger** -- Hono's built-in request logging.
3. **CORS** -- Development: allows `localhost:5173/5174`. Production: requires `FRONTEND_URL`.
4. **Auth Handler** -- Mounts Better Auth at `/api/auth/*`. Session-based with cookies.

### Route Patterns

All routes follow a consistent structure:

```typescript
const exampleRoute = new Hono()
  // Public endpoint
  .get("/", zValidator("query", paginationSchema), async (c) => {
    const { page, limit } = c.req.valid("query");
    const data = await db.query.examples.findMany({ ... });
    return ok(c, { items: data, pagination: { ... } });
  })

  // Protected endpoint
  .post("/", zValidator("json", createSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    const data = c.req.valid("json");
    const [item] = await db.insert(table).values({
      ...data,
      userId: session.user.id,
    }).returning();

    return ok(c, item, 201);
  })

  // Protected + ownership check
  .delete("/:id", async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) return errors.unauthorized(c);

    const item = await db.query.examples.findFirst({ where: eq(table.id, id) });
    if (!item) return errors.notFound(c);
    if (item.userId !== session.user.id) return errors.forbidden(c);

    await db.delete(table).where(eq(table.id, id));
    return ok(c, { message: "Deleted" });
  });
```

### API Route Design Principle

POST operations should avoid dynamic route parameters to keep frontend syntax clean:

```typescript
// Avoid: verbose bracket syntax in frontend
.post("/:id/update", ...)
// Frontend: api.api.posts[':id']['update'].$post({ param: { id } })

// Prefer: ID in request body
.post("/update", zValidator('json', updateSchema), ...)
// Frontend: api.api.posts.update.$post({ json: { id, ...data } })
```

GET and DELETE operations can use path parameters (RESTful convention).

### Unified Response Format

**Every** API endpoint returns this structure:

```typescript
// Success (2xx)
{ success: true, data: T }

// Error (4xx, 5xx)
{
  success: false,
  error: {
    message: string,
    code?: string,          // e.g., "UNAUTHORIZED", "INSUFFICIENT_CREDITS"
    issues?: unknown[]      // Zod validation errors
  }
}
```

Response helpers in `apps/api/src/lib/response.ts`:

| Helper | Status | Use Case |
|--------|--------|----------|
| `ok(c, data)` | 200 | Success |
| `ok(c, data, 201)` | 201 | Created |
| `errors.badRequest(c, msg, issues)` | 400 | Validation error |
| `errors.unauthorized(c)` | 401 | Not logged in |
| `errors.forbidden(c)` | 403 | No permission |
| `errors.notFound(c)` | 404 | Resource missing |
| `errors.conflict(c)` | 409 | Duplicate |
| `errors.tooManyRequests(c)` | 429 | Rate limited |
| `errors.internal(c)` | 500 | Server error |
| `errors.serviceUnavailable(c)` | 503 | Service not configured |

---

## Frontend Architecture

### API Client

The typed Hono client wraps `fetch` with:

1. **`credentials: "include"`** -- Sends session cookies on every request
2. **Auto error toasting** -- Non-paywall errors show `toast.error()` automatically
3. **Error code preservation** -- `ApiError` class carries error code for programmatic handling
4. **Paywall handling** -- Paywall errors (insufficient credits, payment required) are NOT toasted; they trigger a paywall modal instead

```typescript
// apps/web/src/lib/api.ts
async function apiFetch(input, init) {
  const response = await fetch(input, { ...init, credentials: "include" });
  if (!response.ok) {
    const errorData = await response.clone().json();
    if (!isPaywallError(errorData.error?.code)) {
      toast.error(errorData.error?.message);
    }
    throw new ApiError(errorData.error?.message, errorData.error?.code);
  }
  return response;
}
```

### Data Fetching

TanStack Query handles all data fetching with:

- **Automatic caching** -- Queries are cached by key
- **Background refetch** -- Stale data is refreshed automatically
- **Optimistic updates** -- Mutations can update cache before server response
- **Error boundaries** -- Query errors can be caught at component level

Pattern for queries:
```typescript
const { data } = useQuery({
  queryKey: ["posts", page],
  queryFn: async () => {
    const res = await api.api.posts.$get({ query: { page, limit } });
    const json = await res.json();
    return json.data;
  },
});
```

Pattern for mutations:
```typescript
const { mutate } = useMutation({
  mutationFn: async (data: CreatePost) => {
    const res = await api.api.posts.$post({ json: data });
    const json = await res.json();
    if (!json.success) throw new Error(json.error.message);
    return json.data;
  },
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
});
```

---

## Shared Package

`packages/shared` is the single source of truth for:

| Category | Location | Purpose |
|----------|----------|---------|
| Validation schemas | `src/schemas/*.ts` | Zod schemas used in backend (zValidator) and frontend (zodResolver) |
| Error codes | `src/schemas/common.ts` | `ERROR_CODES` enum, `isPaywallError()` helper |
| Response types | `src/schemas/common.ts` | `ApiSuccess<T>`, `ApiFailure`, `ApiResponse<T>` |
| Business config | `src/config/pricing.ts` | Credit packages, pricing tiers |

### Schema flow

```
packages/shared/src/schemas/post.ts
    │
    ├─── apps/api/src/routes/posts.ts
    │    zValidator("json", createPostSchema)  ← backend validation
    │
    └─── apps/web/src/pages/create-post.tsx
         zodResolver(createPostSchema)         ← frontend form validation
```

Both sides use the **same schema object**, ensuring validation rules can never drift.

---

## Database Layer

### Technology

- **Database**: PostgreSQL 16 (via Docker Compose)
- **ORM**: Drizzle ORM with `postgres.js` driver
- **Schema**: Defined in `apps/api/src/db/schema.ts`
- **Migrations**: `pnpm db:push` for dev, `pnpm db:generate` for production

### Connection Management

```typescript
// Lazy initialization with connection pooling
const _client = postgres(process.env.DATABASE_URL, {
  max: 10,              // Max connections in pool
  idle_timeout: 20,     // Close idle after 20s
  connect_timeout: 10,  // Connection timeout
  max_lifetime: 60 * 30 // Max lifetime: 30 min
});
const _db = drizzle(_client, { schema });
```

A `Proxy` pattern provides a convenient `db` export that lazily initializes on first access.

### Tables

| Table | Managed By | Purpose |
|-------|-----------|---------|
| `user` | Better Auth | User accounts (+ custom `credits` column) |
| `session` | Better Auth | Active sessions |
| `account` | Better Auth | OAuth provider links |
| `verification` | Better Auth | Email verification tokens |
| `posts` | App | Example business entity |
| `orders` | App | Credit purchase transactions |
| `aiTasks` | App | AI generation task tracking |

> Better Auth tables (`user`, `session`, `account`, `verification`) should NOT be manually modified except for adding custom columns to `user`.

### Query Patterns

```typescript
// Relational queries (preferred -- automatic joins)
const posts = await db.query.posts.findMany({
  with: { user: { columns: { id: true, name: true } } },
  orderBy: [desc(posts.createdAt)],
  limit: 10,
});

// Core query builder (complex queries)
const results = await db
  .select()
  .from(posts)
  .where(eq(posts.userId, userId))
  .orderBy(desc(posts.createdAt));
```

### Timestamp Convention

All timestamp columns use `withTimezone: true`:

```typescript
createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
  .notNull()
  .defaultNow(),
```

---

## Authentication

### Better Auth

Session-based authentication using cookies. Configured in `apps/api/src/auth.ts`.

**Development mode**:
- Email/password auth auto-enabled (`NODE_ENV !== "production"`)
- Test account seeded on startup: `test@test.com` / `password123`
- No OAuth credentials needed

**Production mode**:
- Only OAuth (Google, GitHub) -- dynamically loaded based on env vars
- Only providers with **both** client ID and secret are enabled
- If neither configured, auth won't work (but server still starts)

### Session Check Pattern

Every protected route:

```typescript
const session = await auth.api.getSession({ headers: c.req.raw.headers });
if (!session) {
  return errors.unauthorized(c);
}
const userId = session.user.id;
```

### Frontend Auth

```typescript
// apps/web/src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
export const { useSession, signIn, signOut } = createAuthClient({ ... });
```

The `apiFetch` wrapper ensures `credentials: "include"` on all requests, so session cookies are always sent.

---

## Optional Services Pattern

All external services follow the same pattern:

```
┌─────────────────────────────────────────────────────┐
│  1. Singleton variable                              │
│     let _client: ClientType | null = null;          │
│                                                     │
│  2. Configuration check                             │
│     export function isConfigured(): boolean { ... } │
│                                                     │
│  3. Lazy getter                                     │
│     export function getClient(): ClientType { ... } │
│                                                     │
│  4. Route guard                                     │
│     if (!isConfigured()) {                          │
│       return errors.serviceUnavailable(c, "...");   │
│     }                                               │
└─────────────────────────────────────────────────────┘
```

| Service | File | Config Check | Getter | Required Env Vars |
|---------|------|-------------|--------|-------------------|
| Stripe | `lib/stripe.ts` | `isStripeConfigured()` | `getStripe()` | `STRIPE_SECRET_KEY` |
| R2 | `lib/r2.ts` | `isR2Configured()` | `getR2Client()` | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` |
| OpenRouter | `lib/ai.ts` | `isAIConfigured()` | `getOpenRouter()` | `OPENROUTER_API_KEY` |
| pg-boss | `lib/queue.ts` | Always available | `getQueue()` | Uses `DATABASE_URL` (already required) |

**Result**: The app always starts. Unconfigured features return 503 with a clear message. No env vars needed for local development beyond `DATABASE_URL` and `BETTER_AUTH_SECRET`.

---

## Task Queue (pg-boss)

### Why pg-boss?

pg-boss uses PostgreSQL's `SKIP LOCKED` + `LISTEN/NOTIFY` for task queuing. It was chosen because:

1. **Zero extra infrastructure** -- Reuses existing PostgreSQL. No Redis, no separate message broker.
2. **Transactional consistency** -- Task creation and business data updates can share a database transaction.
3. **Same singleton pattern** -- Fits the project's `isConfigured()` / `getClient()` convention.
4. **Simple API** -- `boss.send('task-name', data)` to enqueue, `boss.work('task-name', handler)` to process.
5. **Built-in features** -- Retry with backoff, delayed tasks, priority queues, cron scheduling, dead letter queues, concurrency control, deduplication.
6. **Deployment unchanged** -- No new containers, no changes to `docker-compose.yml` or `zeabur.json`.

### Architecture

```
┌──────────────┐     POST /api/tasks      ┌───────────────────────┐
│   Frontend   │ ──────────────────────→   │     Hono API          │
│  React+Vite  │     GET /api/tasks/:id    │                       │
│              │ ←────────────────────── │  Route Handler         │
│  useTaskPoll │   (polling/refetch)       │    │                   │
└──────────────┘                           │    ↓ boss.send()       │
                                           │                       │
                                           │  pg-boss Worker        │
                                           │  (in-process)          │
                                           │    │ boss.work()       │
                                           │    ↓                   │
                                           │  Job Handlers          │
                                           │  (AI / Upload / ...)   │
                                           └────────┬──────────────┘
                                                    │
                                           ┌────────▼──────────────┐
                                           │     PostgreSQL         │
                                           │  ├── app tables        │
                                           │  └── pgboss schema     │
                                           └───────────────────────┘
```

### File Structure

```
apps/api/src/
├── lib/
│   └── queue.ts              # pg-boss singleton (same pattern as ai.ts)
├── jobs/
│   ├── index.ts              # Registers all job handlers
│   ├── ai-generation.ts      # AI generation job example
│   └── cleanup.ts            # Scheduled cleanup job example
```

### Singleton

```typescript
// apps/api/src/lib/queue.ts
import PgBoss from "pg-boss";

let _boss: PgBoss | null = null;

export function getQueue(): PgBoss {
  if (!_boss) {
    _boss = new PgBoss({
      connectionString: process.env.DATABASE_URL!,
      schema: "pgboss",
      retryLimit: 3,
      retryDelay: 30,
      expireInHours: 24,
      archiveCompletedAfterSeconds: 86400,
      deleteAfterDays: 7,
    });
  }
  return _boss;
}
```

### Job Definition Pattern

```typescript
// apps/api/src/jobs/ai-generation.ts
import type PgBoss from "pg-boss";

interface AiGenerationPayload {
  taskId: string;
  userId: string;
  model: string;
  prompt: string;
}

export function registerAiGenerationJob(boss: PgBoss) {
  boss.work<AiGenerationPayload>(
    "ai-generation",
    { teamConcurrency: 5 },
    async (job) => {
      // 1. Update status to processing
      await db.update(aiTasks)
        .set({ status: "processing" })
        .where(eq(aiTasks.id, job.data.taskId));

      try {
        // 2. Do the work
        const result = await callAiProvider(job.data);

        // 3. Update with result
        await db.update(aiTasks)
          .set({ status: "completed", resultUrl: result.url })
          .where(eq(aiTasks.id, job.data.taskId));
      } catch (error) {
        // 4. Mark as failed
        await db.update(aiTasks)
          .set({ status: "failed", error: error.message })
          .where(eq(aiTasks.id, job.data.taskId));

        throw error; // pg-boss will retry up to retryLimit
      }
    }
  );
}
```

### Enqueueing Jobs

From any route handler:

```typescript
import { getQueue } from "../lib/queue";

// Enqueue a job
const boss = getQueue();
const jobId = await boss.send("ai-generation", {
  taskId: task.id,
  userId: session.user.id,
  model: "some-model",
  prompt: "...",
});

// Enqueue with options
await boss.send("ai-generation", payload, {
  retryLimit: 5,          // Override default retry
  retryDelay: 60,         // Retry after 60 seconds
  startAfter: 30,         // Delay start by 30 seconds
  expireInHours: 2,       // Expire if not completed
  priority: 1,            // Higher priority = processed first
  singletonKey: uniqueId, // Deduplicate by key
});
```

### Cron / Scheduled Jobs

```typescript
// Register in jobs/index.ts
await boss.schedule("cleanup-expired", "0 3 * * *", {});
// Runs daily at 3 AM UTC
```

### Frontend Polling

```typescript
// TanStack Query with smart polling
const { data: task } = useQuery({
  queryKey: ["task", taskId],
  queryFn: async () => {
    const res = await api.api.tasks[":id"].$get({ param: { id: taskId } });
    const json = await res.json();
    return json.data;
  },
  enabled: !!taskId,
  refetchInterval: (query) => {
    const status = query.state.data?.status;
    if (status === "completed" || status === "failed") return false;
    return 2000; // Poll every 2 seconds while pending/processing
  },
});
```

### Lifecycle Integration

```typescript
// apps/api/src/index.ts

// Startup
const boss = getQueue();
await boss.start();
await registerAllJobs(boss);

// Graceful shutdown
async function gracefulShutdown() {
  isShuttingDown = true;
  await new Promise((r) => setTimeout(r, 5000));
  server.close();
  await boss.stop({ graceful: true, timeout: 30000 });
  await closeDatabase();
  process.exit(0);
}
```

### When pg-boss isn't enough

If you outgrow pg-boss, the migration path is clear:

| Need | Migrate To | Effort |
|------|-----------|--------|
| Dashboard / observability | Trigger.dev v3 | Medium (similar job definition pattern) |
| High throughput (10K+ jobs/sec) | BullMQ + Redis | Medium (add Redis, rewrite registration) |
| Complex multi-step workflows | Inngest or Temporal | High (different programming model) |

Job handler logic (receive payload → process → update DB) is portable across all solutions.

---

## Payments (Stripe)

### Architecture

```
User clicks "Buy Credits"
    │
    ▼
Frontend: api.api.checkout.$post({ json: { packageId } })
    │
    ▼
Backend: Creates Stripe Checkout Session with metadata
    │  metadata: { userId, packageId, credits }
    ▼
Redirect to Stripe Checkout page
    │
    ▼
User completes payment
    │
    ▼
Stripe sends webhook: checkout.session.completed
    │
    ▼
Backend webhook handler:
  1. Verify signature (STRIPE_WEBHOOK_SECRET)
  2. Idempotency check (stripeSessionId unique)
  3. Database transaction:
     - Create order record
     - Increment user.credits
  4. Return 200 to Stripe
```

### Idempotency

The webhook handler uses `stripeSessionId` (unique constraint) to prevent duplicate processing:

```typescript
const existingOrder = await tx.query.orders.findFirst({
  where: eq(orders.stripeSessionId, session.id),
});
if (existingOrder) return; // Already processed
```

### Credit Packages

Defined in `packages/shared/src/config/pricing.ts` -- shared between frontend (display) and backend (validation):

```typescript
export const CREDIT_PACKAGES = [
  { id: "starter",      credits: 100,  price: 999,   currency: "usd" },
  { id: "professional", credits: 500,  price: 3999,  currency: "usd" },
  { id: "enterprise",   credits: 1500, price: 9999,  currency: "usd" },
];
```

---

## File Upload (Cloudflare R2)

### Architecture

```
Frontend                          Backend                      Cloudflare R2
   │                                │                              │
   │  POST /api/upload/presign      │                              │
   │  { contentType, size }         │                              │
   │ ──────────────────────────→    │                              │
   │                                │  Generate presigned PUT URL  │
   │                                │  (5 min expiration)          │
   │    { uploadUrl, publicUrl }    │                              │
   │ ←──────────────────────────    │                              │
   │                                                               │
   │  PUT uploadUrl (direct upload)                                │
   │ ─────────────────────────────────────────────────────────→    │
   │                                                               │
   │  200 OK                                                       │
   │ ←─────────────────────────────────────────────────────────    │
   │                                                               │
   │  Save publicUrl to DB                                         │
```

**Key**: Frontend uploads directly to R2, bypassing the backend. This avoids large file transfers through your API server.

### File Key Format

```
uploads/{userId}/{timestamp}-{uuid}.{ext}
```

### Constraints

- Allowed types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
- Max size: 10MB
- Presigned URL expires in 5 minutes

---

## AI Chat (OpenRouter)

### Two Modes

| Mode | Trigger | Response Type | Use Case |
|------|---------|--------------|----------|
| Text chat | `modalities: ["text"]` | Streaming SSE | Conversational AI |
| Image generation | `modalities: ["image", "text"]` | JSON with base64 | Image creation |

### Streaming SSE Pattern

```typescript
return streamSSE(c, async (sseStream) => {
  for await (const chunk of stream) {
    const content = chunk.choices?.[0]?.delta?.content;
    if (content) {
      await sseStream.writeSSE({ data: JSON.stringify({ content }) });
    }
  }
  await sseStream.writeSSE({ data: "[DONE]" });
});
```

### Default Models

- Text: `moonshotai/kimi-k2.5`
- Image: `google/gemini-2.5-flash-image`

---

## Server Lifecycle

### Startup Sequence

```
1. Configure HTTP proxy (if HTTPS_PROXY set)
2. Validate environment variables
3. Build middleware stack
4. Mount routes
5. Seed dev accounts (if NODE_ENV !== "production")
6. Start pg-boss queue + register job handlers
7. Start HTTP server on PORT
8. Register signal handlers (SIGTERM, SIGINT)
```

### Shutdown Sequence

```
Signal received (SIGTERM / SIGINT)
    │
    ▼
1. Set isShuttingDown = true
   └─ /health now returns 503 "shutting_down"
   └─ Load balancer stops sending traffic
    │
    ▼
2. Wait 5 seconds (drain in-flight requests)
    │
    ▼
3. Close HTTP server (reject new connections)
    │
    ▼
4. Stop pg-boss (graceful: true, 30s timeout)
   └─ Completes in-progress jobs
    │
    ▼
5. Close database connections
    │
    ▼
6. process.exit(0)
```

### Health Check

`GET /health` returns:

| Condition | Status | Response |
|-----------|--------|----------|
| Healthy | 200 | `{ status: "ok" }` |
| DB unhealthy | 503 | `{ status: "degraded" }` |
| Shutting down | 503 | `{ status: "shutting_down" }` |

---

## Rate Limiting

### Algorithm

In-memory sliding window. Each key (user ID or IP) has a list of timestamps. On check, timestamps outside the window are pruned, and the request is allowed if the count is below the limit.

### Configurations

| Config | Limit | Window | Key |
|--------|-------|--------|-----|
| `API_USER_LIMIT` | 100 req | 1 min | `api:user:{userId}` |
| `GLOBAL_IP_LIMIT` | 200 req | 1 min | `global:ip:{ip}` |
| `CHECKOUT_LIMIT` | 5 req | 1 hour | `checkout:{userId}` |
| `WEBHOOK_LIMIT` | 100 req | 1 min | `webhook:{ip}` |
| `AI_GENERATION_LIMIT` | 10 req | 1 min | `ai:gen:{userId}` |

### IP Detection Priority

```
CF-Connecting-IP (Cloudflare)
    → X-Real-IP (reverse proxy)
        → X-Forwarded-For (client IP in proxy chain)
            → "unknown"
```

### Auto-cleanup

Every 5 minutes, entries with no recent timestamps are removed from memory.

> Note: In-memory rate limiting resets on restart and doesn't work across multiple instances. For multi-instance deployments, consider using PostgreSQL-backed rate limiting or Redis.

---

## Error Handling

### Error Codes

Defined in `packages/shared/src/schemas/common.ts`:

| Category | Codes |
|----------|-------|
| Auth | `UNAUTHORIZED`, `FORBIDDEN`, `SESSION_EXPIRED` |
| Validation | `BAD_REQUEST`, `VALIDATION_ERROR` |
| Resources | `NOT_FOUND`, `CONFLICT` |
| Rate Limiting | `RATE_LIMITED` |
| Paywall | `INSUFFICIENT_CREDITS`, `PAYMENT_REQUIRED`, `SUBSCRIPTION_REQUIRED`, `LIMIT_REACHED` |
| Server | `INTERNAL_ERROR`, `SERVICE_UNAVAILABLE`, `TIMEOUT` |

### Frontend Error Handling

```
API Error
    │
    ├─ Is paywall error? → Show paywall modal (no toast)
    │
    └─ Not paywall → Show toast.error(message) automatically
```

The `isPaywallError(code)` function determines which errors get special treatment (paywall modal) vs standard toast notification.

---

## Data Flow

### Complete Request Lifecycle

```
User Action (click button)
    │
    ▼
React Component → useMutation / useQuery
    │
    ▼
api.api.resource.$method({ json/query/param })
    │
    ▼
apiFetch wrapper (adds credentials, error handling)
    │
    ▼
HTTP Request → Hono Backend
    │
    ▼
Middleware (error handler → logger → CORS)
    │
    ▼
Auth Handler (if /api/auth/* path)
 or Route Handler
    │
    ├─ zValidator (validate request)
    ├─ auth.api.getSession (check auth)
    ├─ db.query / db.insert / ... (database)
    ├─ boss.send (enqueue job if async)
    │
    ▼
ok(c, data) or errors.*(c)
    │
    ▼
{ success: true, data } or { success: false, error }
    │
    ▼
apiFetch (check response.ok, auto-toast errors)
    │
    ▼
TanStack Query (cache, refetch, error boundary)
    │
    ▼
React Component (re-render with new data)
```

---

## Deployment

### Zeabur

The repository includes `zeabur.json` for deployment. Two services:

1. **API** (`apps/api`): Node.js server on port 3000
2. **Web** (`apps/web`): Static site from `dist/`

**Infrastructure**:
- PostgreSQL: Provisioned via Zeabur dashboard
- No Redis, no worker containers needed

### Environment Variables

**Required** (both dev and production):
- `DATABASE_URL` -- PostgreSQL connection string
- `BETTER_AUTH_SECRET` -- 32+ character secret
- `BETTER_AUTH_URL` -- Backend URL
- `VITE_API_URL` (frontend) -- Backend URL

**Required in production only**:
- `FRONTEND_URL` -- For CORS
- At least one OAuth provider (Google or GitHub)

**Optional** (graceful degradation if not set):
- `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
- `R2_ACCOUNT_ID` + `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY` + `R2_BUCKET_NAME`
- `OPENROUTER_API_KEY`
- `HTTPS_PROXY`
