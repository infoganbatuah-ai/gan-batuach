# Architecture

## Stack

- Next.js App Router
- React Server Components
- TypeScript
- Supabase Auth
- Supabase PostgreSQL
- Supabase Row Level Security
- API Routes as backend-for-frontend

## Auth Flow

1. User signs in at `/login`.
2. Supabase Auth creates/returns a session.
3. `profiles.role` determines RBAC role.
4. `/dashboard` redirects by role:
   - `admin` -> `/dashboard/admin`
   - `inspector` -> `/dashboard/inspector`
   - `manager` -> `/dashboard/garden`
   - `staff` -> `/dashboard/staff`
   - `parent` -> `/dashboard/parent`
5. `proxy.ts` refreshes Supabase auth cookies.

## RBAC

Roles and permission mapping live in:

```text
lib/roles.ts
```

Server guards live in:

```text
lib/auth.ts
```

Database enforcement lives in Postgres RLS policies:

```text
supabase/migrations/20260523000000_initial_schema.sql
```

## Garden Onboarding

1. Public or admin creates a `leads` record of type `garden`.
2. Admin reviews the lead.
3. Admin calls:

```text
POST /api/admin/create-garden-manager
```

4. The route creates:
   - Supabase Auth user for the manager
   - `profiles` row with role `manager`
   - `gardens` row
   - manager-to-garden relationship
   - `audit_logs` event

## Parent And Child Registration

1. Manager creates or invites a parent in `parents`.
2. Parent completes child profile in `children`.
3. Child status remains pending until manager approval.
4. Manager updates `children.status` to active.
5. Attendance, pickup permissions, documents and messages are linked by `garden_id` and `child_id`.

## Inspection Flow

1. Admin manages `inspection_forms` and `inspection_form_questions`.
2. `POST /api/cron/monthly-inspections` calls `create_monthly_inspection_tasks`.
3. The DB creates monthly `tasks` and `inspections` for every active garden with an inspector.
4. Inspector submits answers to `POST /api/inspections/:id/submit`.
5. `submit_inspection_with_answers` verifies GPS, stores answers and calculates weighted score.
6. Scores 1-4 create `violations` and correction `tasks`.
7. Average below 8 or critical failure updates `gardens.safe_status` to `requires_fix`.
8. Every submission and violation is written to `incident_timeline`.

## Camera And AI Flow

1. Camera definitions live in `camera_streams`.
2. Parents never receive RTSP/DVR credentials.
3. Parent permissions live in `parent_camera_permissions`.
4. `POST /api/camera-streams/:id/playback-token` creates a temporary token and `video_stream_sessions`.
5. Views are logged to `camera_view_logs`.
6. Snapshots are stored in `camera_snapshots`.
7. AI rules live in `ai_observer_rules`.
8. External AI engines call `POST /api/ai/observe`.
9. AI detections are stored in `ai_events`.
10. Alerts are stored in `ai_alerts`.
11. Every incident writes to `incident_timeline`.
12. Critical AI events create treatment `tasks`.
13. Stream health checks from the video gateway create camera incidents for black screen, frozen stream, offline camera, covered camera, frame loss and latency.

Supported observer events include violence, child alone, restricted area, cry, staff absence, child outside allowed zone, overcrowding, sleeping anomaly, fall, no movement and panic movement.

## Deployment Checklist

1. Install packages.
2. Create Supabase project.
3. Run all migrations in `supabase/migrations` in order.
4. Configure environment variables.
5. Create first admin user.
6. Run typecheck and build.
7. Deploy to Vercel or a Node host.
8. Set Supabase Auth redirect URL to `/auth/callback`.

## Admin Operations

Admin is the operational control center:

- `mandatory_procedures` for required procedures.
- `campaigns` for operational campaigns and notices.
- `report_exports` for PDF/XLSX/CSV export jobs.
- `notifications` for push notices.
- `tasks`, `task_view_logs`, escalation fields and `incident_timeline` for traceability.

## Parent Operations

Parent modules are exposed under `/api/parent/*` and map to production tables:

- child profile -> `children`
- messages -> `messages`
- complaints -> `complaints`
- inspector contact -> `gardens.inspector_id`
- live cameras -> `parent_camera_permissions` and playback tokens
- pickup confirmation -> `pickup_confirmations`
- notifications -> `notifications`
- timeline -> `incident_timeline`
- medical info -> `medical_events`
- gallery -> `gallery_items`
- schedule -> `schedule_items`
- attendance -> `attendance`

## Staff Operations

Staff modules:

- GPS attendance -> `staff_shifts`
- background checks and police clearance -> `staff`, `documents`
- certificates -> `staff_certificates`
- monthly reports and shift analytics -> `staff_shifts`, `attendance`, `report_exports`
