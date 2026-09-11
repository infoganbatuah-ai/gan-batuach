# GB-M13 — Versioned Staff-to-Child Ratio Policy & Compliance Engine

## Before State

Onboarding embedded four age-category maximums and staffing ratios directly in TypeScript and used them to reject input, calculate required Staff, persist derived values, and display staffing warnings. No source, jurisdiction, review state, effective date, or version accompanied those numbers.

## Legacy Hard-Coded Findings

The former values were 15/1:6, 22/1:9, 27/1:11, and 35/two-per-full-Classroom. Their origin and legal status were not documented. GB-M13 removes them from application logic and user-facing claims. Existing database summary fields remain legacy compatibility fields and are written as unknown/pending rather than authoritative requirements.

## Canonical Policy Model

The model separates `staffing_policy_sets`, immutable-numbered `staffing_policy_versions`, and scoped `staffing_policy_rules`. Rules contain age/category conditions, child-count bands, data-driven children-per-Staff and minimum Staff values, and optional qualification keys.

## Versioning

Versions have a per-set number and effective date range. Evaluation takes an explicit date, enabling historical resolution. Updating policy creates or edits a draft; it does not overwrite an active version.

## Provenance

Versions store source title/reference, jurisdiction through their set, review/approval actors and timestamps, provenance status, notes, and metadata. No citation or regulatory value was fabricated.

## Approval / Activation Lifecycle

Lifecycle states are draft, under review, approved, active, and retired. Activation is an Admin-only locked database operation. It requires approved provenance, approval evidence, an effective start, and at least one rule. Overlapping active versions in the same scope fail with an effective-date conflict.

## Policy Resolution

Resolution uses jurisdiction, optional program type, Classroom category/range, child-count band, and evaluation date. Zero applicable verified policies yields `policy_not_configured`; only unverified candidates yield `policy_unverified`; overlapping versions or rules yield `policy_conflict`.

## Required Staff Evaluator

`evaluate_classroom_staffing` returns policy/version/rule provenance, current and projected Child counts, required Staff, qualifying Staff, deficit, scheduling-validation state, and compliance/readiness status. It never returns a naked unexplained requirement.

## Qualifying Staff

Only approved Staff with matching active Garden employment and active assignment to the evaluated Classroom count. Candidates, inactive/revoked Staff, unrelated Garden Staff, unassigned Owners, and Staff assigned only to another Classroom do not count. Qualification maturity is recorded as activation-and-assignment only; richer qualification mapping remains pending reviewed policy data.

## Current Compliance

Statuses are compliant, deficit, surplus, policy not configured, policy unverified, policy conflict, and staffing data incomplete. Legal compliance is null unless a verified active policy resolves uniquely and scheduling data is sufficient.

## Projected Compliance

The evaluator accepts a Child delta and calculates the prospective requirement without mutating capacity, assignments, reservations, or enrollment.

## Classroom Integration

The Management Classroom response contains current staffing evaluation and an N+1 projection alongside the independent GB-M12 capacity status.

## Onboarding Integration

Onboarding no longer rejects or estimates Staff from legacy constants. Until an approved policy applies, it states that the staffing policy awaits configuration and approval. Operational Classroom capacity remains separate.

## Future Enrollment Integration

GB-M15/16 can call the projection with `child_delta=1` and combine its result with GB-M12 seat availability. GB-M13 does not reject enrollment itself.

## Inspector Integration

The evaluator output includes expected, actual, deficit, effective policy and provenance for future Inspector views. No Inspector UI was redesigned.

## Admin APIs

`/api/admin/staffing-policies` supports listing, draft set/version creation, draft edits, rule upsert, approval, atomic activation, and retirement. Every mutation requires the canonical Platform Admin role and is audited.

## Manager Read APIs

`/api/garden/staffing-readiness` verifies the active Garden and Classroom before returning current and projected evaluation. Managers cannot mutate global policy.

## RLS / Security

Authenticated policy reads are separated from Admin-only writes. Lifecycle RPCs independently require `is_admin()`. Classroom evaluation requires canonical Garden access and derives Staff only within that Garden and Classroom.

## Tests

Focused tests cover version/effective dates, overlap conflicts, missing and unverified policy states, qualifying Staff, shared-Classroom uncertainty, projection immutability, multi-Garden checks, Admin mutation and Manager read boundaries, and removal of legacy constants from decisions. Full Management, domain, security, migration, type, lint, and build gates are required.

## Live QA

`LIVE RATIO POLICY QA: BLOCKED BY ENVIRONMENT` unless controlled Admin and Garden identities exist. No real production regulatory policy is created for testing.

## Production Policy State

No policy rows are seeded. Production therefore remains `policy_not_configured` unless a separately reviewed policy already exists. The migration cannot activate invented or legacy values.

## Legal Review Required

See `GAN_BATUACH_STAFF_RATIO_POLICY_REVIEW_REQUIRED.md` for the legacy inventory and required review evidence.

## Remaining Debt

Staff qualification taxonomy and schedule/time allocation need canonical models before shared Staff can establish compliance. Admin visual management and Inspector presentation can consume these APIs in later UX closure.

## Inputs For GB-M14

Discovery may use only a high-level readiness projection. It must keep seat availability separate from staffing-policy readiness and must not expose Staff identities, schedules, or unsupported legal claims.
