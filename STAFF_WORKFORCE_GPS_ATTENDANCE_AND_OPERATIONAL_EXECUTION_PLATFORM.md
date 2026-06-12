# Staff Workforce, GPS Attendance & Operational Execution Platform

## GPS Attendance Model

Staff attendance is designed to be automatic.

Employees do not manually clock in or out as the normal workflow. The mobile app/browser sends location samples, and the server decides whether a shift should start or close.

The model uses:

- garden GPS location
- attendance radius
- work zones
- staff location samples
- GPS accuracy
- repeated confirmations
- network reliability
- human review for anomalies

## Automatic Entry Logic

Rule:

Employee enters the kindergarten geofence.

After 30 minutes of continuous presence:

→ attendance starts automatically.

The recorded start time is the first detected presence time, not the later confirmation time.

Example:

- 08:00 employee enters the garden zone
- 08:30 employee is still present
- System records shift start as 08:00

The API stores the location samples in `staff_location_samples` and opens the matching `staff_shifts` row.

## Automatic Exit Logic

Rule:

Employee leaves the kindergarten geofence.

After 30 minutes of continuous absence:

→ attendance closes automatically.

The recorded end time is the first detected absence time.

Example:

- 17:00 employee leaves the garden zone
- 17:30 employee is still outside
- System records shift end as 17:00

## Confidence Model

Attendance confidence is stored on `staff_shifts.attendance_confidence`.

Statuses:

- `verified`: accurate GPS and repeated confirmations
- `probable`: reasonable GPS and enough samples
- `requires_review`: weak accuracy, missing confirmations or outside geofence

Additional score:

- `confidence_score` 0-100

If confidence is low, the system creates review-ready records in `staff_workforce_anomalies`.

## Workforce Compliance Model

Staff readiness can be scored with:

- attendance consistency
- document readiness
- training readiness
- compliance status
- inspection-related requirements

Scores are stored in `staff_workforce_scores`.

This score is for manager oversight only. It is not public and is not shown to parents.

## Anomaly Model

The system can flag:

- impossible movement
- repeated GPS failures
- attendance outside garden
- suspicious patterns
- missing shifts
- late arrivals
- early departures

Human review is required before any operational conclusion.

## Manager Oversight Model

Managers see:

- active staff
- staff not yet detected
- attendance confidence
- anomalies requiring review
- missing documents
- open staff tasks
- staff readiness

Manager actions remain human decisions.

## Audit Trail

`staff_workforce_audit_events` tracks:

- location sample received
- automatic shift started
- automatic shift closed
- attendance requiring review
- schedule changes
- task completion
- compliance actions
- manager interventions
- absence requests and reviews

## Absence And Scheduling

Prepared tables:

- `staff_work_schedules`
- `staff_absence_requests`

Supported absence types:

- vacation
- sickness
- emergency
- approved leave

Supported schedule concepts:

- weekly schedules
- recurring schedules
- temporary replacement
- active date range

## Privacy And Fairness Rules

- GPS samples are used for attendance only.
- Low confidence does not automatically create a penalty.
- Suspicious patterns require manager review.
- Staff performance insights are manager-only.
- No public staff ranking is created.

## Remaining Gaps

- Background location on native iOS/Android depends on app/device permission rollout.
- Browser location monitoring stops if the browser or device blocks GPS.
- Scheduled jobs are still needed for weekly/monthly rollups and missing-shift detection.
- Payroll export is not implemented in this phase.
