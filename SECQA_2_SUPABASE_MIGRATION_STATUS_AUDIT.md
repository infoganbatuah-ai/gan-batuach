# SECQA 2 Supabase Migration Status Audit

Date: 2026-06-27
Branch: main
Latest commit checked: e91b177 TECHQA 1 – Full Technical Regression After Final UX/UI Rescue

## Scope

- Supabase migration files scanned: 159.
- Latest hardening migrations verified:
  - `20260616000100_parent_rls_scope_hardening.sql`
  - `20260616000200_payment_provider_rls_scope_hardening.sql`
- No destructive SQL was run.
- No live Supabase catalog query was run from this environment.
- Manual Supabase execution status is not stored in the repository; every security-sensitive migration below still requires Supabase-side verification unless the user has separate deployment evidence.

## Recent Migration Summary

| Migration | Purpose | RLS | Payments | Storage/Documents | Reportedly run in Supabase | Manual verification required | Risk if not applied |
|---|---|---:|---:|---:|---|---|---|
| `20260612014700_legal_camera_streaming_parent_viewing_anti_leak.sql` | Parent camera viewing and anti-leak readiness. | yes | no | camera/session metadata | not documented in repo | yes | Parent camera access may not enforce full child/policy/session controls. |
| `20260612014800_legal_attendance_parent_identity_pickup_compliance.sql` | Attendance, pickup, identity and signature compliance. | yes | no | signatures/evidence | not documented in repo | yes | Pickup/attendance records may lack legal/audit safeguards. |
| `20260612014900_ai_privacy_dpia_responsible_ai_governance.sql` | AI privacy, DPIA and responsible AI governance. | yes | no | AI/event evidence | not documented in repo | yes | AI visibility rules may rely only on UI wording. |
| `20260612015300_medical_sensitive_data_field_encryption.sql` | Medical and sensitive data encryption readiness. | yes | no | child/medical fields | not documented in repo | yes | Medical fields may not be encrypted/scoped as expected. |
| `20260612015400_immutable_audit_trail_evidence_logs_worm_readiness.sql` | Immutable audit trail/evidence logs. | yes | no | evidence/audit | not documented in repo | yes | Audit evidence may be mutable or incomplete. |
| `20260612015500_mandatory_mfa_identity_hardening_trusted_device.sql` | MFA/trusted-device hardening readiness. | yes | no | identity/security metadata | not documented in repo | yes | High-risk evidence/report actions may not require MFA readiness. |
| `20260612015600_data_rights_retention_deletion_right_to_be_forgotten.sql` | Retention, deletion, legal hold and right-to-be-forgotten readiness. | yes | no | documents/evidence retention | not documented in repo | yes | Legal deletion/retention obligations may not be enforceable. |
| `20260612016200_database_migration_stabilization_supabase_integrity_audit.sql` | Database/RLS/storage audit targets. | yes | no | storage audit | not documented in repo | yes | Admin audit dashboard may not reflect live RLS state. |
| `20260612018700_provider_production_activation_final.sql` | Provider production activation readiness and audit records. | yes | yes | provider records | not documented in repo | yes | Provider readiness may be incomplete or unaudited. |
| `20260612019100_compat_current_user_role.sql` | Compatibility helper for `current_user_role()`. | helper | no | no | not documented in repo | yes | Older policies referencing the helper may fail. |
| `20260612019200_self_service_registration_affiliations.sql` | Self-service registration and affiliation model. | yes | no | profile/affiliation docs | not documented in repo | yes | Role states may not align with new UX flows. |
| `20260616000100_parent_rls_scope_hardening.sql` | Parent RLS scope hardening; removes whole-garden inheritance for parents. | yes | partial helper | documents/medical/child records | not documented in repo | yes | Critical: parents may inherit access beyond their own child/request scope. |
| `20260616000200_payment_provider_rls_scope_hardening.sql` | Finance/payment/provider RLS hardening; excludes staff/inspectors from finance-sensitive records. | yes | yes | no | not documented in repo | yes | High: staff/inspectors may inherit payment/provider visibility via garden access. |

## RLS And SQL Safety Scan

### SECURITY DEFINER

- Security definer functions in the latest parent hardening migration include explicit `set search_path = public`.
- Static scan did not find security definer functions missing `search_path`.
- Duplicate `create or replace function` history exists for intentionally replaced helpers:
  - `public.can_access_garden`
  - `public.can_parent_access_garden`
  - `public.submit_inspection_with_answers`
- Latest `public.can_access_garden` definition is expected to be the parent-scope hardened one from `20260616000100`.

### Broad Policies

Static exact matches for `with check (true)`:

| Migration | Policy | Assessment |
|---|---|---|
| `20260523000000_initial_schema.sql` | `leads public insert` | Public lead capture; acceptable only with abuse controls/rate limiting. |
| `20260612013600_public_website_marketing_lead_conversion.sql` | `demo booking public insert` | Public demo request; acceptable only with abuse controls/rate limiting. |
| `20260612013600_public_website_marketing_lead_conversion.sql` | `website events public insert` | Public analytics/event insert; rate limiting and minimization needed. |
| `20260612013900_full_kindergarten_onboarding_activation.sql` | `kindergarten legal acceptances public insert` | Requires token/context validation in app flow; live abuse review needed. |
| `20260612014300_growth_engine_parent_demand_lead_conversion.sql` | `growth leads public insert` | Public lead capture; acceptable only with abuse controls/rate limiting. |

No broad `USING (true)` policy was found by exact static scan.

### Grants

- No direct `grant all ... to anon` was found by exact static scan.
- No direct `grant select/insert/update/delete ... to anon` was found by exact static scan.

## Required Live Supabase Verification

Run in Supabase staging/production before production approval:

- Confirm `relrowsecurity = true` for all sensitive tables in `SECQA_2_SENSITIVE_TABLE_ACCESS_MATRIX.md`.
- Confirm latest helper function bodies are active, especially `can_access_garden`, `can_parent_access_child`, `can_access_document`, `can_access_payment_record`.
- Confirm policies on `children`, `parents`, `documents`, medical tables, payment tables and camera/AI tables match the latest migrations.
- Confirm no older broad policy remains active after policy replacement.
- Confirm storage buckets are private except intentionally public assets.

## Findings

| Classification | Finding | Status |
|---|---|---|
| requires_supabase_manual_test | The repo proves migration files exist, but does not prove they were applied in Supabase. | Production remains blocked until live catalog verification. |
| high | Public insert policies exist for leads/demo/events without evidence of route-level rate limiting on all public insert surfaces. | Requires abuse/rate-limit hardening before production. |
| requires_external_security_review | Parent/payment RLS hardening is structurally correct but needs negative tests with real users and Supabase catalog state. | Required. |
| low | Duplicate helper definitions exist historically but latest replacements appear intentional. | Verify active function body in Supabase. |

