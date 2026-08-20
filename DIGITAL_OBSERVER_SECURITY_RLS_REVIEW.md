# Digital Observer Security and RLS Review

Date: 2026-08-20

## Decision

Static policy design: `PASS_STATIC_WITH_REMOTE_MIGRATION_REQUIRED`  
Remote runtime RLS: `NOT_ACCEPTED_YET`

The local migration expresses tenant isolation and safe column grants, but the configured remote Supabase project did not expose the new runtime tables/columns during normal-user QA. Static review is not a substitute for applying the migration and rerunning tests.

## Policy matrix

| Area | Protection found | Static result |
|---|---|---|
| Sites | Owner/member access through `can_access_observer_site` and `can_manage_observer_site` | PASS_STATIC |
| Organizations | Owner, member or admin read; owner/admin update | PASS_STATIC |
| Camera sources | Site-scoped RLS; client cannot submit live mode or a secret reference | PASS_STATIC |
| Known people | Site manager only; readiness/disabled only; no image path or biometric reference from client | PASS_STATIC |
| Event clips | Site-scoped read; no authenticated client insert/update/delete grant | PASS_STATIC |
| Notification delivery | Site-scoped; disabled/mock/sandbox writes only | PASS_STATIC |
| Packages | Active public read; admin mutation path with hard live gates | PASS_STATIC |
| Integration clients | Admin-only RLS; token hashes unavailable to ordinary clients | PASS_STATIC |
| Integration audit | Admin read, server insert, update/delete blocked by triggers | PASS_STATIC |
| Gan Batuach API | Server-only bearer hash, active client, scopes, kindergarten-bound site and no-store response | PASS_STATIC |

## Authentication and routing

- Normal Supabase password login was used for synthetic home, business and admin accounts.
- Protected routes call `requireUser`/`requireRole` with `/digital-observer/login` as the login destination.
- No arbitrary client-side user-id selection, impersonation, service-role browser use or route-guard weakening was introduced.
- Wrong-role Digital Observer admin access resolves to the standalone dashboard.

## Secrets scan

The scan covered tracked/untracked source and report text while excluding local ignored env files, generated mobile web assets, build output and screenshots. It looked for private-key headers, payment key patterns, service-role-like literal values and credential-bearing RTSP URLs.

No actual secret value was found. Two textual matches were documentation/schema field names (`supabase_service_role`, `self_service_role`), not credentials. Service-role environment variables are referenced by server-only helpers only. No password was written to reports or public assets.

## Runtime RLS evidence

`npm run qa:digital-observer-product` used normal Supabase user sessions:

- Home and business login: PASS.
- Standalone profile without garden: PASS.
- Own synthetic site visible: PASS.
- Foreign site hidden: PASS.
- Foreign legacy event hidden: PASS.
- New camera-source/known-person/clip/delivery and package checks: blocked because migration objects are absent remotely.

Result: 10/33 PASS, with the remaining checks failing on missing relation/column schema codes rather than an accepted RLS result.

## Required closure

1. Apply `supabase/migrations/20260820010000_digital_observer_product_runtime.sql` to project `gan-batuah`.
2. Confirm the PostgREST schema reload completes.
3. Rerun `npm run qa:digital-observer-product` with synthetic credentials only.
4. Require 33/33 before camera, AI, notification or billing sandbox activation.
5. Keep parent camera access as a separate Gan Batuach permission and session-token gate.
