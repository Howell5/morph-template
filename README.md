# Morph Template

A production-ready, type-safe full-stack SaaS monorepo template with end-to-end type safety, built-in monetization, monitoring, and i18n.

[![GitHub](https://img.shields.io/badge/GitHub-Howell5%2Fmorph--template-blue?logo=github)](https://github.com/Howell5/morph-template)

## Features

- **End-to-End Type Safety**: Hono `AppType` + `hono/client` — zero manual type definitions across API boundary
- **Monorepo**: pnpm workspaces + Turborepo for efficient builds and caching
- **Authentication**: Better Auth with email/password (dev) + Google & GitHub OAuth (production)
- **Three-Pool Credits**: Daily/subscription/bonus credits with full audit trail
- **Stripe Payments**: Subscription plans + one-time credit packages + webhook handling
- **Task Queue**: pg-boss (PostgreSQL-based) — background jobs, retries, cron scheduling, no Redis
- **AI Integration**: OpenRouter SDK — unified access to 300+ LLMs (streaming + image generation)
- **File Upload**: Cloudflare R2 with presigned URLs for direct frontend upload
- **i18n**: i18next with Chinese/English support, browser language detection, localStorage persistence
- **Production Monitoring**: Sentry error tracking, pino structured logging, business alerting webhooks
- **Admin System**: Role-based admin routes for user search, credit grants, feedback management
- **Referral System**: Viral growth with anti-fraud (IP limits, monthly caps, self-referral prevention)
- **Feedback Collection**: User bug reports and feature requests with rate limiting
- **Bot Protection**: Cloudflare Turnstile (optional in dev)
- **Email**: Resend transactional emails (optional in dev)
- **UI**: shadcn/ui (16+ components) + Tailwind CSS + collapsible sidebar + modal system

## Project Structure

```
morph-template/
├── apps/
│   ├── api/                    # Backend (Hono + Drizzle + Better Auth + pg-boss)
│   │   ├── src/
│   │   │   ├── routes/         # API routes (checkout, orders, user, chat, admin, ...)
│   │   │   ├── jobs/           # pg-boss job handlers (AI generation, cleanup)
│   │   │   ├── db/             # Drizzle schema + connection
│   │   │   ├── lib/            # Service singletons (stripe, r2, ai, queue, sentry, logger, ...)
│   │   │   ├── auth.ts         # Better Auth configuration
│   │   │   ├── env.ts          # Environment variable validation
│   │   │   └── index.ts        # Main app (exports AppType)
│   │   └── drizzle.config.ts
│   └── web/                    # Frontend (React + Vite + TanStack Query)
│       ├── src/
│       │   ├── components/     # UI (shadcn/ui), modals, layout, landing
│       │   ├── providers/      # Paywall, Pricing, Settings, Sidebar, Feedback, Referral
│       │   ├── i18n/           # i18next initialization
│       │   ├── pages/          # Dashboard, pricing, login, etc.
│       │   ├── lib/            # API client, auth, upload utils
│       │   └── main.tsx        # Entry point + Sentry init
│       └── vite.config.ts
├── packages/
│   └── shared/                 # Shared Zod schemas, configs, i18n, locales
└── scripts/                    # Build utilities
```

## Quick Start

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Docker (for PostgreSQL)

### 1. Clone and Install

```bash
git clone git@github.com:Howell5/morph-template.git
cd morph-template
pnpm install
```

### 2. Environment Variables

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**Backend** (`apps/api/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Secure random string (min 32 chars) |
| `BETTER_AUTH_URL` | Yes | API base URL (e.g. `http://localhost:3000`) |
| `FRONTEND_URL` | No | Frontend URL for CORS (default: `http://localhost:5173`) |
| `GOOGLE_CLIENT_ID` / `SECRET` | No | Google OAuth (optional in dev) |
| `GITHUB_CLIENT_ID` / `SECRET` | No | GitHub OAuth (optional in dev) |
| `STRIPE_SECRET_KEY` | No | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | No | Stripe webhook signing secret |
| `OPENROUTER_API_KEY` | No | OpenRouter AI API key |
| `R2_ACCOUNT_ID` | No | Cloudflare R2 (4 vars needed for file uploads) |
| `TURNSTILE_SECRET_KEY` | No | Cloudflare Turnstile bot protection |
| `RESEND_API_KEY` | No | Resend email service |
| `SENTRY_DSN` | No | Sentry error tracking |
| `ALERT_WEBHOOK_URL` | No | Slack/Lark webhook for business alerts |

**Frontend** (`apps/web/.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | No | Backend URL (default: `http://localhost:3000`) |
| `VITE_SENTRY_DSN` | No | Sentry frontend error tracking |

Generate a secret:
```bash
openssl rand -base64 32
```

### 3. Start Database

```bash
pnpm docker:up     # Start PostgreSQL
pnpm db:push       # Create tables
```

### 4. Start Development

```bash
pnpm dev            # API on :3000, Web on :5173
```

A test account (`test@test.com` / `password123`) is auto-seeded in development mode.

## Common Commands

```bash
pnpm dev              # Start all apps
pnpm build            # Build for production
pnpm check            # Lint + format (Biome)
pnpm check:lines      # Verify all files < 500 lines

pnpm db:push          # Push schema to database
pnpm db:studio        # Open Drizzle Studio
pnpm docker:up        # Start PostgreSQL
pnpm docker:down      # Stop PostgreSQL
```

## Architecture

### RPC-Style Type Safety

```typescript
// Backend exports AppType
export type AppType = typeof app;

// Frontend automatically knows all request/response types
const response = await api.api.posts.$get();
const json = await response.json(); // Fully typed!
```

### Shared Validation

Zod schemas in `packages/shared` are the single source of truth:
1. Define in `packages/shared/src/schemas/`
2. Backend validates with `zValidator('json', schema)`
3. Frontend validates with `zodResolver(schema)`

### Credits System

Three-pool system (consumption priority: daily → subscription → bonus):
- **Daily**: 50/day, expires at UTC midnight
- **Subscription**: Based on tier, resets on renewal
- **Bonus**: From purchases/referrals/admin grants, never expire

### Payments

- **Subscriptions**: Free, Starter ($12/mo), Pro ($24/mo), Max ($240/mo)
- **Credit Packages**: Small (100/$5), Medium (250/$10), Large (600/$20)
- Stripe Checkout + Webhooks + Billing Portal

### Frontend Modal System

Provider-based architecture with paywall interception:
- `PaywallProvider` — intercepts API paywall errors → opens `PricingModal`
- `SettingsModal` — 4 tabs: Account, Preferences, Billing, Usage
- `FeedbackModal` / `ReferralModal` — accessible from sidebar and header

### Monitoring

- **Sentry**: Frontend + backend error tracking
- **pino**: Structured JSON logging with child loggers per module
- **Health check**: `GET /health` with DB latency, R2/AI status
- **Business alerts**: Webhook-based (Slack/Lark) for AI quota, payment failures

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health with dependency status |
| `/api/auth/*` | * | Better Auth (login, register, OAuth) |
| `/api/posts` | GET/POST | Posts CRUD |
| `/api/checkout` | POST | Credit package checkout |
| `/api/checkout/subscription` | POST | Subscription checkout |
| `/api/checkout/manage` | POST | Stripe billing portal |
| `/api/orders` | GET | Order history (paginated) |
| `/api/webhooks/stripe` | POST | Stripe webhook handler |
| `/api/user/me` | GET/PATCH | User profile + credits |
| `/api/user/usage-history` | GET | Credit usage records |
| `/api/upload/presign` | POST | R2 presigned upload URL |
| `/api/chat` | POST | AI chat (streaming SSE + image gen) |
| `/api/tasks` | POST/GET | Task submission + status |
| `/api/admin/*` | * | Admin: users, credits, feedback |
| `/api/referral/*` | * | Referral code, stats, history |
| `/api/feedback` | POST | User feedback submission |

## Production Deployment

### Zeabur (Recommended)

1. **PostgreSQL**: Add from Zeabur Marketplace
2. **API**: Deploy `apps/api`, set env vars (use `${postgres.DATABASE_URL}`)
3. **Web**: Deploy `apps/web`, set `VITE_API_URL`
4. **Migrations**: Run `pnpm db:push` from API console

**Estimated cost**: ~$10/month (PostgreSQL + API container, Web is static)

### Optional: Monitoring Services

- **Sentry** (Free tier): Set `SENTRY_DSN` + `VITE_SENTRY_DSN`
- **Uptime Kuma** (~$5/mo on Zeabur): External health monitoring + status page
- **Slack/Lark webhook**: Set `ALERT_WEBHOOK_URL` for business alerts

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web Framework | [Hono](https://hono.dev/) |
| Database | [PostgreSQL](https://www.postgresql.org/) + [Drizzle ORM](https://orm.drizzle.team/) |
| Auth | [Better Auth](https://www.better-auth.com/) |
| Payments | [Stripe](https://stripe.com/docs) |
| Task Queue | [pg-boss](https://github.com/timgit/pg-boss) |
| AI | [OpenRouter SDK](https://openrouter.ai/docs) |
| File Storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) |
| Frontend | [React](https://react.dev/) + [Vite](https://vitejs.dev/) |
| Data Fetching | [TanStack Query](https://tanstack.com/query) |
| UI Components | [shadcn/ui](https://ui.shadcn.com/) + [Tailwind CSS](https://tailwindcss.com/) |
| i18n | [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/) |
| Error Tracking | [Sentry](https://sentry.io/) |
| Logging | [pino](https://getpino.io/) |
| Email | [Resend](https://resend.com/) |
| Linting | [Biome](https://biomejs.dev/) |
| Monorepo | [Turborepo](https://turbo.build/) |

## License

MIT
