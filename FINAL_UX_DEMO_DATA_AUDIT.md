# Final UX Demo Data Audit

RESCUE 1 audit date: 2026-06-23

## Purpose

Several approved visual screens currently contain demo-like metrics and timeline rows. RESCUE 1 does not replace production data logic. It classifies values so the next migration can keep the visual structure while showing truthful data or empty states.

## Classification

| Area | Examples | Current classification | Required treatment |
| --- | --- | --- | --- |
| Approved login screen | brand art, trust copy, form placeholders | intentional presentation | Keep; no business metrics. |
| Ganenet main dashboard top cards | attendance counts, staff count, safety state | mixed real/demo fallback | Bind to real queries where available; otherwise show designed empty state, not fake activity. |
| Ganenet updates and schedule rows | fixed times and names in demo mode | demo-only values if no DB rows | Replace with DB rows or empty state during screen migration. |
| Staff dashboard | shifts/tasks/application state | mixed real/demo fallback | Use staff assignment and shift APIs; fallback to empty state. |
| Inspector dashboard | assigned gardens/inspection tasks | mixed real/demo fallback | Use inspector assignments; pending candidates must not see garden data. |
| Admin main dashboard | pending applications, provider health, QA/security | mostly calculated/admin queries | Preserve data queries; avoid hardcoded launch status. |
| Digital Observer dashboard | camera/site/provider cards | mixed readiness/demo values | Preserve separation from Gan Batuach; mark not_configured/readiness when provider data missing. |

## Rule For RESCUE 2+

When a value cannot be proven from database/API state, show one of:

- `אין נתונים להצגה כרגע`
- `ממתין להגדרה`
- `לא מוגדר`
- `דורש חיבור ספק`

Do not fabricate production metrics to match a reference image.

