# Deployment

```
www.yourdomain.com ─┐
app.yourdomain.com ─┴─ Vercel (apps/web)
api.yourdomain.com ──── VPS: Caddy (TLS) → NestJS API ─┬─ PostgreSQL
                                                     ├─ Redis (BullMQ, cache)
                                                     ├─ Cloudflare R2 (private bucket)
                                                     └─ Zoom Video SDK + webhooks
```

## 1. Cloudflare R2 (or AWS S3)

1. Create a **private** bucket (no public access, no custom public domain).
2. Create an API token with *Object Read & Write* for that bucket.
3. Add a CORS rule so browsers can upload with presigned URLs:
   ```json
   [{ "AllowedOrigins": ["https://app.yourdomain.com", "https://www.yourdomain.com"],
      "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["Content-Type"], "MaxAgeSeconds": 3600 }]
   ```
4. API env: `STORAGE_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com`, `STORAGE_REGION=auto`, `STORAGE_BUCKET`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`. For S3, leave `STORAGE_ENDPOINT` empty and set the real region.

## 2. Zoom Video SDK

1. In the Zoom App Marketplace create a **Video SDK** app → copy SDK Key/Secret to `ZOOM_VIDEO_SDK_KEY` / `ZOOM_VIDEO_SDK_SECRET`.
2. Enable **cloud recording** on the Video SDK account.
3. Event subscriptions → endpoint `https://api.yourdomain.com/api/v1/webhooks/zoom`, secret token → `ZOOM_WEBHOOK_SECRET_TOKEN`. Subscribe to `session.started`, `session.ended`, `session.user_joined`, `session.user_left`, `session.recording_completed`. Zoom validates the URL automatically (`endpoint.url_validation` is handled).

## 3. API on a VPS (Docker)

Ubuntu 22.04+, 2 vCPU / 4 GB RAM is a comfortable start.

```bash
git clone <repo> && cd quran-academy
cp apps/api/.env.example apps/api/.env      # production values (below)
# edit infrastructure/docker/Caddyfile → your API domain
export POSTGRES_PASSWORD=... REDIS_PASSWORD=...
docker compose -f infrastructure/docker/docker-compose.prod.yml --env-file apps/api/.env up -d --build
# first deploy only:
docker compose -f infrastructure/docker/docker-compose.prod.yml exec api node seed-dist/seed.js
```

The container runs `prisma migrate deploy` on start. Caddy obtains TLS certificates automatically and proxies WebSockets.

Production `.env` essentials:

```
NODE_ENV=production
APP_URL=https://app.yourdomain.com
PUBLIC_SITE_URL=https://www.yourdomain.com
CORS_ORIGINS=https://app.yourdomain.com,https://www.yourdomain.com
COOKIE_DOMAIN=.yourdomain.com
TRUST_PROXY_HOPS=1            # Caddy; use 2 if Cloudflare proxy is also in front
JWT_ACCESS_SECRET / JWT_CHALLENGE_SECRET   # 48+ random bytes each
DATA_ENCRYPTION_KEY                         # 32 random bytes, base64 — back this up; losing it disables everyone's 2FA
SMTP_*                                      # Postmark, SES, Mailgun, …
```

Managed alternatives work unchanged: point `DATABASE_URL` at a managed PostgreSQL (UTF-8) and `REDIS_URL` at managed Redis (`rediss://` enables TLS).

**Backups**: schedule `pg_dump` (or provider snapshots) daily; R2 holds files and recordings.

**Scaling out**: run more API containers behind the proxy and add `@socket.io/redis-adapter` to the gateway. BullMQ job schedulers already run once across instances.

## 4. Web on Vercel

1. Import the repository; set **Root Directory** to `apps/web`. Vercel detects npm workspaces.
2. Build command: `cd ../.. && npm run build:packages && cd apps/web && next build`. Install command: `cd ../.. && npm install`.
3. Environment variables: `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`, `NEXT_PUBLIC_SITE_URL=https://www.yourdomain.com`.
4. Add domains `www.yourdomain.com` and `app.yourdomain.com` to the same project (redirect the apex to `www`).

The refresh cookie is set for `.yourdomain.com` with `SameSite=Lax`, which works because `app.`/`www.` and `api.` are the same site.

## 5. DNS

| Record | Target |
|---|---|
| `www`, `app` | Vercel (CNAME `cname.vercel-dns.com`) |
| `api` | VPS IP (A/AAAA) |

## 6. Go-live checklist

- [ ] Strong secrets set; `.env` not committed
- [ ] Super Admin seeded, then `SEED_ADMIN_PASSWORD` removed from the environment
- [ ] Super Admin enables 2FA
- [ ] SMTP verified (SPF, DKIM, DMARC on the sending domain)
- [ ] R2 bucket private, CORS restricted to your origins
- [ ] Zoom webhook URL validated
- [ ] `GET https://api.yourdomain.com/health` returns `ok`
- [ ] Website content reviewed in the CMS (contact details, WhatsApp number, pricing, legal pages)
- [ ] Database backups scheduled
