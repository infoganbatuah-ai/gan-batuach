# GB-M05 — Signed invitation service

Date: 2026-09-10

## Result

PASS. Management invitations now have one canonical, signed, expiring and revocable data model. The parent invitation issuer uses it and no longer creates an Auth account or temporary password before the recipient accepts.

## Delivered

- Added `management_invitations` with hashed tokens, recipient fingerprints, expiry, lifecycle states, garden scope and RLS.
- Added HMAC-SHA256 issue and verification logic with constant-time signature comparison.
- Added replacement semantics: reissuing supersedes an earlier active invitation for the same garden, type and recipient.
- Added a safe public resolver that returns only the role, garden name, masked recipient and expiry.
- Migrated garden-to-parent invitation issuance while retaining `user_affiliation_requests` as a compatibility bridge for the current parent interface.
- Added provider delivery without persisting the raw token or invitation URL in delivery or audit logs.
- Removed new-account provisioning and temporary-password delivery from this flow.

## Security properties

- Plain invitation tokens exist only in request memory and the outbound provider message.
- Database records contain only a SHA-256 token digest.
- Signing fails closed unless `MANAGEMENT_INVITATION_SECRET` contains at least 32 characters.
- Tokens are single-record, time-limited, and lifecycle checked before disclosure.
- Public failures use the safe route error boundary and expose no database details.
- Issuance remains behind the existing operational garden-manager authorization gate.

## Compatibility and boundary

Existing authenticated parents can still see the legacy affiliation request. New recipients are no longer pre-created as users. Acceptance, account creation, recipient binding, child selection and recovery are intentionally reserved for GB-M06. Canonical parent-child links remain GB-M07. Digital Observer core was not changed.

## Deployment requirement

Set a unique high-entropy `MANAGEMENT_INVITATION_SECRET` of at least 32 characters in every deployed environment before enabling invitation issuance. Apply the migration before deploying the application code.

## Validation

The dedicated signed-invitation contract, prior GB-M02–M04 management checks, manager-parent contract, TypeScript, lint baseline, domain/security gates, migration health and production build are required before merge.
