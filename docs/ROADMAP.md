# Roadmap & status

The master brief was received up to **section 6 (Student Portal)**; it was cut off at "View class…". Phase 1 implements sections 1–6 in full, plus the backend those sections depend on.

## Phase 1 — delivered

| Brief section | Status |
|---|---|
| 1. Technology stack | ✅ Next.js 16 / React 19 / Tailwind 4 / shadcn/ui / TanStack Query / Zustand / RHF + Zod · NestJS 11 / Prisma 6 / PostgreSQL / Redis / BullMQ / Socket.IO · Zoom Video SDK · R2/S3 |
| 2. Architecture | ✅ npm-workspace monorepo: `apps/web`, `apps/api`, `packages/{shared-types,shared-validation,config}`, `infrastructure`, `docs`; modular NestJS (controller/service/module/DTOs/guards per module) |
| 3. Roles & access control | ✅ 8 system roles, 39-permission catalogue, custom roles, backend-enforced guards, escalation protection, activate/deactivate/suspend, activity review, multi-academy & branch isolation. Admin UI: users, roles & permissions, teacher approvals |
| 4. Public website | ✅ All 19 pages, premium home, course landing pages, teacher profiles, testimonials, pricing, free-trial booking, contact form, WhatsApp button, metadata, OG, JSON-LD, sitemap, robots. Content served from the CMS API |
| 5. Authentication & registration | ✅ Student (guardian for minors), parent (multiple children, manage children), teacher (qualifications, certifications, languages, availability, photo & documents, admin approval). Email verification, password reset, refresh rotation, sessions, optional TOTP 2FA, login activity, suspension, approval workflow |
| 6. Student portal | ✅ Dashboard (welcome, upcoming, today's timetable, assigned teacher, active courses, completed classes, attendance %, progress, homework, recordings, notifications, announcements); profile; teacher details; join live classes; class detail; lessons; homework submission; recordings player; Quran progress |

Also delivered because sections 1–6 depend on them: live classroom (Zoom), class scheduling API, attendance, recordings import pipeline, homework/progress APIs for teachers, real-time notifications, audit log, parent child dashboards, Docker/VPS/Vercel deployment.

### Verified
- API: `tsc` clean, `nest build` succeeds, 20 unit tests pass (TOTP against RFC 6238 vectors, AES-GCM, permissions guard).
- Database: initial migration applied to PostgreSQL; seeder ran twice (idempotent); 27 service-level checks passed against the seeded database (dashboard maths, persona access rules, Hifz detection, escalation prevention, double-booking detection).
- Web: `tsc` clean; `next build` produces all 41 routes.
- **Not yet exercised end-to-end**: the running API with Redis (BullMQ, Socket.IO, cache), real SMTP, R2 uploads and a live Zoom session. Run `npm run infra:up` locally and add Zoom/R2 credentials to test these.

## Known gaps in Phase 1

- ~~CMS admin screens~~ — **done**: `/admin/cms` edits site settings (identity, logo, contact, WhatsApp, SEO defaults, homepage hero & stats, social links), CMS pages, courses & curricula, pricing, testimonials, FAQs and the blog (Markdown with preview, drafts, scheduling). Saves purge the public site's cache so changes are live immediately. Images are entered as URLs; an image library/uploader for public assets is not built yet.
- ~~Admin dashboard~~ — **done**: overview (KPIs, "needs attention" queue, weekly sign-ups and next-7-days charts, today's classes with attendance, recent sign-ups — all computed in the viewer's time zone and branch-scoped for branch managers), week-view schedule (schedule one-off or weekly series with teacher availability shown, reschedule, cancel, observe), enrolments (waiting queue + all enrolments, assign/change teacher, status), leads inbox (trial requests and contact messages, status workflow, internal notes, WhatsApp/email/call), announcements (audience, scheduling, expiry), audit log viewer, branches. Not yet: converting a trial lead directly into an account, bulk actions, CSV export, finance.
- ~~Teacher portal~~ — **done**: dashboard (today, upcoming, review queue, classes needing notes, monthly hours, 30-day attendance), schedule grouped by day, class workspace (start/join, attendance correction, private notes, per-student homework & progress), student roster and student pages (progress log, homework, upcoming classes), homework review queue (to review / waiting / overdue / reviewed, attachments), profile & weekly availability. Not yet: messaging parents/students, teacher-initiated rescheduling requests, earnings/payroll.

## Next phases (awaiting the rest of the brief)

Likely sections 7+ — please send the remainder of the master prompt so these match your spec exactly:

1. **Teacher portal** — schedule, start class, attendance marking, homework assignment & review, progress recording, availability, student notes.
2. **Parent portal** (extended) — per-child reports, messaging teachers, billing.
3. **Admin dashboard** — KPIs, scheduling calendar, enrollment management, leads inbox, CMS editor, announcements, audit log viewer, branch management.
4. **Billing & payments** — plans, invoices, Stripe/PayPal, family discounts, accountant views (permissions `finance.*` already exist).
5. **Reports & analytics**, messaging/chat, certificates, i18n (Arabic/Urdu RTL), mobile PWA.
