# PILOT FIX 7 - Negative AI Access Tests

| Test | Expected Result | Actual Result | Status | Severity |
| --- | --- | --- | --- | --- |
| Anonymous cannot access AI events | Denied | Not executed against live env | MANUAL_REQUIRED | critical |
| Parent cannot access raw AI event | Denied | Parent broad permission removed; DB/API manual test required | MANUAL_REQUIRED | critical |
| Parent cannot access review queue | Denied | No parent review route found | MANUAL_REQUIRED | critical |
| Parent cannot access confidence scores | Denied | Parent page does not show confidence | PASS_STATIC / MANUAL_REQUIRED | high |
| Parent cannot access AI evidence frames | Denied | Parent page does not expose evidence | PASS_STATIC / MANUAL_REQUIRED | critical |
| Parent A cannot access Child B / Kindergarten B AI | Denied | Requires synthetic users | MANUAL_REQUIRED | critical |
| Staff unassigned cannot access AI events | Denied | Staff lacks `ai_events:read` | PASS_STATIC / MANUAL_REQUIRED | high |
| Staff assigned A cannot access Kindergarten B AI | Denied | Requires synthetic users | MANUAL_REQUIRED | high |
| Inspector unassigned cannot access AI events | Denied | Requires synthetic users | MANUAL_REQUIRED | high |
| Inspector assigned A cannot access Kindergarten B AI | Denied | Route checks assignment for review actions | PASS_STATIC / MANUAL_REQUIRED | critical |
| Manager A cannot access Kindergarten B AI | Denied | Route checks garden for review actions | PASS_STATIC / MANUAL_REQUIRED | critical |
| Client role cannot access AI provider secrets | Denied | No secret values found in client scan | PASS_STATIC / MANUAL_REQUIRED | critical |
| Digital Observer user cannot access Gan Batuach AI | Denied | Requires product-scope RLS test | MANUAL_REQUIRED | critical |
| Gan Batuach parent cannot access Digital Observer AI | Denied | Requires product-scope RLS test | MANUAL_REQUIRED | critical |

No live negative tests were executed because no approved synthetic Supabase test harness was available in this phase.

