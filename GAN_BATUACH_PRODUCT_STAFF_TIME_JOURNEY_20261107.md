# Staff time — one bounded synthetic Development journey

Task: `GB-PRODUCT-STAFF-TIME-JOURNEY-20261107`
Source Development: `4ca595e6b48472152ddef79623db5718a0c2e365`
Branch: `codex/staff-time-journey-20261107`

## Scope and preflight

This unit verifies an approved existing Staff identity, one existing active employment, the existing manual GPS fallback, Staff shift state, same-Garden Manager read, foreign-role isolation and one synthetic shift through the actual Development Product. It does not change wage rates, approve payroll, export financial data, change schema/RLS/grants, or claim hardware GPS/geofence proof. All coordinates in the browser are simulated for the single private QA context, and the server must still calculate `inside_geofence` against the Garden's existing center and radius. No continuous location tracking is started.

The canonical source was clean at the exact remote Development SHA. A read-only pinned `LOCAL_SUPABASE` preflight found Staff A has an earlier open shift; it is excluded and untouched. Staff B is approved/active with one active Garden B employment, no open shift and no used current-day shift, and Garden B has a finite center, 120-meter radius and `Asia/Jerusalem` timezone. The journey refuses any changed precondition before writing. The existing `run-management-staff-time-role-e2e.mjs` was not run: it uses `(0,0)` synthetic location, may schedule a shift, and defaults to an internal temporary receipt. This task's runner uses the existing Product UI for authorized start/end and caps browser API writes and navigations before network send.

## Canonical contract inspected

`StaffAttendanceActions` does not start `watchPosition` on mount; automatic monitoring begins only on an explicit separate button. Manual check-in/out requests one browser geolocation reading and submits the existing `gps-attendance` API. The API verifies Staff identity/employment/Garden before a location sample, calculates distance/inside state, writes a bounded sample/audit, then calls the existing `staff_attendance_transition` RPC. The RPC uses server time and Garden timezone, a profile advisory lock and one-open-shift index, returns the existing shift for a duplicate check-in, and completes the same shift on checkout. This unit makes no changes to those contracts. The Manager page and API use active Garden context and `management_staff_time_export`; the QA reads it but does not invoke rate/approve/correct/reopen or CSV export.

## Runtime and validation

Pending one safe-admitted canonical Development run. Record exact tool/app SHAs, resource check, receipt/captures, checks, actual shift/sample/audit counts, first-error status, exit/cleanup and remaining limits. No previous Staff A shift may be closed or modified.

## Delivery limits

No Product code, dependency, migration, provider, Digital Observer core, main or Production change is planned. Full Product/security, real GPS device/geofence, external owner visual acceptance and invoice-backed ₪15 gates remain separate. The previous Inspector retry symptom remains intermittent and unresolved; a passing Staff journey cannot close it.
