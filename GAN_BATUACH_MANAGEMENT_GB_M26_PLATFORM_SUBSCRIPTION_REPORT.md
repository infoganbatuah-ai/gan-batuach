# GB-M26 — Garden Platform Subscription Plan and Lifecycle

## Before State
Existing `subscription_plans` and `kindergarten_subscriptions` already separate Garden platform billing from Parent tuition. Admin APIs nevertheless patched statuses and prices directly, the onboarding route calculated 700 + 200 per class in application code, the Garden UI displayed hard-coded 700/200, and the legacy Admin approval action could create an unverified `paid` payment row. The old billing migration forced `billing_cycle='annual'` even for monthly-plan records. This made historical terms ambiguous.

## Platform Subscription vs Parent Tuition
This change touches only Garden → Gan Batuach `subscription_plans`, `kindergarten_subscriptions` and platform events. It does not use `enrollment_payment_evidence`, `child_payment_history` or Parent tuition status to activate a Garden subscription.

## Canonical Plan Model
The existing plan table receives stable `code`, `version`, effective dates, default flag, billing interval, commitment months and optional grace days. Production inspection found an existing active `Gan Batuach Fixed Kindergarten Plan` at 700 ILS monthly and 8400 ILS annually. The migration marks that exact record as default when its values match; it does not seed a second copy. If that record is absent, it seeds a new explicit 700/month, 12-month commitment data record. This is an Admin-managed offer, not an immutable application constant.

## Legacy Pricing Findings
`Gan Batuach Annual` remains an active historical 7560 ILS/year (630/month) offer; `Gan Batuach Monthly` and other historical values coexist. The old 800 fallback in the Admin Garden approval route and UI 700/200 calculation are removed from the new subscription path. Existing customer rows are not repriced from currently mutable plan data.

## Plan Versioning
`admin_version_platform_plan` serializes a new version, retires the preceding version and optionally makes the replacement default. Existing subscriptions retain a snapshot and plan reference. Direct authenticated plan UPDATE/DELETE is revoked. New plan creation remains Admin-only.

## Subscription Model
The existing Garden subscription table gains plan/version code snapshot, agreed unit price/currency, interval, commitment terms, cancellation request/effective date, grace deadline and activation source. A before-insert trigger snapshots these terms for new records, including the GB-M10 onboarding trial insertion. Historical records with ambiguous billing cadence are intentionally not backfilled. Admin may explicitly adopt an active plan for a nonterminal legacy subscription with a recorded reason before manual activation.

## Status Lifecycle
The existing enum gains `past_due` and `grace_period`. `admin_transition_platform_subscription` locks a row and implements manual activation, reactivation, suspension, past-due, configured grace, renewal readiness and Admin cancellation. Terminal subscriptions cannot be revived through direct status substitution. Each material transition writes a platform subscription event.

## Onboarding Integration
The existing GB-M10 activation still creates at most one trial subscription. The new insert trigger selects the active default plan and snapshots terms. The onboarding save route reads that plan's price instead of the old class-count formula. No UI action claims provider payment.

## Annual Commitment
Monthly billing and 12-month commitment are separate fields. Commitment starts on explicit manual activation, not on a draft or trial. The current period and commitment end are server-derived.

## Billing Period / Renewal
Renewal advances the existing subscription's period only when its current period has ended and places it in `pending_payment`; it does not charge a provider. A repeated early renewal is idempotent. The agreed price snapshot remains unchanged.

## Provider Readiness
The entitlement projection reports manual/not-configured or provider-not-verified readiness. No card, Apple Pay, Google Pay, invoice or receipt creation is added. Existing sandbox checkout remains readiness-only.

## Manual/Admin Activation
Only Platform Admin can run the locked manual activation RPC; a recorded reason is mandatory. Its audit event identifies `manual_admin`. It never inserts a `paid` provider transaction. The legacy Garden approval `activate_after_payment` action has been retired from its accepted schema and no longer writes subscription/payment records.

## Failed Payment / Grace / Suspension
Past-due and suspended are explicit transitions. Grace requires configured `grace_days` on the selected plan version; no duration is invented. Subscription issues limit commercial capabilities through the existing policy without changing Garden tenant authority, Parent historical context or Inspector records.

## Cancellation
An authorized Garden Manager/Owner can request cancellation with a Garden-bound RPC. It preserves the row and calculates an effective date no earlier than both the current period end and the recorded commitment end; Admin exceptional cancellation is separately reasoned and audited. No cancellation fee is inferred.

## Reactivation
An Admin reasoned reactivation returns a nonterminal subscription to active, preserving its identity/history. Duplicate active calls return an idempotent response.

## Entitlements
`platform_subscription_entitlements(garden_id)` is a server-side resolver returning commercial access, status, plan snapshot and features after independent Garden authorization. A missing legacy subscription remains compatibility-accessible rather than silently deactivating an existing Garden. Tenant/RBAC checks remain separate.

## Role Experience
Garden UI shows the agreed snapshot or states that legacy historical price is unverified. Admin can manage plan versions and explicit lifecycle actions. Parent tuition, Staff employment and Inspector oversight are not derived from subscription payment state.

## Admin Oversight
The existing Admin subscription surface is retained. Its generic status patch becomes named lifecycle actions. The plan form exposes interval, commitment and optional grace policy.

## RLS / Security
The migration limits subscription SELECT to authorized Garden management or Admin and revokes direct authenticated subscription mutation. Plan mutation is Admin-only, with update/delete through the version RPC. Garden cancellation requires `can_manage_garden`; Admin actions require `is_admin`. The UI's selected Garden is never authorization proof.

A production rollback-only probe exposed that `is_admin()` returns SQL `NULL` with no authenticated subject. The initial `IF NOT is_admin()` guard did not reject `NULL`. Follow-up migration `20260913193000` changes every subscription RPC to `IS DISTINCT FROM TRUE`; the same probe then passed for unauthorized transition, creation and entitlement reads. Fresh installs get the corrected guards in `20260913190000` as well. The probe wrote no persistent records.

## Idempotency / Concurrency
Creation uses a Garden advisory transaction lock plus one-current partial unique index. Manual transitions lock the subscription row. Repeated terminal-state actions return existing state. No provider webhook is activated by this change.

## Tests
Focused contract tests cover default plan reuse, versioning, snapshots, manual activation, no fake paid row, cancellation authorization and entitlements. Management regression, domain/security gates, typecheck, migration audit, lint and build are release gates. True concurrent and role-based live tests require controlled accounts.

## Live QA
`LIVE PLATFORM SUBSCRIPTION QA: BLOCKED BY ENVIRONMENT` until controlled Owner/Admin identities and noncustomer Garden records are available. No real charge or customer subscription mutation is used as a smoke test.

## Carried QA Debt
GB-M21 Inspector→Owner bootstrap; GB-M22 role journey/private evidence/separate-connection submit; GB-M23 remediation journey/private evidence/separate-connection review; GB-M24 task role journey/completion race; GB-M25 complaint roles/private attachment/concurrency remain for GB-M35/40.

## Remaining Debt
GB-M28 must provide verified provider event→canonical subscription transition and invoicing. Product must approve grace and cancellation policy. Historical subscriptions with ambiguous terms require individual reconciliation, not automatic repricing. Controlled live role and concurrent tests remain outstanding.

## Inputs For GB-M27 / GB-M28
GB-M27 must not read this table as Parent tuition. GB-M28 should use the plan/price snapshot and period fields for verified provider events, never treat manual activation as card-payment proof, and preserve event idempotency.

DIGITAL OBSERVER CORE DIFF: 0
