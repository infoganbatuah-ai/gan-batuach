# PILOT QA 1 - Final Real Pilot Blocker Register

Date: 2026-07-06

## Critical Blockers

| ID | Source | Severity | Tags | Affected area | Pilot impact | Required action | Blocks real parent/child data | Blocks only external demo/store | Next owner/action |
|---|---|---:|---|---|---|---|---|---|---|
| PQA1-C01 | PILOT FIX 2 | critical | rls_required, manual_required | Supabase/RLS role isolation | Real users cannot be trusted until target Supabase denies cross-role/cross-tenant access | Run manual JWT/RLS verification plan in target pilot DB and record pass/fail | yes | no | Daniel / Supabase operator |
| PQA1-C02 | PILOT FIX 3 | critical | legal_review_required, privacy_review_required | Legal/privacy/consent | Real child/parent data cannot enter without legal/privacy signoff or explicit risk acceptance | External legal/privacy review or Daniel written risk acceptance | yes | yes | Daniel / legal reviewer |
| PQA1-C03 | PILOT FIX 4 | critical | environment_required, manual_required | Real environment separation | Demo, staging/pilot and production environments are not manually signed off | Confirm Supabase/Vercel projects, allowed data, secrets, rollback and data admission rules | yes | no | Daniel / deployment owner |

## High Blockers

| ID | Source | Severity | Tags | Affected area | Pilot impact | Required action | Blocks real parent/child data | Blocks only external demo/store | Next owner/action |
|---|---|---:|---|---|---|---|---|---|---|
| PQA1-H01 | PILOT FIX 5 | high | manual_required, rls_required | Role-flow negative tests | Admin/manager/parent/staff/inspector routes exist but A/B access proof is manual-required | Execute synthetic E2E role tests in staging/pilot | yes | no | QA/operator |
| PQA1-H02 | PILOT FIX 5 | high | storage_required, manual_required | Documents/storage/signed URLs | Sensitive files cannot be used until private buckets and signed URL access are verified | Run storage bucket and signed URL negative tests | yes | no | Supabase/operator |
| PQA1-H03 | PILOT FIX 6 | high | camera_required, legal_review_required | Camera parent viewing | Parent viewing remains blocked pending legal/RLS/token/audit signoff | Keep parent viewing disabled; verify token/audit before any live view | yes if camera included | yes if marketed | Product/security |
| PQA1-H04 | PILOT FIX 7 | high | ai_required, retention_required | AI on real child data | AI is safe only for synthetic/readiness/shadow; retention/provider/RLS/legal not signed off | Keep AI readiness/shadow synthetic only | yes if AI included | yes | Product/security |
| PQA1-H05 | PILOT FIX 8 | high | provider_required, webhook_required | Live payments/invoices | Live billing is blocked until provider and webhook tests pass | Keep manual/sandbox payment mode | yes if billing included | yes | Provider owner |
| PQA1-H06 | PILOT FIX 8 | high | notification_required, manual_required | External notifications | Wrong-recipient tests not complete; production sends blocked | Keep in-app only; run notification routing tests | yes if external notifications used | yes | QA/operator |
| PQA1-H07 | PILOT FIX 1 / 4 | high | support_required | Support/incident ownership | Real users need support and incident path before pilot | Name support contact, incident owner, issue log and escalation path | yes | yes | Daniel |
| PQA1-H08 | PILOT FIX 1 / 4 / 8 | high | feature_flag_required | Kill switches | High-risk modules must be quickly disabled | Verify server-enforced switches for real child data, camera, AI, payments, notifications | yes | yes | Engineering/operator |
| PQA1-H09 | PILOT FIX 6 / 7 | high | audit_required | Camera/AI audit | Live camera/AI needs audit proof | Keep live camera/AI disabled until audit events verified | yes if included | yes | Security/operator |
| PQA1-H10 | PILOT FIX 8 | high | provider_required, legal_review_required | Payment/notification legal consistency | Provider data sharing and external sends need legal review | Update/approve provider terms, privacy and consent | yes if providers used | yes | Legal/provider owner |

## Medium Blockers

| ID | Source | Severity | Tags | Affected area | Pilot impact | Required action | Blocks real parent/child data | Blocks only external demo/store | Next owner/action |
|---|---|---:|---|---|---|---|---|---|---|
| PQA1-M01 | RESPONSIVE QA 2 | medium | visual_review_required | Manual visual review | Static responsive QA passed, but screenshots/manual device QA required | Complete visual checklist on mobile/tablet/desktop | no | yes | QA/operator |
| PQA1-M02 | MOBILE 1 / PILOT FIX 4 | medium | mobile_required | Native/mobile validation | Cap sync/real-device QA required before mobile pilot | Run `npx cap sync` and real-device validation before native distribution | yes if native included | yes | Mobile/operator |
| PQA1-M03 | PILOT FIX 8 | medium | scheduler_required | Demo/freeze scheduler | Scale automation not verified | Verify cron/scheduler or use manual process | no for limited prep | no | Operator |
| PQA1-M04 | Store/Mobile reports | medium | store_policy_review_required | Store/public distribution | Not relevant to real pilot launch but blocks app store claims | Do not submit stores; keep controlled distribution only | no | yes | Product |

## Counts

- Critical blockers: 3
- High blockers: 10
- Medium blockers: 4
- Low blockers: 0

## Bottom Line

Real pilot with real child/parent data is blocked. The project may continue with pilot preparation, synthetic E2E testing, and manual signoff closure.
