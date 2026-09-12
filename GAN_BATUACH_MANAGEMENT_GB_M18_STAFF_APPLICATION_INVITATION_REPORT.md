# GB-M18 — Staff Application and Invitation Acceptance

## Before State

Staff applications, signed invitations, candidate profiles and Garden employment records existed, but manager approval performed several elevated writes outside one transaction and immediately opened access. Candidate and Garden-initiated paths could diverge.

## Canonical Application Model

`staff_job_applications` remains the canonical application. It now records Classroom, invitation, employment, review, information-request, response, acceptance and requirement-snapshot links. Historical terminal applications are retained while one active application per Candidate and opening is enforced.

## Application Lifecycle

The centralized lifecycle is `submitted → under_review / information_required / rejected / awaiting_candidate_acceptance → employed`, with `resubmitted`, `withdrawn` and compatibility states. Invalid transitions fail in the database function.

## Candidate Submission

Submission rechecks the authenticated Candidate, canonical server-side completeness, hard qualification requirements, active published Job, Garden state and Classroom integrity. A retry returns the existing active application and never creates employment.

## Garden Applicant Inbox

The existing inbox now uses the active Garden context and displays the professional role, structured qualifications, document state and employment-bound status. Existing visual patterns were preserved.

## Information Required

An authorized Garden Manager can request specific information. Only the Candidate who owns the application can respond, producing `resubmitted` while preserving the request and audit history.

## Approval / Rejection

Manager approval moves the application to `awaiting_candidate_acceptance`; it does not grant access. Rejection preserves the Candidate profile and application history. Candidate withdrawal likewise creates no employment.

## Signed Invitation Integration

Garden invitations reuse the GB-M05 HMAC-signed, expiring and replay-protected invitation service. The signed payload binds Garden, Job, role, recipient and optional Classroom. Delivery status remains truthful when email/SMS providers are unavailable.

## Existing User Flow

An existing Staff user receives the signed invitation in the same acceptance surface. Verified email, intended recipient, Job, qualifications, contact verification and profile completeness are revalidated before acceptance.

## New User Resume Flow

The Staff registration route accepts only a Staff invitation for the exact recipient email, binds it to the new profile and preserves the return path through contact verification. The user completes the professional profile before accepting.

## Application / Invitation Convergence

If an active application already exists for the Candidate and Job, the invitation links to it. Both Candidate-initiated and Garden-initiated flows call the same employment activation function and converge on one employment.

## Canonical Employment Activation

`activate_staff_employment` locks the application, validates acceptance state, identity, verified contacts, completeness, optional invitation and Classroom, then creates or reuses the permanent file, Garden Staff row and `staff_kindergarten_employments` record in one transaction. The application and invitation become terminal only in the same transaction.

## Classroom Assignment

A Job may be Garden-wide. When it targets a Classroom, activation validates that Classroom belongs to the same Garden and creates one active `staff_classroom_assignments` record. Classroom assignment does not replace employment authority.

## Authorization

Garden decisions require canonical `can_manage_garden`. Candidate actions require exact application ownership. A `staff` role remains insufficient for operational access: the pre-existing GB-M03 resolver also requires approved active Staff and active Garden employment.

## RLS / Service Role

Direct authenticated application insertion and mutation are revoked in favor of narrowly granted RPCs. Candidate and Manager reads remain RLS-scoped. Elevated invitation routes explicitly validate actor, active Garden, recipient, Job and Classroom.

## Notifications

Application, decision and activation events use the current notification abstraction. External delivery is reported as delivered only when the configured provider confirms it.

## Concurrency / Idempotency

Advisory transaction locks plus partial unique indexes serialize Candidate submission and employment activation. Concurrent approvals produce one transition; invitation replay and acceptance retry return the existing employment.

## Tests

The focused suite checks completeness, qualification enforcement, duplicate submission, centralized transitions, signed recipient binding, new-user resume, application/invitation convergence, Classroom isolation, operational access before/after employment, concurrency controls and the Digital Observer boundary.

## Live QA

`LIVE STAFF HIRING QA: BLOCKED BY ENVIRONMENT` unless controlled Candidate and Manager identities are present during production verification. Customer employment data is not used.

## Remaining Debt

GB-M19 must add Staff multi-Garden context switching and finish the multi-employment operational UX. GB-M31 must verify production email/SMS delivery. GB-M32 owns full private document lifecycle closure.

## Inputs For GB-M19

Use `staff_kindergarten_employments` as the relationship authority, retain Garden-specific Staff rows and Classroom assignments, and treat `profiles.garden_id` only as a legacy/default context. Do not collapse multiple active Garden employments.
