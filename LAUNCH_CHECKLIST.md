# Gan Batuach Launch Checklist

Use this checklist for the final pilot launch gate. Do not launch until every required item is checked in the production environment.

## Before Launch

- Run all migrations in `supabase/migrations` in timestamp order.
- Verify `.env.example` has been copied into the deployment secret manager with real values.
- Verify required public env vars:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  - `NEXT_PUBLIC_APP_URL`
- Verify required server-only env vars:
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `APP_URL`
  - `AUTH_REDIRECT_URL`
  - `CRON_SECRET`
  - `HEALTHCHECK_SECRET`
  - `FIELD_ENCRYPTION_KEY`
- Verify optional integration env vars only when enabled:
  - `VIDEO_GATEWAY_URL`
  - `VIDEO_GATEWAY_SIGNING_SECRET`
  - `AI_GATEWAY_URL`
  - `AI_OBSERVER_SECRET`
  - `OPENAI_API_KEY`
  - `AI_PROVIDER_API_KEY`
- Verify Supabase Auth redirect URL points to `/auth/callback`.
- Verify the first admin user exists and has `profiles.role = admin`.
- Verify test/demo users are separated from production users.
- Verify RLS is enabled and role policies are active.
- Verify upload permissions and storage policies.
- Verify private storage buckets exist:
  - `profile-photos`
  - `child-photos`
  - `pickup-person-photos`
  - `kindergarten-logos`
  - `documents`
  - `camera-snapshots`
- Verify backup and restore plan in `BACKUP_AND_RESTORE.md`.
- Verify deployment checklist in `DEPLOYMENT_CHECKLIST.md`.
- Verify mobile packaging plan in `MOBILE_APP_READINESS.md`.

## Public Route Smoke Test

- `/`
- `/gardens`
- `/gardens/[id]`
- `/join-parent`
- `/join-kindergarten`
- `/login`

For each route:

- Page loads.
- No global crash.
- No debug text.
- No raw Supabase/SQL errors.
- Primary CTA navigates or submits a real flow.

## Dashboard Route Smoke Test

- `/dashboard/admin`
- `/dashboard/garden`
- `/dashboard/parent`
- `/dashboard/staff`
- `/dashboard/inspector`

For each dashboard:

- Correct role can access.
- Wrong role is blocked or redirected.
- Greeting/identity appears.
- Notification entry point appears.
- No temporary diagnostics are visible.
- No raw internal ids are shown to regular users.

## Role Smoke Test

Parent:

- Login redirects to `/dashboard/parent`.
- Parent sees only own children.
- Parent sees only assigned kindergarten data.
- Parent cannot access manager/staff/inspector/admin dashboards.

Manager / Owner:

- Login redirects to `/dashboard/garden`.
- Manager sees only assigned kindergarten data.
- Owner sees only assigned kindergartens.
- Manager cannot access other kindergarten children, parents, cameras or finance.

Staff:

- Login redirects to `/dashboard/staff`.
- Staff sees assigned kindergarten.
- Staff cannot access finance/admin routes.
- Staff child actions are limited to assigned kindergarten.

Inspector:

- Login redirects to `/dashboard/inspector`.
- Inspector sees only assigned kindergartens.
- Inspector cannot see unrelated children/parents.

Admin:

- Login redirects to `/dashboard/admin`.
- Admin can access admin QA/audit pages.
- Admin debug tools remain protected.

## Critical Flow Smoke Test

Parent:

- Register from public kindergarten page.
- Manager receives lead.
- Manager approves parent.
- Temporary credentials are generated.
- Parent first login shows child completion task.
- Parent completes child profile with required photos.
- Manager approves child.
- Parent dashboard shows active child and kindergarten.
- Parent sends request/message.
- Parent opens cameras page.
- Parent uploads required/requested document.

Manager / Owner:

- Dashboard loads.
- Leads page loads.
- Approve/reject/request-info actions work.
- Pending child approval works.
- Active children list loads.
- Active parents list loads.
- Finance page loads with filters.
- Camera page loads and add form is collapsed by default.
- Messages/requests inbox loads.
- Insights page loads.

Staff:

- Dashboard loads.
- Settings/profile loads.
- Child quick update saves.
- Task status update saves.
- Incident report saves.
- Documents page loads.

Inspector:

- Dashboard loads.
- Assigned kindergartens appear.
- Inspections list loads.
- Inspection report route loads.
- Violations list loads.
- Camera page shows assigned cameras only.

Admin:

- Dashboard loads.
- Users page loads.
- Gardens/kindergartens pages load.
- Inspectors page loads.
- Reports page loads.
- Inspections pages load.
- Audit pages load:
  - mobile audit
  - camera audit
  - smart engine audit
  - user journey audit
  - duplicates
  - system health

## Production Security Smoke Test

- `/api/debug/parent-camera-access` requires admin.
- `/api/health` is public and does not expose secrets.
- `/api/health/deep` requires `x-health-secret`.
- Upload API checks authentication, role and bucket.
- Service role key is server-only and never starts with `NEXT_PUBLIC_`.
- Camera playback token route rechecks permission.
- Parent camera page does not expose RTSP, credentials, service role, RLS, raw debug reasons or raw ids.
- Debug logs are disabled in production.
- Storage buckets are private unless explicitly documented otherwise.

## Mobile Smoke Test

Check these widths:

- 360px
- 390px
- 414px
- 768px

Routes:

- `/login`
- `/join-parent`
- `/parent-onboarding`
- `/dashboard/parent`
- `/dashboard/garden`
- `/dashboard/staff`
- `/dashboard/inspector`
- `/dashboard/parent/cameras`
- `/dashboard/garden/finance`
- `/dashboard/garden/children`
- `/dashboard/garden/messages`

Verify:

- No horizontal scroll.
- Bottom navigation is reachable.
- Forms are usable.
- Primary buttons are visible and large enough.
- Cards are readable.
- Upload fields open a picker on mobile.

## Health And Deployment Checks

- `/api/health` returns `status: ok`.
- `/api/health/deep` returns `status: ok` with `x-health-secret`.
- Docker build succeeds if Docker deployment is used.
- CI runs `npm ci`, `npm run typecheck`, `npm run build`.
- Backup plan exists.
- Restore drill has been scheduled before full production rollout.

## Known Not Included In V1

- Real Video Gateway service.
- Real RTSP/ONVIF/DVR/NVR ingest.
- Real push notifications through FCM/APNs.
- Native App Store / Google Play release.
- External AI camera analysis.
- Payment gateway / salika integration if not separately implemented.
- Native secure-storage auth bridge for Capacitor.
- Real-time production monitoring integration beyond health endpoints and platform logs.

## Final Pilot Decision

Ready for pilot only when:

- Typecheck passes.
- Production build passes.
- Public route smoke test passes.
- Role smoke test passes.
- Critical flow smoke test passes.
- Security smoke test passes.
- Health checks pass.
- Backups are configured.
- Remaining V1 exclusions are accepted by the launch owner.
