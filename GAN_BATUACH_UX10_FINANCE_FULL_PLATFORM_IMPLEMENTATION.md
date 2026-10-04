# GAN BATUACH UX-10 — Finance Full Platform

## Source and boundary

- Source Development head: `a36a5cc18c08865ad2b60a6fda242b2db36af255`
- Feature branch: `codex/ux-implement-10-finance`
- Primary visual reference: `GB_UX_REF_FINANCE_FULL_PLATFORM.png`
- Primary reference SHA-256: `6000a88871a77af430f393f8265e232d755f78541be803b9a681484ec12a9e39`
- Supporting reference SHA-256 values: Parent `bf9ee24689f0c7dceeed1c0e894dff6a4357f471e7c1e1ea0bda00359328d3d4`, Owner `ddf4744b5c28da7185c6b7e2a72bf8e0d5e73a17c290bf639d24c118be6c0564`, brand `4f914d04cf16061b831782d6d53b3f67259f3f88365cb123b641887917eea5ce`
- Production and `main`: untouched
- Digital Observer core: unchanged
- New fixed monthly commitment: `₪0`
- Schema migrations: none

UX-10 refines the existing GB-M27 tuition ledger and GB-M26 Garden subscription model. It creates no second ledger, payment provider, tax document generator, or frontend balance authority.

## Route map

| Canonical capability | Route or surface |
|---|---|
| Owner/Manager finance command center, filters, metrics, ledger, history, reconciliation | `/dashboard/garden/finance` |
| Canonical period creation, due-day control, manual settlement, adjustment | `/dashboard/garden/tuition-ledger` |
| Child-scoped tuition tab and entry history | `/dashboard/garden/children/[id]?tab=tuition` |
| Guardian-scoped, multi-Child tuition and period history | `/dashboard/parent/payments` |
| Garden → Gan Batuach subscription, provider truth, invoices and receipts | `/dashboard/garden/subscription` |
| Authorized Admin subscription overview and configuration | `/dashboard/admin/subscriptions` |
| Existing report engine entry points | `/dashboard/garden/reports` and role-safe report links |

## Component map

| Component | Responsibility |
|---|---|
| `FinanceFrame` | Role-aware Gan Batuach finance shell and explicit tuition/subscription separation |
| `FinanceHero` | Reference-aligned page hierarchy and primary action composition |
| `FinanceMetrics` / `FinanceMetric` | Expected, settled, outstanding, overdue, action and subscription metrics |
| `FinanceSection` | Accessible grouped ledger, history, provider and subscription sections |
| `FinanceStatus` | Non-color-only canonical state labels |
| `FinanceTruthBanner` | Domain separation, stale/error and provider-truth messages |
| `FinanceQuickActions` | Role-safe links to canonical finance surfaces |
| `TuitionLedgerPanel` | Existing GB-M27 mutations with responsive filters, forms and history |
| `SubscriptionAdminManager` | Existing Admin plan/subscription transitions without Parent tuition exposure |

## Finance domain separation

| Domain | Direction | Canonical authority | Visible to |
|---|---|---|---|
| Parent tuition | Parent/Guardian → Garden | `tuition_billing_periods`, `tuition_ledger_entries` | Authorized Garden managers and linked guardians |
| Platform subscription | Garden → Gan Batuach | `kindergarten_subscriptions`, `subscription_payments`, `billing_invoices`, `billing_receipts` | Authorized Garden managers and Admin |

The two domains use separate routes, queries, metrics, history, actions and explanatory banners. No shared generic balance is calculated or displayed.

## Tuition state map

| Canonical state | Presentation and action |
|---|---|
| `pending` / due | Open amount with period and due date |
| `partially_paid` | Original charge, settled amount and remaining balance remain visible |
| `paid` / zero balance | Completed state with preserved history |
| Derived overdue | Server projection based on due date; never inferred as a zero/error state |
| `manual_settlement` | Amount, date, method/reference, actor and resulting period state |
| `adjustment` | Signed amount, reason, actor and unchanged original charge |
| `unapplied_credit` / overpayment | Separate credit and reconciliation-required presentation |
| `reconciliation_required` | Explicit action state; no silent absorption or discard |
| `waived` / `cancelled` | Preserved canonical status and history |

## Subscription state map

| State | UX behavior |
|---|---|
| Active/trial/demo | Plan, snapshot price, commitment and renewal context |
| Pending/action required | Clear status and authorized next actions |
| Provider unavailable | Manual/truthful state; no Checkout or success UI |
| Past due/grace/payment failed | Action-required state with history preserved |
| Frozen/suspended/expired/cancelled | New actions may be blocked while records remain visible |

Prices come from the canonical plan or subscription snapshot. No legacy price is hard-coded in the Finance UI.

## Role and permission matrix

| Capability | Owner/Manager | Parent | Staff | Inspector | Admin |
|---|---:|---:|---:|---:|---:|
| Active-Garden tuition ledger | Yes | No | No unless separately canonical | No | No family ledger by default |
| Own linked Child tuition | No guardian view | Yes | No | No | No family data in subscription overview |
| Manual settlement/adjustment | Authorized Garden only | No | No | No | Existing canonical policy only |
| Garden subscription | Active Garden only | No | No | No | Authorized platform overview/configuration |
| Other Garden/family data | No | No | No | No | Only explicit Admin platform scope |

Garden context is resolved by `getManagementGardenContext`; guardian access is checked against server-resolved linked Child IDs. Failed or unavailable finance data is never converted to `₪0`.

## Reconciliation and audit

Manual settlements retain source, amount, reference, actor and idempotency key. Adjustments retain signed amount and reason. Overpayments remain unapplied credits until canonical review. The UI reads server projections and ledger entries; it does not overwrite the original charge or calculate a private frontend ledger.

## Provider readiness and tax documents

The payment capability contract does not currently prove a Production-verified provider. UX-10 therefore shows `disabled`, `not_configured` or `provider_not_verified` truth, keeps manual handling explicit, and provides no credit-card, Apple Pay, Google Pay, PayBox or equivalent success flow. Receipts and invoices render only when canonical records exist; no legal number or document is fabricated.

## Desktop and Mobile behavior

Desktop at `1440×1024` uses the approved deep-navy navigation, royal-blue action hierarchy, differentiated metrics, ledger/card hybrid, filter bar, history, reconciliation workspace and separate subscription workspace.

Mobile at `390×844` uses a separate app composition with compact identity header, two-column metrics, Child switcher, period selector, transaction cards, sheets/details for actions, sticky bottom navigation, readable numeric direction and no horizontal overflow.

## Visual reference mapping

| Reference concept | Canonical implementation |
|---|---|
| Finance Dashboard | Owner/Manager finance command center |
| Parent Payments | Guardian-scoped current balance and period history |
| Invoices & Receipts | Truthful canonical document readiness |
| Expenses & Suppliers | Extended only to canonical payment/history surfaces; no unsupported expense model invented |
| Budget & Forecast | Replaced with canonical collection and reconciliation metrics; no forecast fabricated |
| Reports & Analytics | Links to the existing report engine |
| Mobile Dashboard / Parent Payments / Invoices / Budget / Reports | Purpose-built responsive counterparts using the same truthful canonical data |

## Visual QA evidence

- Fresh capture time: `2026-09-29T07:05:26.709Z`
- Environment: `DEVELOPMENT / INTEGRATION`
- Viewports: `1440×1024` and `390×844`
- Concepts: `14`
- Screenshots: `28`
- `OWNER_REVIEW_READY`: `28`
- `NEEDS_POLISH`: `0`
- `VISUAL_DRIFT`: `0`
- `BROKEN`: `0`
- Evidence index: `qa-evidence/ux-implement-10/visual-report.md`
- Desktop board: `qa-evidence/ux-implement-10/contact-sheet-desktop.webp`
- Mobile board: `qa-evidence/ux-implement-10/contact-sheet-mobile.webp`
- Reference comparison: `qa-evidence/ux-implement-10/reference-comparison-board.webp`

The 14 concepts are Owner Finance dashboard, tuition ledger, Child tuition detail, Parent tuition, multi-Child finance, payment history, partial payment, overdue, manual settlement, credit/adjustment, reconciliation, Garden platform subscription, provider unavailable and Admin subscription overview.

## Functional QA and deviations

Validated contracts cover canonical period arithmetic, partial settlement, manual settlement, adjustments, overpayment, reconciliation, audit/idempotency, Parent and Child isolation, active-Garden isolation, Inspector denial, subscription separation, provider signature/readiness truth, Admin privacy and responsive accessibility. The isolated role E2E verifies concurrent same-evidence protection and restores its synthetic fixture after visual QA.

Material visual deviations: none. Reference concepts for expense management, budgeting and forecasting are not backed by the canonical Management model and were not fabricated; the approved visual language is applied to the canonical ledger, reconciliation, subscription and report-entry capabilities instead.

All QA identities remain present. Visual seeding snapshots and restores the shared tuition authorization fixtures and never accesses Production.

## Integration closure

- Product commit: `44558b02fa33c395fa63f029cdb300520693f615`
- Security lock refresh: `646e3655159c71458831480e3a9a4177eb712768`
- Pull request: [#154](https://github.com/infoganbatuah-ai/gan-batuach/pull/154)
- Required checks: all eight exact-head checks PASS; Snyk status PASS; npm audit reports zero vulnerabilities
- Product merge commit: `cec5d491340f8ce73662b47ceab42a9bd5300faf`
- Development drift: `244/244 PASS`
- Post-merge health: HTTP 200, local Supabase OK
- Post-merge Finance role/concurrency E2E: `19 checks PASS`
- Post-merge role dashboard browser QA: `8/8 PASS`
- Production and `main`: unchanged
