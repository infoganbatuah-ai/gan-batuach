# PILOT BLOCKER FIX 1 - Prioritized Closure Order

Date: 2026-07-12

## Ordered Closure Plan

| Priority | Blocker(s) | Action now | Closure type | Blocks any real pilot | Blocks parent/child inclusion | Blocks camera/AI | Blocks mobile/native | Blocks external demo/store |
|---:|---|---|---|---|---|---|---|---|
| 1 | PQA1-C01, PQA1-H02 | Close via manual Supabase/RLS and storage tests | manual action required | yes | yes | yes | no | yes |
| 2 | PQA1-C02, PQA1-H10 | Legal/privacy/provider review package | external review | yes | yes | yes | no | yes |
| 3 | PQA1-C03 | Environment separation confirmation | manual action required | yes | yes | no | no | no |
| 4 | PQA1-H01 | A/B role-flow test execution | manual action required | yes | yes | no | no | no |
| 5 | PQA1-H07 | Assign support/incident/rollback owner | close now if Daniel names owner | yes | yes | yes | no | yes |
| 6 | PQA1-H08 | Verify kill switches | reduce now / manual verify | yes for risky modules | yes | yes | no | yes |
| 7 | PQA1-H03, PQA1-H04, PQA1-H09 | Keep camera/AI locked; verify audit/token/human review later | reduce now | no if excluded | yes if included | yes | no | yes |
| 8 | PQA1-H05, PQA1-H06 | Keep live payments/external notifications blocked | reduce now | no if excluded | yes if included | no | no | yes |
| 9 | Visual review medium blocker | Manual screenshots and device QA | manual action required | no | no | no | no | yes |
| 10 | Native/mobile medium blocker | `npx cap sync` and real device validation if native included | native/mobile | no unless native pilot | no | no | yes | yes |

## Recommended Sequence

1. Daniel confirms pilot Supabase/Vercel environments.
2. Run Supabase/RLS and storage manual tests with synthetic A/B users.
3. Complete legal/privacy/consent review or written risk acceptance.
4. Run A/B role-flow tests in staging/pilot.
5. Assign support/incident/rollback owner and issue log.
6. Verify kill switches before any real user is invited.
7. Keep camera, AI, live payments and external notifications disabled unless their separate gates pass.

## Current Recommendation

READY_FOR_MANUAL_SIGNOFF_ROUND, not ready for controlled real pilot.
