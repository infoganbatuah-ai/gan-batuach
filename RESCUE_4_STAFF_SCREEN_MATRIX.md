# RESCUE 4 - Staff Screenshot-To-Route Matrix

## Reference Availability

- Canonical requested folder: `docs/ux-references/staff/`
- Status: missing in repository.
- Visual references used for this implementation: `/Users/danielderi/Desktop/עיצוב גן בטוח/צוות גן/`
- Accurate pixel validation remains `manual_visual_review_required` until the references are copied into the repository or browser screenshots can be captured.

## Screen Matrix

| Reference screen | Reference filename | Existing route | Current component | Data source | Existing actions/API routes | Role guard / privacy boundary | Implementation status |
|---|---|---|---|---|---|---|---|
| Staff main dashboard | `דשבורד ראשי צוות.png` | `/dashboard/staff` | `app/dashboard/staff/page.tsx`, `components/staff-app-ui.tsx` | `profiles`, `staff`, `gardens`, `children`, `staff_shifts`, `tasks`, `messages`, `documents`, `notifications`, `incident_reports`, `medicine_given_logs` | Links to attendance, shifts, messages, tasks, incidents, child journal, notifications, settings | Staff can see only own assignment and assigned-kindergarten operational summary | Implemented with final StaffAppFrame, truthful metrics, no fake parent-message counts |
| Staff home when not affiliated | `דף בית צוות שאינו משויך לגן.png` | `/dashboard/staff` when no approved assignment | `app/dashboard/staff/page.tsx` | `staff`, `staff_job_applications`, profile fields | Job market, documents, profile, notifications | No assigned-kindergarten modules, no child/parent/internal data | Implemented with candidate navigation and honest unassigned state |
| Kindergarten card visible to staff | `כרטיס גן שרואים משתמשי הצוות.png` | `/dashboard/staff/job-market` | `app/dashboard/staff/job-market/page.tsx` | Public-safe garden/opening data | Staff application form, search and filters | No children, parents, private documents, payments, cameras or inspection internals | Existing route preserved; candidate navigation is used for unassigned staff; standalone details page remains deferred |
| Attendance | `נוכחות דשבורד צוות.png` | `/dashboard/staff/attendance` | `app/dashboard/staff/attendance/page.tsx`, `StaffAttendanceActions` | `staff_shifts`, `staff_location_samples`, `staff_workforce_anomalies`, `staff_workforce_scores` | `/api/staff/gps-attendance`, attendance actions | Existing geofence/location rules preserved; unassigned staff see an honest blocked state | Existing functional attendance screen preserved; no attendance logic changed |
| Schedule and shifts | `לוז ומשמרות צוות.png` | `/dashboard/staff/shifts` | `app/dashboard/staff/shifts/page.tsx` | `staff_shifts`, assigned garden | View shift details, navigation | Staff sees own shifts only; unassigned staff see an honest blocked state | Existing route preserved; no hardcoded shift values added |
| Messages | `הודעות דשבורד צוות.png` | `/dashboard/staff/messages` | `app/dashboard/staff/messages/page.tsx` | `messages`, assigned garden recipients | `/api/messages`, compose/send where permitted | Staff can message only permitted assigned-garden recipients; unassigned staff see no internal messages | Existing route preserved; dashboard preview now uses real message rows |
| Staff profile / application state | unassigned/profile references | `/app/register/staff`, `/onboarding/staff`, `/dashboard/staff/settings` | Registration/onboarding/profile pages | `profiles`, `staff`, document status | Existing profile and onboarding actions | Sensitive staff docs remain private | Onboarding moved to staff app shell; registration preserved |
| Job-market / kindergarten discovery | `כרטיס גן שרואים משתמשי הצוות.png` | `/dashboard/staff/job-market` | `app/dashboard/staff/job-market/page.tsx` | `kindergarten_staff_openings`, public garden data | Search, filters, application submit | Public-safe hiring information only | Existing feature preserved |
| Job application/request to join | job-market card/form | `/dashboard/staff/job-market` | `StaffApplicationForm` | `staff_job_applications` | `/api/staff/job-applications` | Staff sees own applications; manager approval still required | Existing application flow preserved |

## Existing Staff Routes Preserved

- `/dashboard/staff`
- `/dashboard/staff/attendance`
- `/dashboard/staff/background`
- `/dashboard/staff/cameras`
- `/dashboard/staff/certificates`
- `/dashboard/staff/child-journal`
- `/dashboard/staff/daily-journal`
- `/dashboard/staff/documents`
- `/dashboard/staff/incidents`
- `/dashboard/staff/job-market`
- `/dashboard/staff/messages`
- `/dashboard/staff/notifications`
- `/dashboard/staff/operations`
- `/dashboard/staff/settings`
- `/dashboard/staff/shifts`
- `/dashboard/staff/tasks`
- `/app/register/staff`
- `/onboarding/staff`

## Functional Gaps For UXQA 4A

- `manual_visual_review_required`: Staff references are outside the repository and no automated screenshots were captured in this environment.
- `missing_backend`: Secure staff document viewing/download route is not fully exposed in UI; direct file links were removed to avoid leaking storage URLs.
- `provider_required`: Camera viewing depends on real gateway playback readiness and never displays raw credentials.
- `fixed`: Unassigned staff no longer see operational attendance, shifts, messages or camera screens when manually opening those routes.
- `not_blocking`: A standalone staff-facing kindergarten details route can be added later if required; the application flow currently works from the job-market cards.
