# GB-M14 — Public Garden Discovery & Child Matching

## Before State

The Parent discovery page listed every active public Garden and used legacy fee-group capacity. It did not bind results to a selected authorized Child.

## Canonical Matching Service

`find_child_garden_matches` verifies the canonical guardian link, derives age from the Child's DOB on the evaluation date, matches active canonical Classrooms, and calculates availability from assignments and active seat reservations. Browsing has no mutation path and never reserves a seat.

## Child Authorization

The authenticated Parent endpoint and SQL function both require an active, legally-authorized GB-M07 guardian link. An unrelated Child ID is denied.

## Age Matching / Capacity / Enrollment Availability

Only active Classrooms with canonical age bounds are age matches. Capacity is calculated from GB-M12 occupancy and reservations. `accepting`, `paused`, `closed`, and `waitlist_only` are distinct from capacity. A Garden with one full matching Classroom and another with availability remains eligible.

## Pricing, Location and Privacy

Only publicly enabled fee-group prices are returned. Missing price is `price_not_configured`. Current reliable coordinates are not available in this path, so distance is truthfully `distance_unavailable`; city filtering remains available. The projection contains no Child, Parent, Staff, camera, document, or incident data.

## Existing UI Integration

`/dashboard/parent/discover-kindergartens` now selects an authorized Child and renders canonical matches, availability, pending-request state, active-enrollment state and truthful price/distance labels.

## Performance / Security

Matching uses grouped SQL CTEs rather than per-card calls. Public Garden and Classroom predicates are explicit. The child-specific API requires a Parent session and rechecks canonical authorization before calling the security-definer function.

## Tests / Live QA

Focused GB-M14 tests cover authorization, age and capacity matching, privacy projection, no-reservation behavior, UI integration and enrollment availability. Live discovery QA requires controlled Parent and Child accounts.

## Remaining Debt / Inputs For GB-M15

GB-M15 must revalidate eligibility, capacity and enrollment state transactionally before an admission decision. Location distance may be added only when both sides have trusted coordinates. Staffing readiness remains informational until an approved policy exists.
