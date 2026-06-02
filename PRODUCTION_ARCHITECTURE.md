# Gan Batuach Production Architecture

Gan Batuach is a Next.js application backed by Supabase. Production can run on Vercel or in a Docker container.

## Runtime Options

### Vercel

- Recommended for the current web application runtime.
- Uses the same Next.js build path as local production.
- Environment variables are configured in Vercel project settings.
- Cron routes must be protected by `CRON_SECRET`.

### Docker

- `Dockerfile` builds the Next.js app and runs `npm start`.
- Runtime installs production dependencies only.
- `.dockerignore` excludes local builds, secrets, archives and development artifacts.
- `docker-compose.yml` supports a production-like local run using `.env.production.local`.
- Optional reverse proxy placeholder is available under the `proxy` compose profile.

## Core Services

- Web app: Next.js App Router
- Database: Supabase Postgres
- Auth: Supabase Auth
- Storage: Supabase Storage
- Scheduled jobs: protected Next.js API routes or platform cron
- Camera playback: app-managed permission checks plus optional external Video Gateway
- Smart insights: deterministic smart engine with optional external AI gateway

## Supabase

Supabase owns:

- Auth users and sessions
- Role/profile records
- Kindergarten, child, parent, staff and inspector data
- Payments, requests, notifications, inspections and incidents
- RLS policies for tenant isolation

Production requirements:

- Run migrations in timestamp order.
- Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
- Verify RLS before launch.
- Verify tenant isolation for manager, staff, inspector and parent roles.

## Storage Buckets

Private buckets:

- `profile-photos`
- `child-photos`
- `pickup-person-photos`
- `kindergarten-logos`
- `documents`
- `camera-snapshots`

Uploads go through authenticated app flows. Sensitive files should not be public.

## Video Gateway

The app prepares for this architecture:

RTSP / ONVIF / DVR / NVR -> Video Gateway -> HLS/WebRTC -> Browser

The app is responsible for:

- Camera inventory
- Camera permission checks
- Playback token creation
- Hiding RTSP URLs and credentials
- Viewing session logs

The external gateway is responsible for:

- Connecting to physical cameras
- Converting streams
- Reporting health
- Serving browser-safe playback URLs

## Smart Engine And AI

The deterministic smart engine analyzes real system data and creates insights. If `AI_GATEWAY_URL` or an external AI provider is missing, the app must continue to work with rule-based summaries.

AI must not invent facts. Facts come from system data and the smart engine.

## Health And Monitoring

Routes:

- `/api/health`: public basic app and Supabase connectivity check.
- `/api/health/deep`: protected by `HEALTHCHECK_SECRET`; checks key tables with server-side access.

Logging rules:

- Log operational failures.
- Do not log passwords, service role keys, auth tokens, camera credentials or private playback URLs.
- Keep detailed diagnostics development-only or admin/secret protected.

## Cron And Background Jobs

Protected routes:

- `/api/cron/monthly-inspections`
- `/api/cron/inspection-reminders`
- `/api/ai/observe`

Required secrets:

- `CRON_SECRET`
- `AI_OBSERVER_SECRET`

## Deployment Flow

1. Configure environment variables.
2. Run migrations.
3. Verify storage buckets.
4. Run typecheck and build.
5. Run health checks.
6. Run role smoke tests.
7. Enable cron jobs.
8. Monitor logs after release.

## Future Infrastructure

Future dedicated services can be added without changing the app boundary:

- Video gateway service
- AI observer gateway
- Background worker service
- PDF/report rendering service
- Central log and metrics collector
