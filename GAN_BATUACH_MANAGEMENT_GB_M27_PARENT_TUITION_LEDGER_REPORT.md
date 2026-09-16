# GB-M27 Parent Tuition Ledger Report

## Before State
`children.payment_status` and `debt_amount` were mutable summary fields. `/api/garden/child-payments` changed a Child row and then inserted `child_payment_history` separately, so a failed history write could leave a false paid state. No billing-period identity or atomic settlement existed. GB-M16 `enrollment_payment_evidence` records enrollment activation eligibility, including manual arrangements, but does not prove ongoing tuition cash settlement.

## Platform Subscription / Tuition Boundary
GB-M26 `kindergarten_subscriptions` remains Garden→Gan Batuach. GB-M27 `tuition_billing_periods` and `tuition_ledger_entries` are Parent/Child→Garden. No platform subscription status or 700 ILS plan price participates in tuition calculations.

## Tuition Price Source
New GB-M16 enrollments use `kindergarten_enrollment_requests.published_price_snapshot`. Otherwise the manager-facing generator resolves explicit Child agreement, Garden fee group, then a positive legacy Child monthly fee. No amount is fabricated when no source exists. Historical legacy months without a request/snapshot require manual review.

## Price Snapshot
The first valid period stores the chosen amount and source on `child_kindergarten_enrollments`. Subsequent periods reuse the enrollment snapshot. Price changes require an explicit new agreement/change process; a Garden fee edit cannot rewrite historical periods.

## Billing Period Model
One period per enrollment/calendar month has a base, signed adjustments, settled amount, due date, currency and reconciliation status. The UI/API calculate `amount_due` and outstanding server-side. No period is generated for an inactive enrollment, a month before its start, or a month after its end. Authorized Managers may generate future eligible months. Partial start/end months require a Manager-entered agreed amount and reason, recorded in audit; no proration formula was invented.

## Period Generation
`ensure_tuition_billing_period` locks by enrollment and enforces a unique `(enrollment_id,period_start)` key. Repeated requests return the same period. A Manager-configurable `gardens.tuition_due_day` controls due dates for newly generated periods; changing it does not rewrite prior periods. Absent configuration means no invented overdue deadline.

## Ledger Status
Stored states are pending, partially paid, paid, waived, reconciliation required and cancelled. Overdue is a read-time projection when a configured due date has passed and balance remains.

## Manual Payment
Only canonical Garden management may record a manual settlement for a selected period and method. GB-M16 manual arrangements are not auto-imported as paid cash. The old Child-level paid mutation now returns 410 to prevent contradictory truth.

## Electronic Provider Readiness
No electronic charge or provider settlement is enabled in GB-M27. API responses explicitly say provider payment is unavailable. GB-M28 owns authenticated provider events and document issuance.

## Partial Payments
A settlement applies at most the outstanding amount. A smaller payment leaves `partially_paid` and a positive balance.

## Credits / Adjustments
A signed adjustment requires a reason, actor and unique source key. Its effect on the period and audit entry are in one database transaction. A negative adjustment cannot make amount due negative.

## Overpayment
The applied portion settles the period; excess is recorded as an unapplied credit entry and period total, visible to Garden and Parent. The period requires reconciliation until the credit is allocated through a future controlled workflow. No automatic cross-period allocation is assumed.

## Reconciliation
Periods covered by GB-M16 activation evidence begin in `reconciliation_required`: the evidence may be a payment arrangement or confirmed transaction, but neither is silently allocated to a monthly charge. Manager-confirmed settlement can resolve the period. Ambiguous historic price, partial enrollment months and provider events without reliable period mapping remain review cases rather than automatic paid state.

## Overdue
A period is overdue only if `tuition_due_day` is configured, due date has passed, and outstanding amount remains. The enrollment and Child operational status do not change.

## Enrollment End
Existing periods/history remain. The generator refuses new periods beyond the end date. A mid-period end requires review rather than an invented refund/proration.

## Parent UX
The existing payments page now shows canonical monthly periods and an unconfigured state when none exist. It no longer treats legacy Child debt/status as the authoritative balance. Parent API requires active guardian authorization for the selected Child and is read-only.

## Garden Finance UX
The existing Finance page links to a canonical ledger page for period generation, manual settlement and adjustment. Its older aggregate cards remain compatibility projections until the broader Finance redesign; canonical period detail is explicitly separated.

## Reports
Period rows can support Garden expected/settled/outstanding reports and Parent own-child history. No final report redesign occurs here.

## Receipts Boundary
No official invoice or receipt is generated. Legacy document URLs are not promoted into official tuition documents.

## Authorization / RLS
Period and entry tables are RLS protected. Direct authenticated writes are revoked. Manager actions use selected Garden context and `can_manage_garden`; Parent reads require canonical guardian relationship. Inspector receives no tuition permission. Cross-Garden IDs are checked before RPC and again inside locked database functions.
Database triggers also reject a period whose Child/Garden differ from its Enrollment, or an entry whose Garden differs from its period, including for elevated future writers.

## Idempotency / Concurrency
One period per enrollment/month and one entry per Garden/source key. Settlement locks its period. Repeated identical keys return current period state; conflicting replay fails. No frontend-only balance update is authoritative.

## Tests
Focused tests cover arithmetic/overdue projection, enrollment-scoped uniqueness, locked settlement, RLS contract, legacy paid-route retirement and platform separation. The migration was executed against Production inside an explicit rollback transaction; SQL compilation, RLS enablement and denial of direct authenticated INSERT/UPDATE grants passed, and the rollback left no new table. Full release validation and live-role probes are recorded separately.

## Live QA
`LIVE PARENT TUITION QA: BLOCKED BY ENVIRONMENT` unless controlled Parent/Manager identities and noncustomer Child enrollment are available. No customer charges or payments are created for QA.

## Carried QA Debt
GB-M21–M26 controlled browser role journeys, private evidence retrieval and true separate-connection races remain for GB-M35/40. GB-M27 adds Parent/Manager browser settlement and true concurrent payment retries.

## Remaining Debt
GB-M28 must authenticate provider events, settle specific periods and handle reversals/invoices. Product must define mid-period proration, tuition agreement change and credit allocation policy. Legacy Child summary fields and Finance aggregate cards need controlled retirement after data migration review. No historical customer balances were guessed.

## Inputs For GB-M28
Use enrollment and period IDs plus a unique verified provider event/source key. Reuse period locking and the entry ledger; never treat client confirmation, manual arrangement, PayBox link or platform subscription payment as tuition settlement proof. Preserve unapplied credits and reconciliation cases.

DIGITAL OBSERVER CORE DIFF: 0
