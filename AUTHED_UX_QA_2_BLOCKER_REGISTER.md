# AUTHED UX/UI QA 2 - Blocker Register

| ID | Severity | Category | Status | Impact | Required action |
|---|---|---|---|---|---|
| AUTHED-QA2-CRIT-001 | critical | auth_blocked | OPEN | Cannot accept all logged-in role dashboards. | Daniel must provide manual role login/session switching or QA environment with isolated browser contexts. |
| AUTHED-QA2-HIGH-001 | high | missing_demo_user | OPEN | Staff unassigned state cannot be tested. | Create/confirm demo_staff_unassigned. |
| AUTHED-QA2-HIGH-002 | high | missing_demo_user | OPEN | Inspector unassigned state cannot be tested. | Create/confirm demo_inspector_unassigned. |
| AUTHED-QA2-HIGH-003 | high | missing_demo_user | OPEN | Digital Observer authenticated dashboard cannot be tested. | Create/confirm demo_digital_observer_admin or exclude DO from scope. |
| AUTHED-QA2-HIGH-004 | high | responsive_first_load | PARTIAL | Parent first-load responsive passed, all other roles untested. | Run authenticated screenshots for remaining roles. |
| AUTHED-QA2-HIGH-005 | high | visual_quality | PARTIAL | Only Parent dashboard has accepted screenshots. | Capture role-specific screenshots for all roles. |
| AUTHED-QA2-MED-001 | medium | backend_error | REDUCED | Original `children.kindergarten_id` pattern was not found. Actual runtime error was `children.pickup_status`; safe query fix applied and no recurrence was observed on Parent dashboard reload. | Monitor server logs during deeper Parent subroute QA and real Supabase schema verification. |
| AUTHED-QA2-MED-002 | medium | native_required | OPEN | Capacitor sync not run after layout changes. | Run `npx cap sync` before native/mobile QA. |

## Counts

- Critical blockers remaining: 1
- High blockers remaining: 5
- Medium blockers remaining: 2
