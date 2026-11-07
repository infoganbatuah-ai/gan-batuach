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

One safe-admitted run began on 2026-11-07 at 09:52:42 UTC. The committed QA tool SHA was `ea14cd54a33a3d1d9ce26f4995dbd12c56bb5b62`; the exact canonical application SHA was `4ca595e6b48472152ddef79623db5718a0c2e365`. Before startup, canonical Development was clean, pinned `LOCAL_SUPABASE` asserted, port 3000 was free, load averages were 4.25/6.06/6.45, memory reported 59% free, and the external Development volume had approximately 1.09 TiB free. The canonical launcher reported `DEVELOPMENT / INTEGRATION`, this SHA, `LOCAL_SUPABASE`, Next 16.4.3 and default Turbopack.

**The journey failed before any check-in.** The Staff attendance page issued six full document requests and the QA route guard aborted request seven before network send. The first captured browser error category was `SUSPENSE_SERVER_FALLBACK`, with a fingerprint but no safely extractable frame; the server logged the same Suspense fallback repeatedly alongside HTTP 200 page responses. This is a recurrence of the earlier cross-route intermittent development symptom, now on Staff rather than Inspector. These facts do not establish its root cause. The runner exited **1** after 6,702 ms, browser/context cleanup was `COMPLETE`, the Product server was stopped and port 3000 was free. The private redacted receipt is `/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/staff-time-journey-20261107/evidence/receipt-1794045162633.json`, mode 0600, 2,265 bytes, SHA256 `03a0b8d0964eeeec3c9396b6e365c5bb86d0220840c0d85abdd2e12a91db912c`.

Five read-only preflight checks passed. There were **zero** GPS actions, location samples, new or closed shifts, manager reads, browser screenshots or audit writes from this journey. A separate authenticated read-only check after shutdown found Staff B still had zero shifts, zero open shifts and zero location samples created since the attempt. Staff A's prior open shift was untouched. Because no Product screen rendered stably, this is **BLOCKED_BY_CANONICAL_RUNTIME_RETRY_LOOP**, not Staff-time UI/API/database/role PASS. No identical browser attempt was repeated. The first actionable next unit is a bounded root-cause investigation of the shared Development Suspense/reload behavior; once fixed and merged, re-run this Staff-time journey with fresh guard evidence.

## Delivery limits

No Product code, dependency, migration, provider, Digital Observer core, main or Production change occurred. Full Product/security, real GPS device/geofence, external owner visual acceptance and invoice-backed ₪15 gates remain separate. The previous Inspector retry symptom remains intermittent and unresolved; this Staff recurrence adds evidence of a shared problem but does not prove a cause.
