# PILOT BLOCKER QA 1 - Original Blocker Baseline

Date: 2026-07-12

Source: `PILOT_QA_1_FINAL_REAL_PILOT_BLOCKER_REGISTER.md`

## Count Verification

- Original critical blockers: 3
- Original high blockers: 10

The counts match the PILOT QA 1 baseline.

## Original Critical / High Blockers

| Blocker ID | Original severity | Source | Affected area | Pilot impact | Required closure evidence |
|---|---|---|---|---|---|
| PQA1-C01 | critical | PILOT FIX 2 | Supabase/RLS role isolation | Real users cannot be trusted until target Supabase denies cross-role/cross-tenant access | Recorded manual JWT/RLS pass/fail evidence from target pilot Supabase |
| PQA1-C02 | critical | PILOT FIX 3 | Legal/privacy/consent | Real child/parent data cannot enter without legal/privacy signoff or explicit risk acceptance | External legal/privacy review record or Daniel written risk acceptance |
| PQA1-C03 | critical | PILOT FIX 4 | Real environment separation | Demo, staging/pilot and production environments are not manually signed off | Documented Supabase/Vercel environment mapping and data admission signoff |
| PQA1-H01 | high | PILOT FIX 5 | Role-flow negative tests | Routes exist but A/B access proof is manual-required | Synthetic A/B role-flow test results |
| PQA1-H02 | high | PILOT FIX 5 | Documents/storage/signed URLs | Sensitive files cannot be used until private buckets and signed URL access are verified | Storage bucket and signed URL negative test results |
| PQA1-H03 | high | PILOT FIX 6 | Camera parent viewing | Parent viewing remains blocked pending legal/RLS/token/audit signoff | Parent viewing disabled evidence or full camera gate signoff |
| PQA1-H04 | high | PILOT FIX 7 | AI on real child data | AI is safe only for synthetic/readiness/shadow | AI mode/visibility/human review evidence and legal/RLS signoff |
| PQA1-H05 | high | PILOT FIX 8 | Live payments/invoices | Live billing is blocked until provider and webhook tests pass | Provider sandbox/live test evidence and explicit approval |
| PQA1-H06 | high | PILOT FIX 8 | External notifications | Wrong-recipient tests not complete | Notification routing negative test results |
| PQA1-H07 | high | PILOT FIX 1 / 4 | Support/incident ownership | Real users need support and incident path | Named owners, support channel, incident log and rollback process |
| PQA1-H08 | high | PILOT FIX 1 / 4 / 8 | Kill switches | High-risk modules must be quickly disabled | Verified server-enforced disable controls |
| PQA1-H09 | high | PILOT FIX 6 / 7 | Camera/AI audit | Live camera/AI needs audit proof | Audit event evidence before any live camera/AI use |
| PQA1-H10 | high | PILOT FIX 8 | Payment/notification legal consistency | Provider sharing and external sends need legal review | Legal/provider review record |
