# API reference

Base URL: `https://api.yourdomain.com/api/v1`. Interactive OpenAPI docs: `/docs` (enabled outside production, or with `SWAGGER_ENABLED=true`).

Authentication: `Authorization: Bearer <accessToken>`. The refresh token travels only as the `qa_rt` httpOnly cookie — send requests with credentials.

Errors: `{ statusCode, message, code? }`. Notable codes: `EMAIL_TAKEN`, `ACCOUNT_PENDING_VERIFICATION`, `ACCOUNT_PENDING_APPROVAL`, `ACCOUNT_SUSPENDED`, `ACCOUNT_LOCKED`, `TOKEN_INVALID`, `OUTSIDE_JOIN_WINDOW`, `DUPLICATE`, `NOT_FOUND`, `IN_USE`.

Legend: 🌐 public · 🔑 any signed-in user · 🛡 permission required · 👤 role required

## Auth
| Method | Path | Access | Description |
|---|---|---|---|
| POST | `/auth/register/student` | 🌐 | Student registration (guardian required under 18) |
| POST | `/auth/register/parent` | 🌐 | Parent registration with 0–10 children |
| POST | `/auth/register/teacher` | 🌐 | Teacher application → returns a 2-hour `uploadToken` |
| POST | `/auth/register/teacher/documents/upload-url` · `/confirm` | 🌐 (uploadToken) | Attach photo / certificates / CV / ID |
| POST | `/auth/verify-email` · `/auth/resend-verification` | 🌐 | Email verification |
| POST | `/auth/login` | 🌐 | Returns tokens, or `{ twoFactorRequired, challengeToken }` |
| POST | `/auth/login/2fa` | 🌐 | Complete login with TOTP code |
| POST | `/auth/refresh` | 🌐 (cookie) | Rotate refresh token, new access token |
| POST | `/auth/logout` | 🌐 (cookie) | Revoke current session |
| POST | `/auth/forgot-password` · `/auth/reset-password` | 🌐 | Password reset |
| POST | `/auth/change-password` | 🔑 | Signs out other devices |
| GET | `/auth/me` · `/auth/sessions` · `/auth/login-activity` | 🔑 | Current user, devices, sign-in history |
| DELETE | `/auth/sessions/:id` | 🔑 | Sign out a device |
| POST | `/auth/2fa/setup` · `/2fa/enable` · `/2fa/disable` | 🔑 | TOTP management |

## Users & access
| Method | Path | Access |
|---|---|---|
| PATCH | `/users/me` | 🔑 |
| GET | `/users` (search, status, role, branch, paging) · `/users/:id` | 🛡 `users.read` |
| POST | `/users` (sends set-password email) | 🛡 `users.create` |
| PATCH | `/users/:id` | 🛡 `users.update` |
| PATCH | `/users/:id/status` (`ACTIVE`/`INACTIVE`/`SUSPENDED`) | 🛡 `users.suspend` |
| PATCH | `/users/:id/roles` | 🛡 `roles.manage` + `users.update` |
| DELETE | `/users/:id` (soft delete) | 🛡 `users.delete` |
| GET | `/users/:id/login-activity` · `/activity` · `/sessions` | 🛡 `users.activity` |
| DELETE | `/users/:id/sessions` | 🛡 `users.suspend` |
| GET | `/roles` · `/roles/permissions` | 🛡 `roles.read` |
| POST / PATCH / DELETE | `/roles`, `/roles/:id` | 🛡 `roles.manage` |
| GET | `/audit-logs` | 🛡 `audit.read` |
| GET | `/admin/overview` (KPIs, action items, trends — viewer's time zone, branch-scoped) | 🛡 `students.read` + `classes.read` |
| GET | `/enrollments?status&studentId&teacherId&courseId&search` · `/enrollments/awaiting` | 🛡 `students.read` |
| GET/POST/PATCH | `/academies` | 🛡 `academies.manage` (Super Admin) |
| GET · POST/PATCH | `/branches` | 🛡 `branches.read` · `branches.manage` |

## Teachers & parents
| Method | Path | Access |
|---|---|---|
| GET | `/teachers/public` | 🌐 |
| GET/PATCH | `/teachers/me`, PUT `/teachers/me/availability` | 👤 teacher |
| GET | `/teachers/me/dashboard` · `/teachers/me/students` · `/teachers/me/students/:studentId/courses` | 👤 teacher (own data only) |
| PATCH | `/classes/:id/notes` | 🛡 `classes.teach` (class teacher) |
| GET | `/teachers/applications?status=` | 🛡 `teachers.read` |
| PATCH | `/teachers/:id/review` (`APPROVED`/`REJECTED`) | 🛡 `teachers.approve` |
| PATCH | `/teachers/:id/publish` | 🛡 `teachers.manage` |
| GET/POST | `/parents/me/children` | 👤 parent |
| PATCH | `/parents/me/children/:childId` | 👤 parent |
| POST | `/parents/me/children/:childId/enable-login` | 👤 parent |
| GET | `/parents/me/children/:childId/dashboard` | 👤 parent |

## Students & learning
`:studentId` accepts `me`. Access: the student, a linked parent, a teacher of the student, or staff with `students.read` in the same academy.

| Method | Path | Access |
|---|---|---|
| GET | `/students/me/dashboard` · `/students/me/profile` | 👤 student |
| GET | `/students/:id/profile` | as above |
| GET | `/students/:studentId/homework` · `/progress` · `/recordings` | as above |
| GET | `/me/courses` · `/me/lessons/:id`, POST `/me/lessons/:id/complete` | 👤 student |
| POST | `/homework` | 🛡 `homework.assign` (must teach the student) |
| GET | `/homework/teaching` | 🛡 `homework.review` |
| POST | `/homework/:id/submit` | 🔑 (own homework) |
| PATCH | `/homework/:id/review` | 🛡 `homework.review` (own assignment) |
| GET | `/homework/submissions/:id/attachment` | access-checked signed URL |
| POST | `/progress` | 🛡 `progress.record` (must teach the student) |
| GET | `/recordings/:id/url` | access-checked signed URL |
| GET | `/announcements/feed` | 🔑 |
| GET/POST/DELETE | `/announcements` | 🛡 `announcements.manage` |

## Courses & classes
| Method | Path | Access |
|---|---|---|
| GET | `/public/courses` · `/public/courses/:slug` | 🌐 |
| GET | `/courses` · `/courses/:id` (with lessons, incl. unpublished) | 🛡 `courses.read` |
| POST/PATCH/DELETE | `/courses`, `/courses/:id`, `/courses/:id/lessons[/:lessonId]` | 🛡 `courses.manage` |
| POST · PATCH | `/enrollments` · `/enrollments/:id` | 🛡 `enrollments.manage` |
| GET | `/classes?scope=upcoming\|past&from&to&status&teacherId&studentId` | 🔑 persona-scoped |
| GET | `/classes/:id` | participant, teacher or staff |
| POST | `/classes` (`repeatWeeks` for a weekly series) | 🛡 `classes.manage` |
| PATCH · POST | `/classes/:id/reschedule` · `/classes/:id/cancel` | 🛡 `classes.manage` |
| POST | `/classes/:id/join` | participant/teacher/staff, inside join window → Zoom token |
| POST | `/classes/:id/start` · `/end` | 🛡 `classes.teach` (class teacher) |
| PATCH | `/classes/:id/attendance` | 🛡 `attendance.mark` |
| POST | `/webhooks/zoom` | Zoom (HMAC signature) |

## Website CMS & leads
| Method | Path | Access |
|---|---|---|
| GET | `/public/site` · `/public/pages/:slug` · `/public/testimonials` · `/public/faqs` · `/public/pricing` · `/public/blog[/:slug]` | 🌐 |
| POST | `/public/trial-bookings` · `/public/contact` | 🌐 (3/min, honeypot) |
| GET · PUT | `/cms/pages` · `/cms/pages/:slug` | 🛡 `cms.manage` |
| GET · PUT | `/cms/settings` · `/cms/settings/:key` | 🛡 `cms.manage` |
| CRUD | `/cms/testimonials`, `/cms/faqs`, `/cms/pricing`, `/cms/blog` | 🛡 `cms.manage` |
| GET · PATCH | `/leads/trial-bookings[/:id]`, `/leads/contact-messages[/:id]` | 🛡 `leads.read` · `leads.manage` |

## Files & notifications
| Method | Path | Access |
|---|---|---|
| GET | `/documents` | 🔑 own |
| POST | `/documents/upload-url` · `/documents/confirm` | 🔑 |
| GET | `/documents/:id/url` | owner, parent, or staff with read permission |
| DELETE | `/documents/:id` | owner |
| GET | `/notifications?unread=&cursor=` | 🔑 |
| POST | `/notifications/read` (`ids` or all) | 🔑 |

## WebSocket
Namespace `/realtime`, handshake `auth: { token }`. Server events: `notification:new`, `notification:read`, `class:status`, `announcement:new`.

## Health
`GET /health` (no prefix) → `{ status, database, redis }`, 503 when a dependency is down.
