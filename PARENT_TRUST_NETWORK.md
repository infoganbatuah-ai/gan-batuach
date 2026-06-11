# Parent Trust Network

## Purpose

The Parent Trust Network turns Gan Batuach into a parent-facing safety and transparency ecosystem.

Parents should feel:

- informed
- protected
- involved
- confident

The network shows approved and safe information only.

## Visibility Rules

Parents and public profiles must not expose:

- raw AI events
- raw observer signals
- internal investigations
- sensitive complaint details
- personal data about children, parents or staff
- camera secrets or operational security details

Parents may see:

- approved inspection summaries
- trust score
- trust badge
- compliance improvements
- resolved findings
- parent-safe safety milestones
- their own complaint status

## Trust Model

Primary table:

`parent_trust_profiles`

The trust score is calculated from:

| Category | Weight |
| --- | ---: |
| Safety | 26% |
| Compliance | 20% |
| Inspection | 20% |
| Observer readiness | 16% |
| Issue resolution | 10% |
| Response to parent complaints | 8% |

The score is parent-facing and simpler than the internal national rating.

## Badge System

Badge statuses:

- `certified`: Gan Batuach Certified
- `monitored`: active monitoring
- `probation`: improvement period
- `suspended`: public trust suspended

Public badge display is prepared but should remain controlled by admin review.

## Transparency Feed

Table:

`parent_trust_feed`

Allowed feed types:

- inspection completed
- compliance improved
- safety milestone
- resolved finding
- trust badge updated
- important safety update

Every feed item has `approved_for_parents`.

## Complaint Workflow

Parent complaint statuses are translated into parent-safe language:

- `new` → received
- `assigned` / `in_progress` → under review
- `waiting_garden` → waiting for update
- `closed` / `resolved` → resolved or closed

Parents see their own complaints only.

## Parent Education Center

Table:

`parent_trust_education_items`

Categories:

- safety guides
- inspection explanations
- compliance explanations
- observer explanations

Purpose: help parents understand how safety, inspection, compliance and observer readiness work without exposing sensitive internals.

## Public Profile Readiness

Public kindergarten profiles may show:

- trust badge
- trust score
- approved public summary
- latest approved inspection summary

They must not show:

- ranking-war comparisons
- raw complaints
- raw AI/observer events
- private documents

## Remaining Work

- Real notification jobs for inspection/compliance/trust updates
- Parent trust analytics dashboards
- Admin review workflow for public badge publishing
- Complaint satisfaction follow-up after closure
- Referral/share flow for public trust badge
- Legal review of public trust wording before production activation
