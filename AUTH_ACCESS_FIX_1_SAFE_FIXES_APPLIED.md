# AUTH ACCESS FIX 1 - Safe Fixes Applied

## Code Fixes

| File | Change | Reason | Safety note | Production impact | Manual follow-up |
|---|---|---|---|---|---|
| `lib/domain/parent-family.ts` | Removed `kindergarten_id` from direct `children` select | Active env did not expose `children.kindergarten_id` | Uses stable `garden_id`; no RLS change | Safer parent context loading | Re-test parent runtime logs |
| `lib/domain/smart-kindergarten-engine.ts` | Removed `kindergarten_id` from direct parent child select | Avoid same schema mismatch in parent insights | Uses stable `garden_id`; no broader access | Prevents query error in parent insights | Re-test parent dashboard |
| `app/api/parent/attendance/route.ts` | Removed `kindergarten_id` from child select and uses `garden_id` | Avoid schema mismatch in parent attendance action | Keeps child ownership check; no bypass | Safer parent attendance API | Runtime action test with synthetic child |
| `lib/domain/parent-camera-access.ts` | Removed `kindergarten_id` from direct/nested child selects | Avoid camera scope query failures | Parent camera remains policy/permission scoped | Safer readiness camera scope | Re-test parent camera readiness |

## Documentation Created

- Demo role access requirements.
- Demo user inventory.
- Safe account creation plan.
- Safe session switching plan.
- QA login helper decision.
- Parent query investigation and fix report.
- Route map.
- Synthetic data requirements.
- Daniel manual login instructions.
- Authenticated QA readiness report.
- Updated blocker register.

## Unsafe Changes Not Made

- No auth bypass.
- No service role in client.
- No RLS weakening.
- No hardcoded credentials.
- No live feature activation.

