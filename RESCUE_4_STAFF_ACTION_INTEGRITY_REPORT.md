# RESCUE 4 - Staff Action Integrity Report

## Scope

Audited visible staff actions across assigned and unassigned staff states, including navigation, attendance, job-market, messages, documents, cameras and profile/onboarding.

## Action Classification

| Area | Action | Status | Notes |
|---|---|---|---|
| Staff shell | Avatar/profile entry | fixed | Header avatar now links to `/dashboard/staff/settings` instead of being decorative only. |
| Staff shell | Notifications entry | fixed | Bell now links to `/dashboard/staff/notifications`. |
| Staff shell | Assigned bottom navigation | fixed | Uses real staff routes: settings, shifts, home, messages, tasks. |
| Staff shell | Candidate bottom navigation | fixed | Uses candidate-appropriate routes: settings, documents, home, job market and applications anchor. |
| Assigned dashboard | Attendance CTA | fully functional | Routes to `/dashboard/staff/attendance`; attendance API logic unchanged. |
| Assigned dashboard | Shifts CTA | fully functional | Routes to `/dashboard/staff/shifts`. |
| Assigned dashboard | Messages CTA | fully functional | Routes to `/dashboard/staff/messages`; preview now uses actual message rows where available. |
| Assigned dashboard | Today tasks | fully functional | Routes to `/dashboard/staff/tasks`; no hardcoded task list. |
| Assigned dashboard | Incident report | fully functional | Routes to existing incident-reporting flow. |
| Unassigned dashboard | Discover hiring kindergartens | fully functional | Routes to `/dashboard/staff/job-market`. |
| Unassigned dashboard | Complete profile | fully functional | Routes to `/dashboard/staff/settings`. |
| Unassigned dashboard | Upload required documents | fully functional | Routes to `/dashboard/staff/documents`. |
| Unassigned route guard UX | Manual access to attendance/shifts/messages/cameras | fixed | These routes now show an honest “ממתין לשיוך” state instead of operational modules. |
| Job market | Search/filter openings | fully functional | Existing server-side route preserved. |
| Job market | Submit job application | fully functional | Existing `/api/staff/job-applications` flow preserved. |
| Attendance | Clock-in/clock-out/break actions | fully functional | Existing location/geofence and attendance logic preserved. |
| Attendance | Location permission | provider-dependent | Depends on browser/device permission; UI must keep showing honest location state. |
| Messages | Send message | fully functional | Uses existing `/api/messages`; external delivery provider is not claimed. |
| Documents | Upload document/certificate | fully functional | Existing upload/action path preserved. |
| Documents | View uploaded private file | safely disabled / missing backend | Direct `file_url` links were removed. A secure signed-download/view route is needed for a future task. |
| Cameras | View staff-visible camera | provider-dependent | Button appears only through safe playback card; live state requires connected camera plus playback source. |
| Cameras | Camera technical details | fixed | Staff camera UI no longer exposes RTSP/local IP/credentials; playback card uses safe details mode. |
| Payroll/salary | Staff salary totals | safely disabled | No fake salary/payroll figures were added. Staff sees attendance/hours only where existing data supports it. |
| Operations | Existing operational links | not_blocking | Existing route preserved; deeper visual alignment should be part of UXQA 4A if this route is in active scope. |

## Broken Or Unsafe Actions Fixed

- Notification icon in staff header now has a real destination.
- Avatar/profile entry in staff header now has a real destination.
- Dashboard staff task/message previews no longer present fixed sample content.
- Direct links to staff private `file_url` values were removed from staff document-related pages.
- Staff camera cards no longer imply live playback unless a connection and playback source are both present.
- Candidate/unassigned staff routes now use candidate navigation and blocked states for attendance, shifts, messages and cameras.

## Remaining Action Gaps

- `missing_backend`: secure staff document view/download endpoint or signed-link action.
- `provider_required`: camera gateway playback and device location permission.
- `manual_visual_review_required`: final visual matching against staff references.
