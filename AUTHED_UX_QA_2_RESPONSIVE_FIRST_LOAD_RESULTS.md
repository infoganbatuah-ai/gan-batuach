# AUTHED UX/UI QA 2 - Responsive First-Load Results

## Accepted Runtime Check

| Role | Route | Viewport | Result | Notes |
|---|---|---:|---|---|
| Parent | `/dashboard/parent` | 390 x 844 | PASS | Loaded as mobile/app layout on first load. |
| Parent | `/dashboard/parent` | 768 x 1024 | PASS | Loaded as tablet layout on first load. |
| Parent | `/dashboard/parent` | 1366 x 768 | PASS | Loaded as desktop layout on first load. |

## Parent Findings

- No manual browser shrink was required.
- No stale mobile-preview persistence was observed in the accepted parent check.
- No horizontal overflow was detected in the accepted parent screenshots.
- No stale `25 במאי 2025` / `07:45` text was found in the accepted parent check.

## Blocked Roles

| Role | Status | Reason |
|---|---|---|
| Manager | BLOCKED_AUTH_SESSION_SWITCH | Could not prove login as Manager. |
| Staff unassigned | BLOCKED_MISSING_DEMO_LOGIN | Account not confirmed. |
| Staff assigned | BLOCKED_AUTH_SESSION_SWITCH | Could not prove login as Staff. |
| Inspector unassigned | BLOCKED_MISSING_DEMO_LOGIN | Account not confirmed. |
| Inspector assigned | BLOCKED_AUTH_SESSION_SWITCH | Could not prove login as Inspector. |
| Admin | BLOCKED_AUTH_SESSION_SWITCH | Could not prove login as Admin. |
| Digital Observer | BLOCKED_MISSING_DEMO_LOGIN | Account not confirmed. |

## QA Decision

RESPONSIVE_FIRST_LOAD_PARENT_ONLY_PASS

All-role responsive first-load acceptance remains blocked.
