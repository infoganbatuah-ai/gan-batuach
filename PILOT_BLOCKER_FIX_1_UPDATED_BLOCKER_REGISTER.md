# PILOT BLOCKER FIX 1 - Updated Blocker Register

Date: 2026-07-12

## Updated Critical / High Blockers

| Blocker ID | Status after this phase | Evidence | Changed files | Remaining action | Recommended owner | Still blocks real pilot |
|---|---|---|---|---|---|---|
| PQA1-C01 | reduced / manual_required | Supabase signoff package created | `PILOT_BLOCKER_FIX_1_SUPABASE_RLS_MANUAL_SIGNOFF_PACKAGE.md` | Run target Supabase RLS/JWT tests | Daniel / Supabase operator | yes |
| PQA1-C02 | reduced / external_review_required | Legal signoff package created | `PILOT_BLOCKER_FIX_1_LEGAL_PRIVACY_SIGNOFF_PACKAGE.md` | Legal/privacy review or written risk acceptance | Daniel / legal reviewer | yes |
| PQA1-C03 | reduced / environment_required | Environment closure package created | `PILOT_BLOCKER_FIX_1_ENVIRONMENT_SEPARATION_CLOSURE.md` | Confirm Supabase/Vercel environment mapping | Daniel / deployment owner | yes |
| PQA1-H01 | reduced / manual_required | A/B role-flow closure checklist created | `PILOT_BLOCKER_FIX_1_ROLE_FLOW_AB_TEST_CLOSURE.md` | Run synthetic A/B E2E role tests | QA/operator | yes |
| PQA1-H02 | reduced / manual_required | RLS package includes storage/signed URL tests | `PILOT_BLOCKER_FIX_1_SUPABASE_RLS_MANUAL_SIGNOFF_PACKAGE.md` | Run private bucket/signed URL tests | Supabase/operator | yes |
| PQA1-H03 | reduced / still_open | Camera/AI exposure review created | `PILOT_BLOCKER_FIX_1_CAMERA_AI_EXPOSURE_CLOSURE_REVIEW.md` | Keep parent camera disabled; verify token/audit/legal/RLS before view | Product/security | yes if camera included |
| PQA1-H04 | reduced / still_open | AI exposure review created | `PILOT_BLOCKER_FIX_1_CAMERA_AI_EXPOSURE_CLOSURE_REVIEW.md` | Keep AI synthetic/readiness/shadow only | Product/security | yes if AI included |
| PQA1-H05 | reduced / still_open | Provider closure review created | `PILOT_BLOCKER_FIX_1_PROVIDER_PAYMENT_NOTIFICATION_CLOSURE_REVIEW.md` | Keep manual/sandbox; run provider tests before live | Provider owner | yes if live billing included |
| PQA1-H06 | reduced / manual_required | Provider/notification closure review created | `PILOT_BLOCKER_FIX_1_PROVIDER_PAYMENT_NOTIFICATION_CLOSURE_REVIEW.md` | Run wrong-recipient tests | QA/operator | yes if external notifications included |
| PQA1-H07 | reduced / manual_required | Support owner closure package created | `PILOT_BLOCKER_FIX_1_SUPPORT_INCIDENT_OWNER_CLOSURE.md` | Name support/incident/rollback owners | Daniel | yes |
| PQA1-H08 | reduced / manual_required | Kill switch requirements consolidated | support/provider/camera/AI packages | Verify server-enforced switches | Engineering/operator | yes |
| PQA1-H09 | reduced / still_open | Camera/AI audit remains a gate | `PILOT_BLOCKER_FIX_1_CAMERA_AI_EXPOSURE_CLOSURE_REVIEW.md` | Verify audit before live camera/AI | Security/operator | yes if camera/AI included |
| PQA1-H10 | reduced / external_review_required | Legal/provider review package created | `PILOT_BLOCKER_FIX_1_LEGAL_PRIVACY_SIGNOFF_PACKAGE.md` | Approve provider sharing/payment/notification terms | Legal/provider owner | yes if providers used |

## Counts After This Phase

- Critical blockers fully closed: 0
- Critical blockers reduced but still open: 3
- High blockers fully closed: 0
- High blockers reduced but still open/manual/external: 10

## Current Decision

READY_FOR_MANUAL_SIGNOFF_ROUND.

Not ready for controlled real pilot.
