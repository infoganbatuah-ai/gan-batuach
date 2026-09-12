# GB-M16 — Payment-Linked Enrollment Activation & Idempotency

## Before State

GB-M15 stopped approved requests at `awaiting_payment` with one reserved Classroom seat. The older TypeScript activation helper performed several independent writes and could not make payment evidence, enrollment, reservation consumption, Classroom assignment and request completion one transaction.

## Canonical Activation Transaction

`activate_enrollment_from_evidence` is the single database transaction. It locks the request and Child identity, validates confirmed evidence and the exact active reservation, creates or reuses Parent/Child/Enrollment records, converts the reservation into one current Classroom assignment, activates Parent Garden context through the Child enrollment, closes conflicting requests, audits and notifies.

## Enrollment State / Request State

Approval remains non-active. Successful activation creates or updates one `child_kindergarten_enrollments` row to `active` and moves the request to terminal `activated`. The enrollment stores its request, evidence, Classroom, source and activation timestamp.

## Reservation Consumption

The reservation must belong to the same request, Garden and Classroom and must remain active and unexpired. It is bound to the created Child/Enrollment and consumed in the same transaction. Occupancy then derives from the canonical current Classroom assignment, so the seat is not double-counted.

## Electronic Payment Evidence

The electronic adapter is Service Role only and requires an idempotent provider event. `mock`, `not_configured`, `manual` and ordinary sandbox states cannot activate. A `verified_test` event is accepted only for an explicitly marked QA request. No live provider is enabled by this push.

## Manual Payment Arrangement / Covered Period

Authorized Garden management may record bank transfer, standing order or checks with structured amount, ILS currency, covered-from and covered-until dates, reference and note. The evidence is `manual_arrangement`; the request is `arranged`, not falsely described as provider-paid.

## Idempotency / Concurrency

Request and Child advisory locks serialize concurrent activations. Evidence keys and provider-event uniqueness deduplicate manager clicks and webhook retries. A completed retry returns the existing active enrollment. The active permanent-Child index prevents accidental simultaneous Garden activation.

## Reconciliation Required State

When confirmed electronic or manual evidence exists but activation fails, the inner activation subtransaction rolls back while evidence becomes `reconciliation_required`; the request moves to `payment_reconciliation_required`. The system neither activates falsely nor asks for another automatic charge.

## Parent Context Activation / Classroom Assignment

Parent Garden context resolves through the GB-M07 guardian link plus the new active Child enrollment. No broad Parent Garden membership is created. One current Classroom assignment references the activated enrollment.

## Other Pending Requests

After one Garden activates, other unpaid pending requests for the Child are cancelled and their reservations released. Any other request already carrying confirmed evidence is sent to reconciliation instead of being silently cancelled.

## Notifications

Successful activation records an in-app Parent notification and timeline/audit events. No external provider delivery is claimed.

## APIs / RPC

The Manager activation endpoint records a structured manual arrangement through the canonical RPC. The future electronic-provider contract is isolated as a Service Role RPC and is not exposed to browser clients.

## RLS / Security

Evidence rows are readable only by authorized Garden management or the canonical guardian for the request Child. Direct table mutation is revoked. Manual confirmation requires the selected active Garden and `can_manage_garden`; electronic confirmation requires Service Role.

## Tests

Focused tests cover terminal transitions, reservation expiry/scope/consumption, structured manual evidence, mock-provider rejection, provider/manager idempotency, reconciliation, conflicting requests and billing-stream separation. GB-M12 and GB-M15 regressions remain required.

## Live QA

`LIVE ENROLLMENT ACTIVATION QA: BLOCKED BY ENVIRONMENT` until controlled Parent and Garden Manager identities with disposable QA enrollment data are available. No customer is charged or modified.

## Remaining Debt

GB-M26–28 own platform subscription, the complete tuition ledger/reconciliation workflow and authenticated live payment/invoice provider delivery. Refund/reversal remains historical state work and must never delete enrollment history.

## Inputs For GB-M17 / GB-M26-28

GB-M17 may treat only `active` enrollment as operational Child context. GB-M27 should consume `enrollment_payment_evidence` as the initial tuition obligation/evidence input. GB-M28 should authenticate provider webhooks and call the Service Role confirmation contract with verified, deduplicated events.
