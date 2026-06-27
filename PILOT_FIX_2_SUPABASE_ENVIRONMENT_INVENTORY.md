# PILOT FIX 2 - Supabase Environment Inventory

Date: 2026-06-27

## Status

This inventory was produced from the local repository only. The target Supabase project was not reachable from this workspace through Supabase CLI or a direct database connection, so live RLS results remain manual.

## Environment Assumptions

| Area | Current finding | Pilot impact |
| --- | --- | --- |
| Local app | Next.js build and typecheck pass locally. | Good baseline, not RLS proof. |
| Local Supabase migrations | `supabase/migrations` exists with 160 SQL migration files. | Local migration corpus is available for review. |
| Supabase CLI | No `supabase` executable was detected in this shell. | Live migration status cannot be checked automatically here. |
| DB connection | No direct database connection was used. | SQL catalog verification must be run manually in Supabase SQL Editor or via CLI elsewhere. |
| Runtime env | `.env.local` is loaded by build, but secret values were not inspected or printed. | Env names only should be used in reports. |
| Staging/pilot Supabase | Not identifiable from repo alone. | `environment_separation_required` remains open. |
| Production Supabase | Not verified. | Real pilot remains blocked pending live RLS tests. |

## Relevant Env Names

Secret values were not printed. Names expected by code and reports include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYMENT_WEBHOOK_SECRET`
- `INVOICE_WEBHOOK_SECRET`
- `CRON_SECRET`
- `CAMERA_GATEWAY_SECRET`
- `CAMERA_TOKEN_SECRET`
- `AI_PROVIDER_API_KEY`

## Local Migration Groups

| Group | Representative files | Status |
| --- | --- | --- |
| Initial schema and base RLS | `20260523000000_initial_schema.sql` | Present locally. |
| Storage hardening | `20260602002000_security_hardening_rls_storage.sql` | Present locally; bucket public flags require live verification. |
| Parent RLS hardening | `20260616000100_parent_rls_scope_hardening.sql` | Present locally. |
| Payment/provider RLS hardening | `20260616000200_payment_provider_rls_scope_hardening.sql` | Present locally. |
| Provider webhooks/demo freeze | `20260627000100_prod1_provider_webhooks_demo_freeze_readiness.sql` | Present locally; previously fixed index-predicate style is safe in current file. |
| Camera readiness/security | `20260612014700_legal_camera_streaming_parent_viewing_anti_leak.sql`, `20260612016400_real_camera_gateway_dvr_nvr_home_pilot.sql` | Present locally; live token/storage behavior still manual. |
| AI/privacy governance | `20260612014900_ai_privacy_dpia_responsible_ai_governance.sql`, `20260612016500_real_ai_observer_pilot_shadow_calibration.sql` | Present locally; live visibility still manual. |
| Digital Observer separation | `20260612015100_digital_observer_core_extraction_vertical_capabilities.sql`, `20260612017300_digital_observer_standalone_shell_domain_multi_product.sql` | Present locally. |

## Sensitive Data Tables And Modules Known Locally

- `profiles`
- `parents`
- `children`
- `permanent_child_files`
- `child_parent_links`
- `parent_child_relations`
- `parent_kindergarten_links`
- `staff`
- `inspectors`
- `gardens`
- `attendance`
- `messages`
- `documents`
- `child_health_records`
- `child_daily_journals`
- `inspections`
- `inspection_reports`
- `incident_reports`
- `camera_streams`
- `video_stream_sessions`
- `camera_view_logs`
- `camera_playback_sessions`
- `ai_events`
- `ai_camera_events`
- `observer_*`
- `kindergarten_subscriptions`
- `subscription_payments`
- `provider_webhook_events`
- `audit_logs`
- `notifications`

## Storage Buckets Known Locally

Defined or referenced sensitive buckets:

- `documents`
- `child-photos`
- `profile-photos`
- `pickup-person-photos`
- `kindergarten-logos`
- `incident-photos`
- `inspection-reports`
- `gallery`

Expected status for pilot: all sensitive buckets private, signed URL only, short TTL, audited access.

## Auth And Role Helpers

| Helper | File | Finding |
| --- | --- | --- |
| Server Supabase client | `lib/supabase/server.ts` | Uses cookie-backed publishable-key server client. |
| Browser Supabase client | `lib/supabase/browser.ts` | Uses `NEXT_PUBLIC_SUPABASE_URL` and publishable key only. |
| Admin/service client | `lib/supabase/admin.ts` | Server-only helper by convention. Static scan found no client component importing it directly. |
| Role/session guard | `lib/auth.ts` | Provides `requireUser`, `requireRole`, `requirePermission`. |
| Role permissions | `lib/roles.ts` | Broad role permission map; must be paired with RLS/object ownership tests. |

## Signed URL Logic

`app/api/storage/upload/route.ts` uses server-side service role for upload and signed URL creation.

Current TTL constants:

- sensitive documents/evidence: `10 * 60` seconds
- logos/gallery preview: `15 * 60` seconds

This is aligned with the target policy, but live storage policy and unauthorized signed URL attempts remain manual verification.

## Manual Verification Required

Because this workspace cannot query the target Supabase catalog, the following are still required before real pilot:

- confirm all required migrations were applied remotely
- confirm RLS is enabled on sensitive tables
- confirm effective policies match expectations
- run positive and negative test users through SQL Editor or a safe test harness
- confirm storage bucket `public=false` for sensitive buckets
- confirm signed URL generation is denied for unauthorized objects

