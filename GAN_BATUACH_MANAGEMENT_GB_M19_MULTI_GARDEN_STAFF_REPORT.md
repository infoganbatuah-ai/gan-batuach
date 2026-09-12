# GB-M19 — Multi-Garden Staff Employment Context

## Before State

GB-M18 created an independent employment for each Garden and a Garden-specific `staff` row, but the operational guard still required `profiles.garden_id` and queried an unscoped single `staff` row. Staff shift and attendance screens omitted a Garden filter. Legacy `can_access_garden` could also accept the profile's direct Garden pointer. This made second employments unusable and could mix records.

## Canonical Employment Context / Multi-Garden Employment

`staff_kindergarten_employments` remains the sole operational employment authority. The `staff_employments_for_current_user` projection returns only the caller's currently active, in-date employments whose Garden is active and whose matching Garden-specific Staff row is approved/active. It returns the Garden name, employment-specific role, Staff row and active Classroom names. No new employment table or speculative backfill was added. GB-M18's second Garden activation keeps the first employment intact.

## Active Garden Context

`gb_staff_active_garden` is an HTTP-only, same-site selector cookie. The Staff context API checks the active employment projection and `can_staff_access_garden` again before setting it. Every operational request independently resolves a live employment. A stale cookie fails closed; a one-Garden Staff member defaults without selector friction. A multi-Garden Staff member can select among active employments. A candidate can still use the job market while employed elsewhere.

## Per-Garden Roles / Classroom Assignments

The selected employment provides its own `role_title` to Staff UI. Teaching permissions still require the separate GB-M08 `garden_teaching_assignments` scope in the same Garden, now additionally respecting employment dates and active Garden state. Classroom names are selected only through the same employment and Garden; no Classroom assignment grants a Garden employment. Structural hiring/management privileges are unchanged.

## Attendance / Hours

`staff_shifts.employment_id` is added without rewriting historical rows. New manual and automatic attendance transitions bind the active employment transactionally. The database locks by authenticated Staff identity, rejects a clock-in when any Garden has an open session, and closes only the correct Garden's shift. Shift displays and Staff weekly/monthly hours are filtered to the selected Garden; Manager Staff views were already filtered by Garden. Existing historical rows retain their Garden and Staff identifiers, including when employment ends.

## Shifts

The Staff shifts API now returns only the caller's Staff row in the selected Garden or the Manager's authorized Garden; creating a planned shift is Manager-only and requires matching active employment. The scheduling RPC serializes by Staff identity and rejects overlapping same-day planned time windows across Gardens, returning a generic conflict without exposing the other Garden. Overnight and more complex recurrence coverage remain operational QA items. Actual simultaneous attendance is rejected.

## Tasks / Messages / Child Access

Operational Staff pages obtain their Garden from the server guard, which substitutes the validated active employment Garden for legacy profile context. Tasks, messages, children, journals, incidents and camera Management surfaces already filter by that Garden. The main dashboard and operations pages additionally filter Staff and shift rows to the selected employment/Garden. The generic messages domain still requires GB-M29 consolidation.

## Manager Privacy

Manager hours views and shift API list only their authorized Garden. The Staff employment projection is caller-bound; it does not expose a worker's other employments to Garden A's Manager. This push does not disclose Garden B's name, pay, Classroom or hours to A.

## Employment Revocation

`can_staff_access_garden` immediately excludes revoked, inactive or ended employment. A stale selected Garden cannot authorize operations. Another active Garden employment remains valid, and historical shifts are retained. Full HR termination workflows remain outside GB-M19.

## Legacy Garden Fields

`profiles.garden_id`: compatibility/default hint only; cannot grant Staff access. `staff.garden_id`: Garden-specific staff record identifier, never sole authority. Shifts, samples, schedules and Manager hours remain Garden-scoped. A personal professional profile remains person-level. No guessed historic Staff-Garden backfill was performed.

## APIs Updated

- `GET/POST /api/staff/employment-context`: safe list and validated switch.
- `GET/POST /api/staff/shifts`: selected Staff or authorized Manager Garden; Manager-only planned shift writes.
- `POST /api/staff/gps-attendance`: active employment check and atomic attendance transition.

## RLS / Service Role

`can_staff_access_garden` now requires an active, in-date employment, matching Staff row, active profile and Garden. `can_access_garden` delegates to scoped management, Staff and inspector authorities rather than direct `profiles.garden_id`. Shift reads are scoped to the employee's own Staff row or Garden Manager, shift writes to management; location samples require valid active employment. Employment RLS permits own active read or authorized management. No touched API uses Service Role to bypass these checks.

## Security Tests

Focused checks cover one/two Gardens, stale/unrelated context, role separation via teaching assignment, Staff shift/Manager hours isolation, concurrent attendance lock, wrong-Garden clock-out, task/message/child/camera Garden filters and Digital Observer boundary. Existing operational-role and GB-M18 regressions were updated to assert the new canonical authority. A live database race involving synthetic Staff A+B was not run without controlled QA identities; the RPC concurrency contract was reviewed and its lock/state guard checked statically.

## Live QA

`LIVE MULTI-GARDEN STAFF QA: BLOCKED BY ENVIRONMENT` — no controlled multi-Garden Staff QA identity was available. No customer attendance or employment history was altered for testing.

Read-only production preflight found zero active employment duplicate groups, zero existing multi-Garden Staff identities, zero simultaneous open attendance across Gardens and zero Staff/Garden mismatched historical shifts. Thus the model and transaction are validated by tests and schema review; an actual A/B identity remains untested in Production.

## Remaining Debt

- Planned cross-Garden overlap is checked for same-day explicit time windows; overnight, recurrence, late edits and actual-versus-planned overlap need scheduling-domain closure.
- Existing candidate document screens use Garden-specific Staff records; person-level professional documents need GB-M32 separation.
- The legacy generic CRUD routes and older Garden operations warrant broader GB-M40 end-to-end tests.
- Verify a real A/B/C identity, employment revocation and device-level GPS flow in controlled QA.

## Inputs For GB-M20

Use authenticated Staff employment context for each operational Garden request. Do not treat selected Garden or profile default as a grant; retain Garden-specific role and Classroom assignment boundaries.

DIGITAL OBSERVER CORE DIFF: 0
