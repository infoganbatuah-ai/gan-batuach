# AUTH ACCESS FIX 1 - Updated Blocker Register

## Summary

Critical blockers remaining: 0  
High blockers remaining: 4  
Medium blockers remaining: 3

## Blockers

| ID | Severity | Class | Status | Issue | Required action |
|---|---|---|---|---|---|
| AUTH-ACCESS-001 | high | manual_required | open | QA 2 still needs actual credentials/sessions for each role | Daniel/Codex must run normal login per role |
| AUTH-ACCESS-002 | high | missing_demo_user | open | Unassigned staff demo account not confirmed | Confirm or create synthetic unassigned staff |
| AUTH-ACCESS-003 | high | missing_demo_user | open | Unassigned inspector demo account not confirmed | Confirm or create synthetic unassigned inspector |
| AUTH-ACCESS-004 | high | missing_demo_user | open | Digital Observer authenticated account not confirmed | Confirm account or scope out Digital Observer |
| AUTH-ACCESS-005 | medium | backend_query | reduced | Parent `children.kindergarten_id` query issue fixed statically/build verified | Re-test runtime in AUTHED UX/UI QA 2 |
| AUTH-ACCESS-006 | medium | native_required | open | Capacitor sync may be needed before native/mobile QA after prior UX changes | Run `npx cap sync` before native validation if included |
| AUTH-ACCESS-007 | medium | visual_qa | open | Parent screenshots need manual eye review for bottom-proximity flags | Review screenshots during QA 2 |

## Closed/Reduced From AUTHED UX QA 1

- Critical auth planning blocker reduced: a safe session switching plan now exists.
- Parent children query backend blocker reduced by code fix.

