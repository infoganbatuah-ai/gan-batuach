# Gan Batuach Production Readiness Report

Generated on 2026-05-23.

## Executive Status

Status: ready for dependency installation, Supabase migration, typecheck and production build.

The project now uses only the Next.js + TypeScript architecture. Legacy static files were removed from the workspace.

## Cleanup Verification

Removed:

- legacy static HTML entry
- legacy browser script
- legacy static stylesheet
- legacy static Node server
- legacy root asset folder
- legacy screenshot folder
- macOS metadata files

Verification:

- No legacy static server file remains.
- No old static routing entry remains.
- No browser-storage application logic remains.
- No sample application flow remains in production code.
- Runtime assets remain only under `public/assets`.

## Routing Integrity

Result: pass.

- API route files: 59.
- Duplicate API route keys: 0.
- Next.js pages are under `app`.
- Auth callback is under `app/auth/callback/route.ts`.
- Role dashboards are under `app/dashboard/*`.

## Supabase Schema Consistency

Result: pass by static migration inspection.

Migration objects created or altered: 44.

Covered domains:

- gardens, children, parents, teachers, staff, inspectors
- tasks, inspections, inspection forms, inspection questions, inspection answers
- violations, messages, complaints, leads, documents, attendance
- camera streams, camera view logs, video sessions, gateway connections
- AI events, AI alerts, observer rules, incident timeline
- notifications, procedures, campaigns, report exports
- staff certificates, staff shifts, medical events, pickup confirmations
- audit logs and rate limit events

RLS and policy coverage:

- RLS statements and policy/function checks found across migrations.
- Garden-scoped access uses `can_access_garden`.
- Admin access uses `is_admin`.
- Parent camera access uses `can_parent_view_camera`.

## API Consistency

Result: pass by static route/table scan.

Core APIs exist for all requested production entities:

- Gardens
- Children
- Parents
- Teachers
- Staff
- Inspectors
- Tasks
- Inspections
- InspectionForms
- Inspection form questions
- Violations
- Messages
- Complaints
- Leads
- Documents
- Attendance
- CameraStreams
- AIEvents
- AuditLogs

Specialized APIs exist for:

- monthly inspections
- inspection reminders
- inspection submit
- unsafe gardens
- task view logs
- task escalation
- parent portal modules
- staff GPS attendance
- video gateway
- AI observer

## RBAC Review

Result: pass by static guard scan.

Auth and permission logic:

- Role mapping lives in `lib/roles.ts`.
- Server guards live in `lib/auth.ts`.
- CRUD routes call `requirePermission`.
- Admin-only actions call `requireRole(["admin"])`.
- Inspector/admin inspection submit is explicitly guarded.
- Cron, AI observer and video gateway service routes require shared secrets.

Public write surface:

- `POST /api/leads` intentionally allows public insert for garden and parent leads.

## Inspection Engine

Result: implemented.

Implemented:

- dynamic inspection forms
- dynamic question API
- question types: score, boolean, photo upload, document upload, text note
- categories: Safety, Staff, Kitchen, Health, Infrastructure, Emergency, Training, Parents, Cameras, Documentation
- critical flag
- weight value
- mandatory questions
- GPS verification before submit
- weighted score engine
- scores 1-4 or configured threshold create violations
- automatic correction task creation
- incident timeline writes
- unsafe garden list via `unsafe_gardens`
- safe badge removal timeline event when score is under 8 or critical failure exists

## Monthly Automation

Result: implemented.

Implemented:

- monthly inspection task generation by city inspector
- cron-protected route
- reminders at 7 days, 3 days and 24 hours
- overdue marking
- notification creation

External scheduler required:

- Configure Vercel Cron, Supabase Edge Scheduler, GitHub Actions, or another production scheduler to call the cron endpoints.

## Camera Modules

Result: implemented as application-side production gateway contract.

Implemented:

- DVR/NVR/RTSP/ONVIF connection APIs
- encrypted credential storage
- RTSP ingestion contract
- HLS/WebRTC playback URLs through video gateway
- temporary playback tokens
- parent camera permission checks
- viewing sessions
- camera audit logs
- stream health checks
- black screen, frozen stream, offline, covered camera, frame loss and latency incident creation

External service required:

- A real video gateway service must run behind `VIDEO_GATEWAY_URL`.

## AI Observer Engine

Result: implemented as real event pipeline.

Implemented event types:

- violence detection
- child alone detection
- restricted area detection
- cry detection
- staff absence detection
- child outside allowed zone
- overcrowding
- sleeping anomaly
- fall detection
- no movement
- panic movement
- camera covered
- camera disconnected

Pipeline features:

- threshold enforcement
- cooldown enforcement
- confidence storage
- snapshot storage references
- incident timeline
- AI alerts
- critical task creation

External model required:

- The AI model or video analytics worker must call `POST /api/ai/observe`.

## Task Engine

Result: implemented.

Implemented:

- task CRUD
- automatic inspection tasks
- automatic violation correction tasks
- emergency tasks
- task viewed logging
- viewed timestamp tracking
- escalation function
- completion fields
- incident-linked tasks

## Dependency Audit

Result: blocked for live vulnerability scan in this local environment.

Observed:

- `npm` is not installed or not available on PATH.
- `node_modules` does not exist.
- `package-lock.json` does not exist.
- All 13 package versions currently use `latest`, which is not acceptable for final production release.

Required before deployment:

- Install npm or another approved package manager.
- Replace `latest` dependency specs with pinned versions.
- Generate a lockfile.
- Run `npm audit --audit-level=moderate`.
- Run `npm run typecheck`.
- Run `npm run build`.

## Remaining Production Gate

Do not deploy until:

- Dependencies are pinned.
- Lockfile is generated.
- Vulnerability audit passes or documented exceptions are approved.
- Typecheck passes.
- Next.js production build passes.
- Supabase migrations are applied to a clean database.
- A real video gateway and AI observer service are configured.
