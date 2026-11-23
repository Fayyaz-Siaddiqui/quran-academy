# Quran Academy — International Online Quran Academy & LMS

A production-grade platform for running an online Quran academy: a public marketing website with a full CMS, separate student / parent / teacher registration, role-based administration, live one-to-one classes on Zoom Video SDK, recordings in private storage, homework, attendance and ayah-by-ayah Quran progress tracking.

| App | Stack | Deploys to |
|---|---|---|
| `apps/web` | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui, TanStack Query, Zustand, React Hook Form + Zod | Vercel — `www.yourdomain.com` and `app.yourdomain.com` |
| `apps/api` | NestJS 11, Prisma 6, PostgreSQL, Redis, BullMQ, Socket.IO, Zoom Video SDK, Cloudflare R2 / S3 | VPS (Docker) — `api.yourdomain.com` |
| `packages/shared-types` | Roles, permission catalogue, API contracts | — |
| `packages/shared-validation` | Zod schemas shared by every form | — |
| `packages/config` | Platform constants and base `tsconfig` | — |

## Quick start (local)

Prerequisites: Node.js ≥ 20.11, Docker (for PostgreSQL, Redis and a local mail inbox).

```bash
npm install                     # installs all workspaces, generates the Prisma client
npm run infra:up                # PostgreSQL :5432, Redis :6379, Mailpit :8025
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# Fill JWT_ACCESS_SECRET, JWT_CHALLENGE_SECRET, DATA_ENCRYPTION_KEY and SEED_ADMIN_PASSWORD in apps/api/.env
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # JWT secrets
#   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"      # DATA_ENCRYPTION_KEY
npm run build:packages
npm run db:deploy               # apply migrations
SEED_DEMO=true npm run db:seed  # permissions, roles, super admin, website content (+ demo users)
npm run dev:api                 # http://localhost:4000  (Swagger: /docs)
npm run dev:web                 # http://localhost:3000
```

With `SEED_DEMO=true`, you can sign in as `student@demo.local`, `teacher@demo.local` or `parent@demo.local` (password `DemoPass12345`), or as the super admin from `SEED_ADMIN_EMAIL`.

Emails (verification, password reset) are printed to the API console when `SMTP_HOST` is empty, or delivered to Mailpit at http://localhost:8025 with `SMTP_HOST=localhost SMTP_PORT=1025`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` | Build packages, API and web |
| `npm run typecheck` | Type-check every workspace |
| `npm test` | Unit tests |
| `npm run db:migrate` | Create a new migration from schema changes (dev) |
| `npm run db:deploy` | Apply migrations (CI / production) |
| `npm run db:seed` | Idempotent seeder — safe on every deploy |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — modules, request lifecycle, auth & RBAC, tenancy, real-time, jobs
- [Database](docs/DATABASE.md) — entity model and conventions
- [API](docs/API.md) — endpoint reference (live OpenAPI at `/docs`)
- [Deployment](docs/DEPLOYMENT.md) — Vercel, VPS, R2, Zoom, DNS
- [Roadmap & status](docs/ROADMAP.md) — what is built and what comes next
