# AUTHED UX/UI QA 2 - Critical Button Results

## Parent

| Button/action | Result |
|---|---|
| Add child / child form | VISIBLE; deep submit not executed |
| Open child profile / dashboard child card | VISIBLE; parent dashboard loaded |
| Submit enrollment | NOT_DEEPLY_TESTED |
| Open messages | LINK_VISIBLE |
| Open payments | LINK_VISIBLE |
| Open camera state | LINK_VISIBLE; no fake live claim in dashboard |

## Manager

BLOCKED_AUTH_SESSION_SWITCH

Manager critical buttons were not accepted.

## Staff

BLOCKED_AUTH_SESSION_SWITCH / BLOCKED_MISSING_UNASSIGNED_USER

Staff critical buttons were not accepted.

## Inspector

BLOCKED_AUTH_SESSION_SWITCH / BLOCKED_MISSING_UNASSIGNED_USER

Inspector critical buttons were not accepted.

## Admin

BLOCKED_AUTH_SESSION_SWITCH

Admin critical buttons were not accepted.

## Digital Observer

BLOCKED_MISSING_DEMO_LOGIN

Digital Observer critical buttons were not accepted.

## Overall Button Decision

AUTHED_CRITICAL_BUTTON_QA_BLOCKED_PARTIAL

No silent no-op was confirmed in the accepted Parent dashboard slice, but all-role button acceptance remains incomplete.
