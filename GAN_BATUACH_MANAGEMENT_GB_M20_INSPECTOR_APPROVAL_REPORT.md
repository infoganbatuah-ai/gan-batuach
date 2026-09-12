# GB-M20 — Inspector application and Platform Admin approval

## Before State

Applicant submission used a Service Role upsert that could overwrite an approved application. Admin approval separately wrote an Inspector row, optional Garden assignments, profile activation, application status and audit. A failed intermediate operation could leave a partial approval or assignment. `can_inspector_access_garden` checked an active Inspector role and Garden pointer but no application approval. The Inspector landing route sent approved but unassigned Inspectors back to the application form.

## Canonical Inspector Model / Application Lifecycle / Completeness

The existing `inspector_applications`, `inspectors`, `profiles` and Garden assignment pointer remain canonical. A caller-bound submission RPC accepts a draft or a complete submission; submission requires a name, city and contact verification when required by the account. A request for additional information permits the applicant to resubmit. Submitted and under-review applications are idempotent to repeat submissions. Rejected applications may be resubmitted. Approved and suspended applications cannot be rewritten by an applicant. No second Inspector entity was added.

## Admin Review / Approval / Rejection

The Admin decision RPC checks `is_admin`, locks the application row, validates an allowed transition, and updates Inspector row, profile, application, audit and notification in one database transaction. Repeated identical decisions return the existing application without duplicate effects. Approval requires a valid Inspector profile, persisted fields and contact verification where required. Rejection retains the profile and history, with no Garden grant. A Platform Admin may request information, review, approve, reject and suspend through the existing UI. Garden IDs were removed from approval requests.

## Suspension / Revocation

Suspension changes the application to `suspended` and immediately fails the approval predicate used by Garden authorization. Existing assignments and inspections remain historical. Reactivation requires an explicit Admin approval transition; an existing assignment may then become usable again, matching the existing assignment model. Permanent revocation and assignment-specific retirement remain GB-M21 work.

## Approved-Unassigned State / Garden Assignment Boundary

An approved Inspector reaches the Inspector dashboard even with zero Gardens. Garden-private access still requires both approved platform status and a matching Garden assignment. The Garden assignment trigger refuses new assignments to unapproved Inspectors. The Admin create-Inspector path now creates a reviewable application and rejects initial Garden assignments rather than silently granting access.

## APIs Updated / RLS / Service Role

`POST /api/inspector/applications` uses the authenticated submission RPC. `POST /api/admin/inspector-applications/[id]` uses the authenticated Admin decision RPC. The former applicant update/insert policies were removed to prevent direct status changes; the applicant retains self-read and Admin retains review. The approval and Garden predicates are enforced in PostgreSQL, including for Service Role routes that use the shared Garden authority. No route touched in this push depends on a Service Role bypass for approval.

## Legacy Compatibility

Production preflight found 3 assigned Inspector profiles and 7 Garden assignments with no approved application; 2 profiles were active and had Inspector records. The migration creates a marked `legacy_existing_operational_access` application only for profiles that already had all three elements of the previous operational grant: active Inspector profile, Inspector record, and at least one assigned Garden. This preserves existing access without granting any new Garden. The third inactive/ambiguous profile is not approved. No unknown status is guessed.

## Notifications / Audit Logging / Concurrency / Transactionality

Submission and Admin decisions write audit rows in the same transaction as state changes. Admin decisions also write in-app notifications; external SMS/email delivery is not claimed. Row locking serializes concurrent Admin decisions. The same action is idempotent; conflicting subsequent actions must satisfy the transition table.

## Security Tests / Live QA

Focused tests assert self-submission, Admin-only decisions, Garden assignment boundary, suspension and safe legacy selection. Full Management, domain, security, typecheck, build, migration and lint gates are recorded in the PR. No controlled Admin-plus-Inspector QA identities were available, so `LIVE INSPECTOR APPROVAL QA: BLOCKED BY ENVIRONMENT`; no customer Inspector was changed for testing.

## Remaining Debt / Inputs For GB-M21

GB-M21 should normalize Garden assignment history and revocation, replacing the legacy `gardens.inspector_id` pointer as appropriate. It must preserve the approved-platform-state AND active-assignment requirement. Controlled QA should exercise applicant submission, approval, approved-unassigned, assignment, suspension and reactivation with synthetic identities.

DIGITAL OBSERVER CORE DIFF: 0
