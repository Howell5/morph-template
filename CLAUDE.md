# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Morph Template is a full-stack TypeScript monorepo featuring end-to-end type safety through Hono's RPC-style architecture. The backend exports an `AppType` that the frontend imports, enabling automatic type inference across the API boundary without manual type definitions.

**Key Technology Stack:**
- **Backend**: Hono (web framework) + Drizzle ORM + PostgreSQL + Better Auth
- **Frontend**: React + Vite + TanStack Query + shadcn/ui + Tailwind CSS
- **Monorepo**: pnpm workspaces + Turborepo
- **Tooling**: Biome (linting/formatting), TypeScript strict mode

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

### RPC-Style Type Safety

The core architecture relies on Hono's `AppType` export for end-to-end type safety:

1. **Backend exports AppType** (`apps/api/src/index.ts`):
```typescript
export type AppType = typeof app;
```

2. **Frontend imports and uses it** (`apps/web/src/lib/api.ts`):
```typescript
import type { AppType } from "@repo/api";
import { hc } from "hono/client";

export const api = hc<AppType>(env.VITE_API_URL, {
  fetch: apiFetch,
});
```

3. **All API calls are fully typed**:
```typescript
// Frontend automatically knows request/response types
const response = await api.api.posts.$get();
const data = await response.json(); // Typed as Post[]
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

## Project Structure

```
morph-template/
├── apps/
│   ├── api/                    # Backend application
│   │   ├── src/
│   │   │   ├── routes/         # API route handlers (e.g., posts.ts)
│   │   │   ├── db/
│   │   │   │   ├── schema.ts   # Drizzle database schema
│   │   │   │   └── index.ts    # Database connection
│   │   │   ├── lib/
│   │   │   │   └── response.ts # Standard error response helper
│   │   │   ├── auth.ts         # Better Auth configuration
│   │   │   ├── env.ts          # Environment variable validation
│   │   │   └── index.ts        # Main app, EXPORTS AppType
│   │   └── drizzle.config.ts   # Drizzle Kit configuration
│   └── web/                    # Frontend application
│       ├── src/
│       │   ├── components/ui/  # shadcn/ui components
│       │   ├── lib/
│       │   │   ├── api.ts      # Typed Hono client (IMPORTS AppType)
│       │   │   ├── auth-client.ts  # Better Auth client
│       │   │   ├── query-client.ts # TanStack Query setup
│       │   │   └── utils.ts    # Utilities (cn helper)
│       │   ├── pages/          # Page components
│       │   ├── env.ts          # Frontend env validation
│       │   └── main.tsx        # React entry point
│       └── vite.config.ts
└── packages/
    └── shared/                 # Shared schemas and types
        └── src/
            ├── schemas/
            │   ├── common.ts   # ApiError, Pagination schemas
            │   └── post.ts     # Post-related schemas
            └── index.ts        # Re-exports all schemas
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
  createdAt: timestamp('created_at', { mode: 'date' }).notNull().defaultNow(),
});

// Run: pnpm db:push
```

### 3. Create API Route (apps/api)
```typescript
// apps/api/src/routes/comments.ts
import { zValidator } from "@hono/zod-validator";
import { createCommentSchema } from "@repo/shared";
import { Hono } from "hono";

const commentsRoute = new Hono()
  .post('/', zValidator('json', createCommentSchema), async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (!session) {
      return errorResponse(c, 401, 'Unauthorized');
    }

    const data = c.req.valid('json');
    // ... implementation
  });

export default commentsRoute;
```

### 4. Mount Route (apps/api/src/index.ts)
```typescript
import commentsRoute from "./routes/comments";
app.route("/api/comments", commentsRoute);
```

### 5. Use in Frontend (apps/web)
```typescript
// Frontend automatically has types available via AppType
const { mutate } = useMutation({
  mutationFn: async (data: CreateComment) => {
    const res = await api.api.comments.$post({ json: data });
    return res.json();
  },
});
```

## Database Patterns

### Schema Definitions
- Use Drizzle's `pgTable` for table definitions
- Define relations with `relations()` for automatic joins
- Better Auth manages: `user`, `session`, `account`, `verification` tables

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

## Error Handling

### Backend
Use `errorResponse()` helper from `apps/api/src/lib/response.ts`:
```typescript
if (!session) {
  return errorResponse(c, 401, 'Unauthorized');
}
```

All errors follow the `ApiError` schema from `@repo/shared`:
```typescript
type ApiError = {
  message: string;
  code?: string;
  issues?: any[]; // For Zod validation errors
};
```

### Frontend
The custom `apiFetch` wrapper automatically:
- Throws on non-2xx responses
- Parses `ApiError` format
- TanStack Query handles errors globally via toast notifications

## Environment Variables

### Backend (.env at root)
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/morphdb
BETTER_AUTH_SECRET=<32+ character secret>
BETTER_AUTH_URL=http://localhost:3000
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173  # For CORS
```

### Frontend (apps/web/.env)
```bash
VITE_API_URL=http://localhost:3000
```

**Important**: Environment variables are validated at startup via `validateEnv()` in both API and Web.

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
