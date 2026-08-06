# AUTHED UX/UI QA 2 - Backend Error Regression Results

## Previous Finding

AUTHED UX/UI QA 1 reported a backend/data issue related to a Parent children query using:

`children.kindergarten_id`

## Checks Performed

- Static search in Parent dashboard/API/domain code.
- Accepted Parent dashboard runtime load.
- Server log review while loading `/dashboard/parent`.
- Safe code review of `lib/domain/parent-family.ts`.

## Findings

| Check | Result |
|---|---|
| Direct `children.kindergarten_id` usage in Parent dashboard code | NOT_FOUND |
| Parent dashboard loads after login | PASS |
| Runtime server log | FOUND_DIFFERENT_SCHEMA_ERROR |
| Actual failing field observed during QA | `children.pickup_status` |
| Fix applied | Removed nonexistent `pickup_status` from the Parent children select in `lib/domain/parent-family.ts` |
| Runtime recheck after fix | PASS_NO_PICKUP_STATUS_ERROR_OBSERVED_ON_PARENT_DASHBOARD_RELOAD |
| Runtime browser console proof for all Parent subroutes | LIMITED |
| Real Supabase schema verification | NOT_PERFORMED |

## Result

FIXED_FOR_OBSERVED_PARENT_CHILDREN_QUERY_ERROR

The originally reported `children.kindergarten_id` pattern was not found in the Parent dashboard code path. During the authenticated Parent QA run, the actual failing schema field observed in server logs was `children.pickup_status`. That field was removed from the Parent children query without changing permissions, RLS behavior, or the data model.

## Caveat

This is not a full Supabase/RLS schema test. Optional camera scope fallback probes still reference multiple possible relationship shapes and may log non-fatal missing-column/table attempts while resolving scope. If Daniel still sees a blocking Parent children query error in server logs, it should be treated as HIGH and investigated with the exact route and query.
