# Architecture

## Monorepo layout

```
quran-academy/
├─ apps/
│  ├─ web/                 Next.js — public website, auth, student/parent/teacher/admin portals, live classroom
│  └─ api/                 NestJS — REST API, WebSocket gateway, background workers
│     ├─ prisma/           schema.prisma, migrations/, seed.ts
│     └─ src/
│        ├─ common/        decorators, guards, interceptors, filters, utils
│        ├─ config/        environment validation (Joi)
│        ├─ prisma/        PrismaService
│        ├─ redis/         shared ioredis client
│        └─ modules/       one folder per domain module (below)
├─ packages/
│  ├─ shared-types/        roles, permission catalogue, default role grants, API contracts
│  ├─ shared-validation/   Zod schemas used by web forms
│  └─ config/              constants (token TTLs, upload limits, socket events) + base tsconfig
├─ infrastructure/docker/  dev & prod compose files, API Dockerfile, Caddyfile
└─ docs/
```

npm workspaces link packages; shared packages compile to CommonJS in `dist/` so both NestJS and Next.js consume them identically.

## API modules

| Module | Responsibility |
|---|---|
| `access` | Resolves a user's roles, permissions and status (Redis-cached, 60 s); tenant scoping helpers; session-revocation blocklist |
| `auth` | Registration (student / parent / teacher), email verification, login with lockout, TOTP 2FA, refresh-token rotation, sessions, password reset/change |
| `users` | Admin user management: list/search, create, update, activate/deactivate/suspend, role assignment, login activity, audit trail, session revocation |
| `roles` | Role CRUD and permission assignment with escalation protection |
| `tenancy` | Academies (Super Admin) and branches |
| `teachers` | Application review (approve/reject), public faculty list, availability, profile |
| `parents` | Children: list, add, edit, enable a child's own login, child dashboard |
| `students` | Student dashboard aggregate and profile |
| `courses` | Public catalogue, admin course/lesson CRUD, enrollments, lesson completion |
| `classes` | Scheduling (with conflict detection and weekly series), persona-scoped listing, Zoom join tokens, start/end, attendance, Zoom webhooks, scheduler jobs |
| `learning` | Homework (assign/submit/review), Quran progress, recordings, announcements |
| `cms` | Public read endpoints for website content; admin CMS for pages, settings, testimonials, FAQs, pricing, blog; leads (free trials, contact) |
| `notifications` | Persisted in-app notifications + Socket.IO gateway |
| `storage` | Private R2/S3 storage, presigned upload/download, document ownership checks |
| `mail` | BullMQ-queued transactional email with HTML templates |
| `audit` | Append-only audit log + `@Audit()` interceptor |

## Request lifecycle

```
Request → ThrottlerGuard → JwtAuthGuard → PermissionsGuard → ValidationPipe → Controller → Service → Prisma
                                                                                  ↘ AuditInterceptor (on success)
```

1. **ThrottlerGuard** — global 120 req/min/IP; auth and public-form routes are tighter (3–10/min).
2. **JwtAuthGuard** (global) — every route requires a valid access token unless marked `@Public()`. It re-reads the user's status and permissions from the Redis-backed `AccessService` on every request, so suspensions and role changes take effect within seconds rather than at token expiry. Revoked sessions are blocked via a Redis blocklist.
3. **PermissionsGuard** (global) — enforces `@RequirePermissions(...)` (all required) and `@RequireRoles(...)` (any). Super Admin bypasses.
4. **Services** enforce *ownership and tenancy* — e.g. a parent may only read their linked children, a teacher only students they teach, staff only rows in their academy (and branch, for branch managers).

The frontend hides UI the user cannot use, but **no authorization decision is made in the browser**.

## Authentication

- **Passwords**: Argon2id (`@node-rs/argon2`). Login runs a dummy hash for unknown emails to prevent user enumeration by timing. 8 failed attempts lock the account for 15 minutes.
- **Access token**: HS256 JWT, 15 minutes, carries only `sub` (user id) and `sid` (session id). Held in memory on the client — never in `localStorage`.
- **Refresh token**: 48-byte opaque random value in an `httpOnly`, `Secure`, `SameSite=Lax` cookie scoped to `/api/v1/auth`. Only its SHA-256 hash is stored. It **rotates on every refresh**; presenting an already-used token is treated as theft and revokes the whole session. Rotation is atomic, so concurrent refreshes cannot both succeed; the web client also single-flights refreshes.
- **2FA**: RFC 6238 TOTP, secrets encrypted at rest with AES-256-GCM (`DATA_ENCRYPTION_KEY`). Login returns a 5-minute challenge token when 2FA is on.
- **Verification & reset tokens**: single-use, hashed, expiring (48 h / 60 min); issuing a new one invalidates older ones.
- **Account workflow**: `PENDING_VERIFICATION → ACTIVE` for students and parents; teachers go `PENDING_VERIFICATION → PENDING_APPROVAL → ACTIVE` (or `REJECTED`). Admins can set `ACTIVE / INACTIVE / SUSPENDED`; any non-active status revokes all sessions immediately.
- Password change/reset signs out other devices.

## Role-based access control

- Permissions are a fixed catalogue (`packages/shared-types/src/permissions.ts`), keyed `module.action`.
- **System roles** (Super Admin, Academy Admin, Branch Manager, Teacher, Student, Parent, Accountant, Support Staff) are seeded with defaults, cannot be deleted or renamed, and only a Super Admin may change their permission sets. Super Admin always holds every permission.
- **Custom roles** belong to one academy. They can be deleted only when no user holds them.
- **Escalation protection**: a non-Super-Admin can only grant permissions they hold, can only assign roles whose permissions are a subset of their own, and cannot modify a Super Admin.
- Permission caches are invalidated whenever a role's permissions or a user's roles/status change.

## Multi-academy & branches (tenancy)

- Tenant-owned rows carry `academyId` (and `branchId` where relevant); every query is scoped through `TenantService.academyId(auth)`.
- Only Super Admins can act on another academy, and only by explicitly sending `X-Academy-Id`.
- Branch managers are automatically restricted to their branch.
- Anonymous traffic (website, registration) resolves the academy from `X-Academy` (slug) or `DEFAULT_ACADEMY_SLUG`. A single-academy deployment needs no configuration.

## Live classes (Zoom Video SDK)

1. Admin schedules a class → a unique, random Zoom session name is generated per class.
2. Within the join window (default 10 min before start until the end), a participant calls `POST /classes/:id/join`. The API checks access and returns a short-lived Video SDK JWT: **host** for the class teacher, **participant** for students/parents/supervisors. `user_key` = our user id.
3. The browser joins with `@zoom/videosdk` (`/classroom/[id]`).
4. Zoom webhooks (`/api/v1/webhooks/zoom`, HMAC-verified, replay-protected) mark the class live/ended and record join/leave times → attendance (late after 10 min).
5. `session.recording_completed` enqueues a BullMQ job that **streams the MP4 from Zoom into private R2/S3** (multipart). Students then get 15-minute signed URLs.

## Background jobs (BullMQ on Redis)

| Queue | Jobs |
|---|---|
| `mail` | Transactional email; 5 attempts with exponential back-off |
| `recordings` | Import Zoom cloud recordings into private storage; idempotent per Zoom file id |
| `class-scheduler` | Every minute: 15-minute class reminders (idempotent via Redis `SET NX`). Every 5 min: mark missed classes, auto-complete abandoned live classes |

Job schedulers are stored in Redis, so they run exactly once across multiple API instances.

## Real-time

Socket.IO namespace `/realtime`. Clients authenticate with their access token in the handshake and join `user:<id>` and `academy:<id>` rooms. Events: `notification:new`, `notification:read`, `class:status`, `announcement:new`. The web app shows a toast and invalidates the relevant TanStack Query caches.

For more than one API instance, add `@socket.io/redis-adapter` so emits reach sockets on every node.

## File storage

Private bucket only. Uploads are two-step: `POST /documents/upload-url` validates type/size and returns a presigned PUT (15 min) for an unguessable key; after upload, `POST /documents/confirm` records the document — only for keys the API issued to that user. Downloads go through an ownership/permission check before a signed GET URL is issued.

## Frontend

- **Route groups**: `(site)` public website, `(auth)` login/registration, `(portal)` authenticated area, `/classroom/[id]` full-screen live class.
- **Public content** is fetched server-side from the CMS API with 5-minute ISR (cache tag `cms`). If the API is unreachable, bundled defaults render so the marketing site never goes blank.
- **CMS editor** (`/admin/cms`): after every save the browser calls the web app's `POST /api/revalidate` with the editor's access token; the route confirms `cms.manage` via the API's `/auth/me` and expires the `cms` tag, so edits are live immediately.
- **SEO**: per-page metadata, canonical URLs, Open Graph/Twitter cards, JSON-LD (`EducationalOrganization`, `Course`, `FAQPage`, `BlogPosting`), `sitemap.xml`, `robots.txt` (portals disallowed and `noindex`).
- **Security headers**: CSP (allowing Zoom's SDK assets/WASM), HSTS, `nosniff`, strict referrer, permissions policy; COOP/COEP on the classroom for Zoom's SharedArrayBuffer path.
- **Session**: on first load the app silently calls `/auth/refresh`; the portal shell redirects to `/login?next=…` if there is no session. `next` accepts same-origin paths only.
- All times are displayed in the viewer's IANA time zone.
- **Day/week/month boundaries** (dashboards, "today", charts) are computed in `apps/api/src/common/utils/time.ts` with calendar arithmetic and per-date midnight resolution — never by adding 24 h — so buckets stay correct across DST transitions (23 h / 25 h days). Covered by `time.spec.ts`.
- **Chart colour**: charts use `--chart-1` (validated with the dataviz palette checks for chroma, lightness band and contrast in both themes), not `--primary`, which reads grey as a fill.
