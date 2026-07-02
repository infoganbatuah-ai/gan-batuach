# PILOT FIX 5 - Negative Access Test Results

Date: 2026-07-03

No live Supabase A/B dataset was created in this phase. Therefore, these tests are prepared and marked `MANUAL_REQUIRED`, not falsely passed.

| Test ID | Test | Expected result | Actual result | Status | Severity if fail | Fix needed |
|---|---|---|---|---|---|---|
| NF-001 | Parent A cannot see Child B | denied/empty | not executed | MANUAL_REQUIRED | critical | tighten parent/child RLS or API ownership |
| NF-002 | Parent A cannot list all children | denied/own children only | not executed | MANUAL_REQUIRED | critical | restrict children queries/RLS |
| NF-003 | Parent B cannot see Child A | denied/empty | not executed | MANUAL_REQUIRED | critical | tighten parent child links |
| NF-004 | Manager A cannot see Kindergarten B | denied/empty | not executed | MANUAL_REQUIRED | critical | enforce garden_id ownership |
| NF-005 | Manager B cannot see Kindergarten A | denied/empty | not executed | MANUAL_REQUIRED | critical | enforce garden_id ownership |
| NF-006 | Staff Unassigned cannot see children | denied/empty | not executed | MANUAL_REQUIRED | critical | block staff without approved assignment |
| NF-007 | Staff Assigned A cannot see Kindergarten B | denied/empty | not executed | MANUAL_REQUIRED | critical | enforce staff.garden_id |
| NF-008 | Inspector Unassigned cannot see gardens | denied/empty | not executed | MANUAL_REQUIRED | critical | enforce inspector assignment |
| NF-009 | Inspector Assigned A cannot see Kindergarten B | denied/empty | not executed | MANUAL_REQUIRED | critical | enforce inspector_id/assignment |
| NF-010 | Parent/staff/inspector cannot see provider records | denied/empty | not executed | MANUAL_REQUIRED | critical | restrict payment/provider tables/APIs |
| NF-011 | Parent cannot see raw AI | denied/empty | not executed | MANUAL_REQUIRED | critical | block raw AI events from parent role |
| NF-012 | Any user cannot access camera credentials | denied/redacted | not executed | MANUAL_REQUIRED | critical | redact/encrypt credentials and block client responses |
| NF-013 | Demo user cannot access pilot data | denied/empty | not executed | MANUAL_REQUIRED | high | enforce environment/data_scope/tenant model |
| NF-014 | Pilot user cannot access unrelated demo/private data | denied/empty | not executed | MANUAL_REQUIRED | high | enforce environment/data_scope/tenant model |

## Static Observations

- Many routes use `requireRole` and `profile.garden_id`/assignment filters.
- Camera playback rejects direct RTSP in server-side playback logic.
- AI event actions are internal-role routes, but parent denial must be tested with fixtures.
- Staff routes commonly filter by `profile.garden_id`, but unassigned and approval boundaries must be tested with actual records.

## Status

Negative access status: **MANUAL_REQUIRED**

Real pilot security status remains blocked until these tests pass against the real Supabase environment or a confirmed staging clone.
