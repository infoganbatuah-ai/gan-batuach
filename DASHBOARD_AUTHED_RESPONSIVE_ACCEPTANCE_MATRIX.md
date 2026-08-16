# Dashboard Authenticated Responsive Acceptance Matrix

Date: 2026-08-14  
Environment: local application connected to synthetic Supabase demo data  
Authentication: normal Supabase email/password login; logout between roles; no auth bypass

## First-load viewport acceptance

| Role state | 390x844 | 768x1024 | 1440x900 | Horizontal overflow | Clipped controls | Raw demo labels | Fake live claim |
|---|---|---|---|---|---|---|---|
| Parent assigned | PASS | PASS | PASS | 0 | 0 | none | none |
| Kindergarten manager | PASS | PASS | PASS | 0 | 0 | none | none |
| Staff assigned | PASS | PASS | PASS | 0 | 0 | none | none |
| Staff unassigned | PASS | PASS | PASS | 0 | 0 | none | none |
| Inspector assigned | PASS | PASS | PASS | 0 | 0 | none | none |
| Inspector unassigned | PASS | PASS | PASS | 0 | 0 | none | none |
| Admin | PASS | PASS | PASS | 0 | 0 | none | none |
| Digital Observer | PASS | PASS | PASS | 0 | 0 | none | none |

Result: 24/24 first-load combinations passed. No manual resize was used to wake the layout.

## Route and action-destination acceptance

- 66 visible authenticated dashboard destinations were opened from the role dashboards.
- 6 additional parent destinations were opened directly: discovery, messages, payments, cameras, schedule and child profile.
- 72/72 destinations returned no application error, no 404 and no unexpected login redirect.
- Static scans found no empty click handlers, `javascript:void`, `href="#"`, console-only action handlers or the removed hardcoded dashboard values.
- Mutating operations were not submitted because this run was non-destructive. Their visible controls either lead to a real form/action or expose an explicit readiness/disabled state.
- Parent family, camera-list and playback paths use the authenticated Supabase client and RLS only. No client or parent-facing Service Role fallback remains.

## Evidence

Evidence is stored outside public assets under `qa-evidence/dashboard-root-fix/`.

Representative files:

- `parent-dashboard-mobile-390x844-final.png`
- `parent-dashboard-desktop-1440x900-final.png`
- `manager-dashboard-mobile-390x844-final.png`
- `manager-dashboard-tablet-768x1024.png`
- `manager-dashboard-desktop-1440x900-final-2.png`
- `admin-dashboard-mobile-viewport-390x844-final.png`
- `admin-dashboard-tablet-768x1024-final.png`
- `admin-dashboard-desktop-1440x900-final.png`
- `digital-observer-mobile-nav-fixed.png`
- `digital-observer-tablet-768x1024.png`
- `digital-observer-desktop-current.png`

## Scope note

This matrix accepts the web dashboard runtime and authenticated route destinations. It does not claim that the remote Digital Observer RLS migration has been applied. Native WebView/device acceptance still requires `npx cap sync` followed by real-device QA.
