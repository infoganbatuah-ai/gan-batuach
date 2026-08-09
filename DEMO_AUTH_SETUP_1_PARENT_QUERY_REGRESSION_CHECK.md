# DEMO AUTH SETUP 1 - Parent Query Regression Check

Previous AUTHED UX/UI QA 2 fix:

- file: `lib/domain/parent-family.ts`
- issue: query selected nonexistent `children.pickup_status`
- fix: removed that field from the select list

## Verification

| Check | Result |
|---|---|
| `parent-family.ts` no longer selects `children.pickup_status` | PASS |
| Direct invalid `children.kindergarten_id` select in Parent family query | NOT_FOUND |
| Project typecheck after fix | PASS |
| Project build after fix | PASS |
| RLS bypass introduced | NO |
| Service role added to parent query | NO |
| Parent list-all-children behavior introduced | NO |

## Remaining Note

This is a code/build regression check, not a full live Supabase/RLS proof. Parent cross-child isolation still requires real Supabase manual/RLS tests.
