# Home registration authority and revocation — fail-closed review

Status: **REVIEW ONLY / NOT READY TO APPLY**. No SQL, route, grant, or live
registration writer is supplied. This review is based on
`integration/development@b305491c7e63eea4dcd3c9620bb32fd1f2e13c56`
and the preserved 61-commit source branch
`codex/event-ingest-replay-identity-20261025@341ff2bfb6ae0a297cbecce47a8cacac57c51a37`.
It does not replace the guarded registration proposal on that source branch or
the Draft acceptance writer in PR #256.

## Verified source-defined boundary

| Evidence | What it proves | What it does not prove |
| --- | --- | --- |
| `lib/domain/digital-observer/access.ts` and `20261023161928_digital_observer_push44_session_validity.sql` | A request-bound Bearer user may be checked with `auth.getUser`, active profile, and a current `auth.sessions`-backed session RPC. | The caller owns a Home Source, or remains active at a later transaction commit. |
| `home-registration-owner-session.server.ts` on the preserved source branch | A short-lived, request-local session observation is available to its disconnected owner predicate. | An audited, transaction-bound approval or revocation. Its random observation marker is not an authority receipt. |
| `20260820010000_digital_observer_product_runtime.sql` | Organization `owner_profile_id` is required; Site `owner_profile_id` and organization FK are independently nullable/mutable; Source has Site FK and nullable `created_by`. The authenticated owner may create/update an organization and a standalone Site within RLS. | Immutable ownership/transfer provenance; physical Home control; the Source creator's authority to qualify ownership. |
| `home-registration-ownership.ts` on the source branch | The disconnected predicate requires one active owner/profile/organization/Home Site and exact Tenant→Site→Source equality. It rejects a broad Platform Admin basis. | Its `TrustedHomeRegistrationStore` implementation: no transaction-bound owner/session recheck, current-version CAS, mandatory audit, or revocation writer exists. |
| `HOME-REGISTRATION-RECEIPTS-NOT-APPLIED.sql` on the source branch | An ungranted, deliberately aborted proposal for immutable versions, acceptance, binding and audit. | A deployed authority. `REVOKED` is only an audit action; no active/revoked registration state or atomic revocation transition is defined. |

The current model can identify a **candidate** self-managed owner if all live
rows agree. It cannot establish an independently qualified Home registration
or safe revocation merely from `profiles.role`, `created_by`, membership,
application metadata, email, client JSON, or a short-lived session observation.
The Source's current Site and the Site's current owner are mutable; a later
read cannot reconstruct an earlier acceptance decision.

## Required fail-closed interface before a writer

The unimplemented authority adapter must accept an authenticated, current
session **and** a server-held candidate request. It must not accept an
`authorized: true` object, role label, or owner ID supplied by an HTTP client.
Qualification and revocation need a narrowly granted, non-Data-API callable
transaction with these checks under deterministic locks:

1. Lock the pending registration identity, organization, Home Site, Source,
   active Auth session/profile, and current-version pointer. Check exact
   Tenant/Site/Source/owner IDs, active status, Home type, no Garden link, and
   the approved authority provenance. If provenance is missing, deny.
2. Reject installer `created_by` as approval authority, self-granted delegation,
   broad Management/platform role, cross-Tenant or cross-Site request, changed
   Source Site, stale/revoked session, missing/expired request, and an actor
   not named by the authoritative owner or explicitly scoped delegation.
3. Qualification must compare-and-swap the expected version, append an
   immutable version and mandatory audit in **one transaction**. A repeated
   request may return only an exactly equivalent committed result; a shared
   request ID or uniqueness error alone is insufficient.
4. Revocation must atomically close **future** qualification/acceptance for
   the exact registration and epoch, record actor/session/reason/time in a
   mandatory immutable audit, and invalidate in-flight attempts through an
   epoch or row-lock fence. A newer owner must not reuse an old grant.
5. Existing accepted Event→version receipts and canonical Events must remain
   immutable and readable for replay after revocation. Revocation is not a
   retroactive rewrite of their Tenant/Site/recipient decision.
6. Denial, audit-write failure, ambiguous ownership, missing session, role
   ambiguity, or accounting failure must prevent a success response. An audit
   failure rolls back the corresponding state transition.

The proposed identity/version schema lacks revocation state and a qualified
delegation ledger. Adding only a `REVOKED` audit row cannot fence acceptance
or concurrent renewals. No SQL body is provided until authority provenance,
revocation state, exact DB owner/EXECUTE role and retention are verified.

## Exact missing facts and bounded verification

| Missing fact | Source inspected and insufficiency | Affected operation | Required next proof |
| --- | --- | --- | --- |
| Who may attest that this exact Home Source belongs to the named customer owner, including transfer | Organization/Site RLS permits owner-side creation and update; Source `created_by` is installer metadata; no immutable Home registration or transfer receipt in the reviewed schema | First qualification, renewal, cross-owner transfer | Product/security-approved owner/transfer provenance rule and a server-verifiable receipt bound to Tenant, Site and Source. Do not backfill ambiguous Home rows. |
| Transaction-bound current Auth session and owner/Site/Source recheck | Request-local `home-registration-owner-session.server.ts` observes a session for at most five seconds; it does not lock or attest at commit | Qualification and revocation | Isolated PostgreSQL transaction test using the supported `auth.sessions` session ID, current rows and deterministic locks; prove logout/owner mutation racing commit is denied. |
| Revocation fence and exact actor entitlement | Proposal has append-only `registration_audit` with `REVOKED`, but no active/revoked pointer or delegated entitlement record | Revocation, renewal, acceptance race | Review additive state/epoch contract, role/grant, mandatory audit and same-transaction revocation, then race approver versus revoker and acceptance versus revoker in a disposable synthetic database. |
| Dedicated caller and immutable audit target | Guarded SQL grants no RPC EXECUTE; `registration_audit` is not yet linked to `public.immutable_audit_events` | All writers | Verify role inheritance, Data API exposed schemas, function owner, mandatory audit destination and failure rollback before any grant. |
| Linked-record retention and legal hold | Source retention brief explicitly remains engineering-only | Schema activation and lossless rollback | Obtain approved category-specific retention/hold rules for versions, acceptance, binding and audit; rehearse compatibility-first rollback without deleting records. |

## Synthetic qualification cases to run **after** the missing contract exists

One approver wins concurrent qualification; stale version loses; owner
session revoked before commit loses; Site/organization/Source changed before
commit loses; installer, self-granted delegate, cross-Tenant/Site, broad admin,
unknown Home owner and second approver lose; duplicate request with conflicting
scope loses; audit failure rolls back qualification and revocation; revocation
racing acceptance has a single serial order; post-revocation new acceptance
is denied; earlier accepted Events retain their original immutable binding;
replay does not expand recipients. No current synthetic test is claimed as
PostgreSQL concurrency, RLS, crash, or Production proof.

No live data was read or modified for this review. The original 61 source
commits, PR #255 diagnostic and PR #256 conditional acceptance writer remain
separate. No migration is ready to apply and no route is ready to activate.
