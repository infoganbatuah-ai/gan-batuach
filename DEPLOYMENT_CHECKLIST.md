# Gan Batuach Production Deployment Checklist

## 1. Runtime

- Install Node.js with npm available in the deployment environment.
- Run `npm install` to create `node_modules` and `package-lock.json`.
- Run `npm audit --audit-level=moderate`.
- Run `npm run typecheck`.
- Run `npm run build`.
- Run `npm start` only after a successful build.

## 2. Environment Variables

Set all variables from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `CRON_SECRET`
- `AI_OBSERVER_SECRET`
- `VIDEO_GATEWAY_URL`
- `VIDEO_GATEWAY_SIGNING_SECRET`
- `FIELD_ENCRYPTION_KEY`

Production requirements:

- `SUPABASE_SERVICE_ROLE_KEY` must exist only on the server.
- `FIELD_ENCRYPTION_KEY` must be a long random secret and must not change after production data is encrypted.
- Cron, AI observer and video gateway secrets must be different values.

## 3. Supabase

- Create a Supabase project.
- Run migrations in order:
  1. `supabase/migrations/20260523000000_initial_schema.sql`
  2. `supabase/migrations/20260523001000_production_engines.sql`
  3. `supabase/migrations/20260523002000_complete_operational_modules.sql`
- Verify RLS is enabled on production tables.
- Create the first admin user in Supabase Auth.
- Update the matching `profiles` row to role `admin`.
- Verify the private `camera-snapshots` storage bucket exists.

## 4. Auth And RBAC

- Verify `/login` authenticates through Supabase Auth.
- Verify `/dashboard` redirects by role:
  - `admin`
  - `inspector`
  - `manager`
  - `staff`
  - `parent`
- Verify every API route is protected by RBAC, RLS, a service secret, or explicit public lead insertion.

## 5. Production Engines

- Trigger `POST /api/cron/monthly-inspections` with `x-cron-secret`.
- Trigger `POST /api/cron/inspection-reminders` with `x-cron-secret`.
- Submit an inspection through `POST /api/inspections/:id/submit`.
- Confirm scores 1-4 create violations and correction tasks.
- Confirm weighted average below 8 moves a garden into `unsafe_gardens`.
- Confirm AI observer events below threshold are suppressed.
- Confirm AI observer cooldown prevents duplicate incident storms.
- Confirm video gateway health checks create camera incidents for unhealthy streams.

## 6. Camera Gateway

- Configure the external video gateway URL.
- Connect DVR/NVR/RTSP/ONVIF devices through `/api/video-gateway/*`.
- Confirm RTSP credentials are encrypted in `video_gateway_connections`.
- Confirm parents receive temporary HLS/WebRTC playback tokens only.
- Confirm every viewing session writes to `video_stream_sessions` and `camera_view_logs`.

## 7. Final Release Gate

- No legacy static files remain.
- No static Node server remains.
- No browser-storage application flow remains.
- No duplicate API routing exists.
- No production table is missing from migrations.
- No build is shipped before dependency audit, typecheck and production build pass.

## Required For Admin Provisioning

- `SUPABASE_SERVICE_ROLE_KEY` must be configured in Vercel Environment Variables for server-only admin provisioning.
- Required for: creating Auth users, converting leads, creating managers, owners and inspectors.
- Do not expose this key to client code. Do not use `NEXT_PUBLIC_`.
- If missing, admin user-creation pages will show a setup warning and final creation will fail gracefully.

## Camera And AI Gateway

- `VIDEO_GATEWAY_URL` is required for real live camera playback and RTSP/ONVIF conversion to HLS/WebRTC.
- `VIDEO_GATEWAY_SIGNING_SECRET` should be configured when the gateway signs playback sessions.
- `AI_GATEWAY_URL` is required for live AI observer analysis. Without it, AI configuration can be saved but live AI is shown as pending.
