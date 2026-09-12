# GB-M21 — Inspector Garden bootstrap

## Before State
GB-M20 approved Inspectors separately from Garden assignment. GB-M10 already offered a canonical pending Garden and atomic onboarding activation; GB-M05 supplied signed invitations. There was no Inspector-originated bridge between them.

## Preliminary Garden Model
An approved Inspector creates a pending `gardens` row and one `kindergarten_onboarding_records` row. `bootstrap_inspector_id` records provenance. The draft is nonpublic, has no operational Inspector assignment, and has no payment or camera activation. A normalized Garden name and city duplicate check returns a review conflict; it never merges records or guesses identity.

## Inspector Authorization
The create/cancel RPCs require `is_approved_inspector(auth.uid())`. The list and invitation routes independently check approval and restrict Garden rows to `bootstrap_inspector_id = current profile`. There is no role-only access.

## Signed Invitation
The GB-M05 service creates a signed, expiring Garden-management invitation bound to the preliminary Garden, Inspector, recipient email, and intended role. Reissue supersedes an outstanding invitation. The recipient must have a verified matching email; target-profile mismatch, expiry, replay by another user, cancellation, or role mismatch fail. No temporary password is generated.

## Recipient Types
`owner_only`, `owner_teacher`, and `teacher_operator` map to the existing GB-M10 registrant types and GB-M08 contextual owner/teacher semantics. Acceptance prepares a pending owner or manager membership. Teaching assignment is created only by canonical Garden activation.

## Existing/New User Flow
Existing users sign in and accept the signed invitation. New recipients register for the matching manager/owner account role, verify contact, then return to the invitation. The owner self-service registration type is added to existing profile constraints; no second account system is introduced. External email delivery is reported as sent only when the provider confirms it; otherwise the invitation stays pending.

## Multi-Garden Owner
The invitation adds a Garden-specific pending membership and leaves every existing Garden membership and `profiles.garden_id` preference intact. GB-M10 activation promotes only the new Garden relationship.

## Onboarding Handoff
Acceptance sets `kindergarten_onboarding_records.manager_id` and the intended registrant type, then redirects to `/onboarding/kindergarten?gardenId=...`. GB-M10 supplies save, resume, required state, and atomic activation. Acceptance alone never activates the Garden.
The GB-M10 activation RPC is preserved with one ordering correction: it activates the profile inside the transaction before inserting an active owner/teacher assignment, whose database guard requires an active profile. This keeps a newly registered invited Owner+Teacher from failing activation while preserving rollback on any later error.

## Activation Reconciliation / Inspector Assignment
The GB-M10 Garden activation update fires the GB-M21 trigger in the same database transaction. When the originating Inspector is still approved/active, it assigns `gardens.inspector_id`. If that Inspector is no longer eligible, the Garden still activates and `bootstrap_assignment_status = admin_reassignment_required` gives Admin a truthful remediation state. Existing Admin assignment can supersede the originating Inspector.

## Inspector Inactive Mid-Flow
Suspension blocks new draft/invitation actions and operational assignment. It does not strand a legitimate Owner who already accepted and is completing onboarding.

## Duplicate Prevention
The creation RPC serializes matching name/city attempts and returns a structured duplicate-review conflict; repeat creation by the same Inspector returns the existing draft. Existing GB-M10 onboarding and unique membership constraints prevent duplicate Garden, onboarding, and Owner relationships during acceptance/activation retries.

## Public/Enrollment Isolation
The preliminary Garden has `status=pending` and `public_profile_enabled=false`. GB-M14 discovery explicitly requires both active and published. GB-M15 submission independently requires an active Garden. No public camera or payment surface is enabled.

## APIs
`GET/POST /api/inspector/preliminary-gardens`, `POST /api/inspector/preliminary-gardens/[id]/invitation`, `DELETE /api/inspector/preliminary-gardens/[id]`, and `POST /api/garden/bootstrap-invitations/accept`. The Inspector UI lists own drafts and provides create/invite/cancel actions; the shared invitation acceptance and registration UI handles recipients.

## RLS / Security
Elevated reads are explicitly scoped to the source Inspector and whitelist selected fields. Mutations use authenticated RPCs with source, recipient, Garden state, and role checks. Pending memberships do not confer operational Garden access. The existing Inspector assignment guard remains in force.

## Notifications / Audit
Invitation delivery uses the existing provider abstraction; delivery state remains truthful. Creation, invitation, acceptance/rejection, cancellation, assignment, and reassignment need are recorded in audit logs without token payloads.

## Concurrency / Tests
Database row locks and unique constraints serialize acceptance and activation. Focused tests cover the structural security boundaries, preliminary public/enrollment isolation, role binding, replay and assignment trigger. GB-M05, GB-M09, GB-M10, and GB-M20 regressions plus Management quality gates are run in CI. Controlled live concurrent acceptance remains an environment gate.

## Live QA
LIVE INSPECTOR GARDEN BOOTSTRAP QA: BLOCKED BY ENVIRONMENT — no controlled Inspector/Owner test identities are available. No customer Garden was created for testing.

## Remaining Debt
Name/city duplicate detection is deliberately conservative and requires human review for likely duplicates; institution ID and address matching are not yet authoritative. Pending invitations whose email provider is unavailable need delivery retry through the existing provider operations. The Inspector-created draft is not an operational assignment until activation.

## Inputs For GB-M22
Consume the approved Inspector + active Garden assignment boundary. Keep `bootstrap_assignment_status=admin_reassignment_required` visible to Admin so a suspended originating Inspector can be reassigned without blocking Garden operations.

**DIGITAL OBSERVER CORE DIFF: 0**
