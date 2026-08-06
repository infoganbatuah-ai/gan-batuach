# AUTHED UX QA 1 - Blocker Register

## Summary

Critical blockers remaining: 1  
High blockers remaining: 6  
Medium blockers remaining: 2

## Blockers

| ID | Severity | Class | Issue | Impact | Required action |
|---|---|---|---|---|---|
| AUTHED-UX-CRIT-001 | critical | auth_blocked | QA could not establish safe authenticated sessions for all required roles | Blocks authenticated product acceptance and controlled pilot prep claim | Provide safe role credentials/sessions and working logout/switch-user path; rerun QA |
| AUTHED-UX-HIGH-001 | high | missing_role_acceptance | Manager dashboard not tested logged-in | Blocks manager pilot readiness | Test demo_manager authenticated dashboard |
| AUTHED-UX-HIGH-002 | high | missing_role_acceptance | Admin dashboard not tested logged-in | Blocks admin/provider readiness acceptance | Test demo_admin authenticated dashboard |
| AUTHED-UX-HIGH-003 | high | missing_role_acceptance | Staff assigned/unassigned not tested logged-in | Blocks staff flow acceptance | Test both staff states |
| AUTHED-UX-HIGH-004 | high | missing_role_acceptance | Inspector assigned/unassigned not tested logged-in | Blocks inspector flow acceptance | Test both inspector states |
| AUTHED-UX-HIGH-005 | high | missing_role_acceptance | Critical buttons for untested roles not accepted | Blocks functional acceptance | Click/verify role-critical buttons |
| AUTHED-UX-HIGH-006 | high | functional_backend | Parent route checks emitted server log error for a children query referencing missing `children.kindergarten_id` | Parent UI rendered, but backend/schema mismatch may hide data reliability issues | Investigate parent-family child query and schema field usage |
| AUTHED-UX-MED-001 | medium | visual_review | Parent has bottom proximity/touch-size flags in automated metrics | Requires manual review/small CSS if real clipping is seen | Review parent screenshots manually |
| AUTHED-UX-MED-002 | medium | digital_observer | Digital Observer demo/admin access not confirmed | Blocks Digital Observer acceptance if in scope | Confirm account or scope out |

## Final Blocker Decision

Authenticated UX/UI acceptance is blocked until multi-role authenticated testing is completed.
