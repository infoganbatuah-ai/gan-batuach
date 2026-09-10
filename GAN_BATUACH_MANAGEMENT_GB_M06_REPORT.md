# GB-M06 — Parent invitation acceptance and recovery

Date: 2026-09-10

## Result

PASS. A signed parent invitation can now continue through an existing-account login or a new parent registration, bind only to the verified invited email, and reach the existing child-selection acceptance interface.

## Delivered

- Added a public invitation landing page with safe garden and masked-recipient details.
- Existing parents return to the invitation after login and explicitly claim it.
- New parents register from the invitation; the server validates the signed token, parent role and exact email before binding the new profile.
- Claiming never creates a garden or child relationship. It only binds the invitation to the authenticated parent profile.
- Acceptance requires the canonical invitation, matching garden, matching legacy bridge, active lifecycle state and complete email/phone verification.
- Added a `processing` lifecycle lock so concurrent requests cannot consume one invitation twice.
- Rejection and acceptance update both canonical and compatibility records and retain audit history.
- Pre-GB-M05 legacy invitations remain available through their existing identity-bound flow.

## Recovery behavior

The canonical invitation remains attached to a newly registered account while email and phone verification are completed. After login the parent dashboard displays the pending invitation, existing child cards and the garden's available fee groups. A failed activation before enrollment completion releases the processing lock for a safe retry.

## Boundary

GB-M06 reuses the existing enrollment activation and child selection flow. Canonical parent-child and guardian relationship consolidation remains GB-M07. Digital Observer core was not changed.

## Validation

The dedicated GB-M06 contract, GB-M02–M05 management contracts, manager-parent contract, TypeScript, lint baseline, domain/security gates, migration health, release contract and production build are required before merge.
