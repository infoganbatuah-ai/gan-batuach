# Gan Batuach - Post-Migration Critical Blockers Closure

Date: 2026-08-20  
Supabase project declared by Daniel: `gan-batuah`  
Data used: synthetic only

## Original blockers

| Blocker | Verification | Result |
|---|---|---|
| Digital Observer membership policy recursion | `observer_sites` / memberships reads with QA network manager | CLOSED; no `42P17` |
| Browser-readable camera credential columns | direct select attempts by 9 QA roles | CLOSED; all denied with `42501`; no values exposed |
| Browser access to camera snapshot Storage | temporary synthetic sentinel list/download attempts by 9 QA roles | CLOSED; sentinel hidden and download denied for all roles; cleanup PASS |

## Full role-boundary run

- Login: 9 PASS, 0 FAIL.
- Security assertions: 9 PASS, 0 FAIL.
- Camera credential values visible: none.
- Parent raw AI rows: 0.
- Unassigned parent/staff/inspector sensitive rows: 0.
- Provider health rows outside admin: 0.
- Assigned fixtures and inspector assignment states: PASS.

Evidence: `qa-evidence/gan-batuach-completion-audit-1/role-boundary-probes.json`.

## Camera snapshot Storage closure

The old migration `20260523001000_production_engines.sql` granted broad authenticated access to the `camera-snapshots` Storage bucket. Daniel applied the remediation:

`supabase/migrations/20260820000100_camera_snapshot_storage_privacy_hardening.sql`

The first probe treated a successful empty Storage list as browser access. That interpretation was insufficient because Supabase Storage may return an empty list when RLS hides every object. The probe was corrected to create one temporary synthetic one-pixel sentinel with the server-only service client, attempt exact list and download operations through each normal browser role, and remove the sentinel in `finally`.

Remote result:

- 9/9 browser roles could not list the sentinel.
- 9/9 browser roles could not download the sentinel.
- sentinel cleanup: PASS.
- no service-role key was sent to a browser client or written to the report.

Safe runtime defaults remain active:

- `CAMERA_SNAPSHOT_STORAGE_RLS_VERIFIED=false`.
- snapshot API POST is blocked.
- AI snapshot ingestion is blocked.
- live cameras and parent viewing remain disabled.

## Acceptance command and result

`npm run qa:probe-role-boundaries`

Result: 9 login PASS and 9 assertion PASS. `CAMERA_SNAPSHOT_STORAGE_RLS_VERIFIED` remains disabled by default; it may be enabled only in an approved non-production camera test environment when Test Gateway/frame work begins.

## Decision

`ALL_THREE_IDENTIFIED_CRITICAL_SECURITY_BLOCKERS_CLOSED_REMOTE_ROLE_AND_STORAGE_PROBES_PASS`
