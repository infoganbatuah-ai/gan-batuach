# Gan Batuach Production Deployment Checklist

Use this checklist before every production deployment. Do not place real secrets in the repository.

## 1. Build Gate

- Run `npm ci`.
- Run `npm run typecheck`.
- Run `npm run build`.
- If Docker is used, run `docker build -t gan-batuach .`.
- Confirm `.env*`, `.git`, `.next`, `node_modules`, logs, archives and exports are excluded from Docker/export contexts.

## 2. Environment Variables

- Copy `.env.example` into the deployment secret manager or `.env.production.local` for local Docker testing.
- Verify required public variables:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
- Verify required server-only variables:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_URL`
  - `AUTH_REDIRECT_URL`
  - `CRON_SECRET`
  - `HEALTHCHECK_SECRET`
  - `FIELD_ENCRYPTION_KEY`
- Verify optional integrations only when enabled:
  - `VIDEO_GATEWAY_URL`
  - `VIDEO_GATEWAY_SIGNING_SECRET`
  - `AI_GATEWAY_URL`
  - `AI_OBSERVER_SECRET`
  - `OPENAI_API_KEY`
  - `AI_PROVIDER_API_KEY`
- Confirm no server-only variable starts with `NEXT_PUBLIC_`.

## 3. Supabase Setup

- Run all migrations in `supabase/migrations` in timestamp order.
- Verify RLS is enabled on production tables.
- Create the first admin user in Supabase Auth.
- Set the matching `profiles.role` to `admin`.
- Verify auth redirect URL points to `/auth/callback`.
- Verify service role key exists only in server-side deployment configuration.

## 4. Storage Buckets

Create and verify private buckets:

- `profile-photos`
- `child-photos`
- `pickup-person-photos`
- `kindergarten-logos`
- `documents`
- `camera-snapshots`

Check:

- Uploads require authentication.
- Users can only upload/update files they are allowed to manage.
- Downloads are permission checked through the app or signed URLs.

## 5. Health Checks

- Open `/api/health`; expected `status: ok`.
- Open `/api/health/deep` with `x-health-secret`; expected `status: ok`.
- Confirm health responses do not expose secrets, tokens or raw credentials.

## 6. Role Smoke Tests

- Admin login opens `/dashboard/admin`.
- Manager/owner login opens `/dashboard/garden`.
- Staff login opens `/dashboard/staff`.
- Parent login opens `/dashboard/parent`.
- Inspector login opens `/dashboard/inspector`.
- Wrong-role direct URL access redirects or denies access.

## 7. Core Product Smoke Tests

- Public parent registration creates a lead.
- Manager approves parent lead and credentials are generated.
- Parent completes child profile with required photos.
- Manager approves child.
- Parent dashboard shows active child and kindergarten.
- Staff daily child update saves.
- Parent request routes to the intended recipient.
- Payment failed/not transferred status appears in finance and parent view.
- Camera permissions show only allowed cameras.
- Storage uploads work for child, parent, staff and kindergarten photos.

## 8. Camera Gateway

- Confirm camera credentials are encrypted and never shown after save.
- Confirm parents receive only playback tokens or safe playback URLs.
- Confirm `/api/camera-streams/[id]/playback-token` rechecks permission.
- If real gateway is enabled, verify `VIDEO_GATEWAY_URL` and `VIDEO_GATEWAY_SIGNING_SECRET`.
- If gateway is not enabled, cameras should show pending/waiting states.

## 9. Cron And Smart Engine

- Trigger monthly inspection cron with `x-cron-secret`.
- Trigger inspection reminder cron with `x-cron-secret`.
- Trigger AI observer ingestion only with `AI_OBSERVER_SECRET`.
- Verify smart insights dedupe and notification dedupe.

## 10. Monitoring And Logs

- Verify operational errors are logged.
- Verify logs do not contain passwords, service role keys, auth tokens, camera credentials or private stream URLs.
- Verify debug routes are removed or admin/secret protected.

## 11. Backup Readiness

- Confirm database backup schedule.
- Confirm storage bucket backup schedule.
- Confirm restore runbook in `BACKUP_AND_RESTORE.md`.
- Confirm a recent restore drill has been performed before production launch.

## 12. Final Release Gate

- No global error page appears in normal smoke tests.
- No raw SQL/Supabase error is shown to real users.
- No temporary diagnostics are visible to non-admin users.
- No production deployment is shipped until typecheck and build pass.

## 13. Mobile Packaging Gate

- Verify `MOBILE_APP_READINESS.md`.
- Set `CAPACITOR_SERVER_URL` to the production app URL before native sync.
- Confirm Android/iOS projects do not contain real secrets.
- Confirm native app opens the same web platform and redirects by role.
- Confirm login, logout, uploads, notifications and camera pages work in Android/iOS webviews.
