# GB-M12 — Classroom Capacity, Seat Reservation & Enforcement

## Before State

GB-M11 supplied canonical Garden-scoped Classrooms and assignment history, but a Classroom had no authoritative capacity. Legacy values existed at Garden, onboarding age-group, and fee-group levels. Child moves did not reject a full destination, and enrollment had no canonical seat hold.

## Canonical Capacity Model

`classrooms.capacity_limit` is the sole new-write operational capacity. It is optional, positive when configured, auditable through the Management API, and explicitly does not assert legal or staffing compliance. No ambiguous legacy value is backfilled.

## Occupied Definition

Occupied seats are derived from current Child Classroom assignments. Assignments with an enrollment reference count only while that enrollment is `active`; current compatibility assignments without an enrollment reference also count. Historical assignments do not count.

## Reserved Definition

An active, unexpired `classroom_seat_reservations` row consumes one seat unless the same Child is already currently assigned to that Classroom. Submitted requests do not reserve seats automatically. A later admission decision must explicitly call the reservation primitive.

## Availability Calculation

The database function `classroom_capacity_status` returns configured capacity, occupied, reserved, available, and over-capacity. Available is `greatest(capacity - occupied - reserved, 0)`. A null limit is reported as not configured rather than unlimited capacity.

## Reservation Lifecycle

Reservations support active, released, consumed, and expired states; optional Child, enrollment, and enrollment-request references; optional server-evaluated expiry; and a Garden-scoped idempotency key. Release and consume operations are idempotent for their completed state. Expired holds stop consuming availability without a browser timer.

## Concurrency Safety

Seat acquisition locks the destination Classroom row before expiry cleanup and availability calculation. Concurrent attempts for the final seat serialize, so one succeeds and the other receives `classroom_capacity_unavailable`. Garden plus idempotency-key uniqueness prevents duplicate retries.

## Child Classroom Moves

`assign_child_to_classroom` now locks and validates the destination capacity before ending the current assignment. A full destination fails before the source changes. A successful move closes the prior assignment, creates one current destination assignment, and consumes the Child's active destination reservation in the same transaction.

## Onboarding Integration

Onboarding now accepts and persists explicit per-Classroom capacities keyed by category and Classroom ordinal. The previous category-level planned Child count remains for compatibility and staff-readiness display but is not copied into Classroom capacity. No regulatory capacity is inferred.

## Legacy Capacity Mapping

- `gardens.children_capacity`: legacy Garden/public summary; not authoritative for a Classroom.
- `gardens.current_children_count`: legacy/cached Garden count; not used for enforcement.
- `kindergarten_age_group_setups.children_count` and `max_children_per_class`: onboarding legacy and hard-coded policy inputs; not migrated into Classroom capacity.
- `kindergarten_fee_groups.capacity`: pricing/group compatibility; not enforcement truth.
- Onboarding `class_capacity`: planned category population retained for compatibility; new per-Classroom writes use `classroom_capacities`.

No legacy value uniquely identifies the capacity of each Classroom, so the migration intentionally performs no guessed backfill.

## Over-Capacity Handling

A manager may lower capacity below current use without deleting or changing assignments. Status then reports `over_capacity=true`, `available=0`, and all new capacity-consuming operations fail until resolved or capacity is raised.

## Public Availability Projection

`public_classroom_availability` and `/api/public/classroom-availability` expose only published Gardens, Classroom identity/category, a safe availability label, and available count. They expose no Child, parent, enrollment, or reservation identity. Same-category Classrooms remain distinct and their returned availability can be summed by GB-M14.

## APIs / RPC

- Management Classroom GET includes canonical capacity status.
- Classroom create/update accepts `capacity_limit`.
- Management actions reserve, release, and consume seats.
- Public GET provides a privacy-safe projection.
- Database RPCs perform status, reservation lifecycle, expiry, and capacity-safe Child assignment.

## Authorization / RLS

Capacity mutations use the canonical Management Garden context and database `can_manage_garden`. Reservation scope is checked against Classroom, Child, enrollment, and enrollment request Gardens by a trigger. Reservation rows are manager-readable only; mutations are available only through guarded RPCs. Public access is limited to the projection for `public_profile_enabled` Gardens.

## Audit Logging

The existing immutable audit service records capacity changes and reservation create/release/consume actions. Availability reads are not logged.

## Tests

Focused checks cover arithmetic, full and over-capacity states, lock-before-check ordering, move-before-release safety, lifecycle/idempotency, tenant scope, onboarding writes, and public data minimization. Existing Management, domain, security, migration, type, lint, and build gates are run before release.

## Live QA

`LIVE CAPACITY QA: BLOCKED BY ENVIRONMENT` until a controlled multi-Classroom QA identity is available. Production verification uses non-destructive schema, authorization, health, and deployment probes.

## Hard-Coded Legacy Findings

`kindergarten-onboarding` still contains age-category maximums and staff calculations created before GB-M12. They remain compatibility/readiness inputs and are not used by capacity enforcement. GB-M13 must version, configure, and legally review staffing-ratio policy. Public Garden pages still display legacy Garden-level totals pending GB-M14.

## Remaining Debt

GB-M13 must combine seat availability with versioned staffing policy without changing this operational capacity truth. GB-M14 should aggregate active Classroom availability by age category. GB-M15 should reserve a seat only at the chosen admission state and connect release/consume to the canonical enrollment lifecycle.

## Inputs For GB-M13

Use `classroom_capacity_status` for operational seats. Treat `capacity_limit` as configuration, never legal compliance. Replace the legacy `calculateRequiredStaff`, `maxChildrenPerClass`, and age-group setup ratio messages with a versioned, Admin-configurable, legally reviewed policy source.
