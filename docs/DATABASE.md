# Database

PostgreSQL 15+ with Prisma 6. Schema: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). Initial migration: `apps/api/prisma/migrations/20261120000000_init`.

> **The database must use UTF-8 encoding.** Content includes Arabic text and symbols such as ﷺ. The official Docker image and managed providers default to UTF-8; a database created on Windows with `initdb` defaults may use WIN1252 — create it with `ENCODING 'UTF8' TEMPLATE template0`.

## Conventions

- IDs are `cuid()` strings.
- All timestamps are stored in UTC. Users and branches carry an IANA `timezone` used only for display and "today" calculations.
- Tenant-owned tables carry `academyId` with an index starting with `academyId`.
- Secrets are never stored in plain text: passwords (Argon2id), refresh/verification tokens (SHA-256), TOTP secrets (AES-256-GCM).
- Users are soft-deleted (`deletedAt`) and their PII anonymised, so historical classes and audit records remain intact.
- Money is stored in minor units (`priceMonthly` in cents) with an ISO currency code.

## Entity groups

### Tenancy
`Academy` 1—* `Branch`. Most other entities reference `Academy`.

### Identity & access
| Table | Notes |
|---|---|
| `User` | One row per person. `email` is nullable for young children managed by a parent. `status` drives the account workflow. Lockout counters, 2FA fields. |
| `Role` | `academyId = null` → platform system role. Unique on `(academyId, slug)`. |
| `Permission` | Seeded catalogue, unique `key`. |
| `RolePermission`, `UserRole` | Join tables. |
| `Session` | One per signed-in device; revocable. |
| `RefreshToken` | Hashed, rotated tokens within a session; `usedAt` enables reuse detection. |
| `VerificationToken` | Email verification and password reset. |
| `LoginActivity` | Every sign-in attempt, successful or not. |
| `AuditLog` | Who did what to which entity, with redacted request metadata. |

### Profiles
`StudentProfile` (DOB, guardian details, preferred course/timing, assigned teacher), `ParentProfile`, `ParentChild` (parent ↔ child links), `TeacherProfile` (qualifications, certifications, languages, approval state, public listing flag), `TeacherAvailability` (weekly slots in the teacher's zone), `Document` (private files).

### Learning
| Table | Notes |
|---|---|
| `Course` / `CourseLesson` | Catalogue and ordered curriculum. Category enum covers Qaida, Reading, Hifz, Tajweed, Islamic Studies, Kids, Arabic. |
| `Enrollment` / `LessonProgress` | Student ↔ course with an optional teacher; lesson completion drives course progress %. |
| `ClassSession` | Scheduled live class with a unique Zoom session name; status `SCHEDULED → LIVE → COMPLETED` (or `CANCELLED` / `MISSED`). |
| `ClassAttendee` | Student per class with attendance status and join/leave times. |
| `Recording` | Imported Zoom recording in private storage; idempotent on `externalId`. |
| `Homework` / `HomeworkSubmission` | Assignment, submissions with optional attachment, grade and feedback. |
| `QuranProgress` | Teacher-recorded portions (surah + ayah range, or Qaida lesson), type, rating, notes. Surah ayah counts are validated (total 6,236). |

### Communication
`Notification` (per-user, read state), `Announcement` (audience = list of role slugs; empty = everyone; optional expiry).

### Website & leads
`CmsPage` (slug, SEO fields, ordered JSON section blocks), `BlogPost`, `Testimonial`, `Faq`, `PricingPlan`, `SiteSetting` (key → JSON: `site`, `contact`, `whatsapp`, `social`, `seo`, `home`, `footer`), `TrialBooking`, `ContactMessage`.

## Key indexes

- `User(academyId, status)`, `User(status)`, `User(branchId)`
- `ClassSession(academyId, startsAt)`, `(teacherId, startsAt)`, `(status, startsAt)` — schedule views and scheduler sweeps
- `ClassAttendee(studentId, status)` — attendance statistics
- `Notification(userId, readAt, createdAt)` — unread counts and feeds
- `Homework(studentId, status)`, `(teacherId, status)`
- `LoginActivity(userId, createdAt)`, `(email, createdAt)`; `AuditLog(academyId, createdAt)`, `(entity, entityId)`

## Migrations & seeding

```bash
npm run db:migrate   # dev: create a migration from schema changes
npm run db:deploy    # CI/prod: apply pending migrations
npm run db:seed      # idempotent
```

The seeder upserts permissions and system roles (preserving admin changes to existing role permission sets, but always granting new permissions to Super Admin), creates the default academy and HQ branch, a Super Admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, and starter website content. `SEED_DEMO=true` adds demo users, an enrollment, classes, homework and progress.
