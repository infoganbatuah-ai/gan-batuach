# RESCUE 5 - Inspector Action Integrity Report

## Scope

This report covers visible inspector buttons, links and operational actions in the existing inspector experience. The pass was non-destructive: no RLS, auth, GPS validation, camera gateway, AI, evidence, signature, payment or sensitive-data policies were changed.

## Fixed During RESCUE 5

| Area | Action | Previous state | Current state |
|---|---|---|---|
| Inspector header | Profile/avatar | Visual-only avatar wrapper | Routes to `/dashboard/inspector/settings` |
| Inspector header | Notification bell | Dead button | Routes to `/dashboard/inspector/notifications` |
| Inspector dashboard | Average safety score | Used a fake `92` fallback when no real score existed | Shows `—` and "טרם חושב" when no real score exists |
| Inspector dashboard | Next inspection time | Used a fake `09:30` fallback | Shows `ללא שעה` if time is missing |
| Assigned gardens | City and score metrics | Used fake city/score fallbacks | Shows "לא הוגדר" or `—` if real data is absent |
| Assigned gardens | Garden score ring | Used fake `92` when no garden score existed | Shows `—` when the score is absent |
| Reports and alerts | Raw status/severity | Could display enum values such as `critical`, `open` | Uses Hebrew labels for touched reports/alerts |
| Camera management | Camera card details | Could fall back to technical source labels if unsafe details were allowed | Forces `safeDetails` for inspector camera cards |
| Inspection history | Average score | Used fake `91` fallback | Shows `—` when no scored inspections exist |

## Action Classification

| Route | Visible action | Classification | Notes |
|---|---|---|---|
| `/dashboard/inspector` | התחל ביקורת | Fully functional route | Links to existing inspection wizard, optionally with required inspection ID |
| `/dashboard/inspector` | נווט / גנים | Fully functional route | Opens assigned garden control center |
| `/dashboard/inspector` | היסטוריה / דוחות / ליקויים / משימות | Fully functional route | Existing role-guarded routes preserved |
| `/dashboard/inspector/control-center` | Open garden inspection | Fully functional route | Links to existing inspection screen with garden query |
| `/dashboard/inspector/inspections` | Save/resume/submit inspection | Functional with existing backend | Existing wizard and APIs preserved; GPS/signature behavior was not changed |
| `/dashboard/inspector/inspections/due` | Start/resume due inspection | Fully functional route | Uses assigned inspection records |
| `/dashboard/inspector/inspections/history` | צפייה בדוח | Functional with existing API | Links to `/api/inspections/[id]/report` |
| `/dashboard/inspector/inspections/history` | הורדה | Functional if report API supports download | No fake file generation was added |
| `/dashboard/inspector/violations` | Finding status actions | Functional with existing component | `ViolationStatusActions` preserved |
| `/dashboard/inspector/reports` | Report rows | Informational/route-limited | Report queue rendered; deeper detail routing depends on existing report implementation |
| `/dashboard/inspector/tasks` | Task status actions | Functional with existing component | `TaskWorkbench` preserved to avoid breaking task updates |
| `/dashboard/inspector/notifications` | Notification center actions | Functional with existing component | `NotificationCenter` preserved |
| `/dashboard/inspector/cameras` | Camera viewing card | Provider-dependent and policy-dependent | Safe display only; no raw stream credentials exposed |
| `/dashboard/inspector/observer-network` | Reviewed observer signals | Security-sensitive follow-up required | Existing route preserved; review-only language should be manually QA-tested |
| `/dashboard/inspector/apply` | Complete inspector application | Functional with existing page | Pending/approval state preserved |

## Disabled Or Provider-Dependent Items

- Live camera viewing remains dependent on a real gateway and policy checks.
- External notification delivery remains dependent on configured providers.
- PDF download/viewing depends on the existing inspection report API.
- Full evidence upload behavior depends on the existing inspection form/evidence implementation and must be verified in UXQA 5A.

## Broken Or Dead Actions Found

- The profile/avatar and notification bell were dead or non-navigational and were fixed.
- No new dead inspector actions were intentionally introduced.

## Security Notes

- No RTSP URL, local IP, camera username/password, gateway secret or provider token was added.
- No unassigned garden access was added.
- No child/parent/staff detail expansion was added.
- No RLS, authentication, GPS, signature, AI or camera policy logic was changed.

## UXQA 5A Update - 2026-06-26

Additional QA checks performed:

| Area | Check | Result |
|---|---|---|
| Inspector shell | Searched inspector routes for legacy `DashboardShell`, parent/staff/admin frames, public header usage and duplicate navigation markers | No conflicting shell usage found inside `app/dashboard/inspector`. |
| Camera safety | Searched inspector camera route for RTSP/IP/credential exposure | Inspector route passes `safeDetails` to the camera card. The generic card still contains a non-safe fallback for other contexts, but inspector usage is safe. |
| Raw statuses | Searched common raw enum display patterns | Fixed direct raw display in due inspections, inspection wizard, compliance, observer pilot and ratings. |
| Assignment scope | Reviewed primary dashboard/camera query patterns | Routes continue to scope by `requireRole(["inspector"])` and assigned garden IDs; real-data URL manipulation still needs authenticated QA. |

Actions fixed during UXQA 5A:

| Route/component | Issue | Fix |
|---|---|---|
| `components/inspector-inspection-wizard.tsx` | Inspection status and question type could fall back to raw enum text | Added Hebrew status and question-type label helpers. |
| `/dashboard/inspector/inspections/due` | Inspection type could display raw enum values | Added Hebrew inspection-type labels. |
| `/dashboard/inspector/compliance` | Resolution status and alert severity could display raw enum values | Added Hebrew resolution/severity labels. |
| `/dashboard/inspector/observer-pilot` | Reviewed signal and calibration statuses could display raw enum values | Added Hebrew review/calibration labels. |
| `/dashboard/inspector/ratings` | Recommendation impact level displayed raw enum values | Added Hebrew impact labels and matching status tone helper. |

Remaining action classifications after UXQA 5A:

- `fully functional`: internal navigation to inspector dashboard, gardens, inspections, history, violations, compliance, ratings, tasks, settings and notifications.
- `functional with existing backend`: inspection wizard draft/submit, task workbench, violation status actions and notification center.
- `provider_required`: live camera playback, external messaging/notification delivery and any gateway-backed camera session.
- `backend_verification_required`: report/PDF generation, evidence uploads, GPS validation and signed evidence/report access should be tested with real authenticated inspector data.
- `manual_visual_review_required`: all reference matching should be reviewed visually against the external PNGs.
