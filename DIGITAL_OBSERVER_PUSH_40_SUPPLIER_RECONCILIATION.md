# DIGITAL OBSERVER — PUSH 40 SUPPLIER RECONCILIATION

Date: 2026-10-19

Scope: read-only supplier/account/integration/cost reconciliation; no provider activation, live message, real payment, Production change or main change

Canonical financial record: restricted `exports/restricted/SUPPLIER_COST_LEDGER_2026-09-14.md` (this report is a redacted status/evidence pointer, not a second cost ledger)

## Result

The owner clarification is confirmed: Digital Observer already depends on several paid and operational suppliers. Provider-account existence, repository readiness, deployed configuration and real end-to-end proof are different facts and are classified separately below. PUSH 39 remains `DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING / CANONICAL NOT DONE`; PUSH 40 remains `DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING / CANONICAL NOT DONE`.

No secret value was read into this report. Environment inspection was limited to variable names and safe status metadata. No customer was contacted and no external message, payment, invoice, callback or physical action was triggered.

## Classification taxonomy

- `CONNECTED_AND_VERIFIED`: the account and Product integration are both evidenced by a real, non-simulated operational path.
- `CONNECTED_NOT_PROVEN`: account/configuration/integration evidence exists, but the required controlled provider receipt is absent.
- `CONFIGURED_INACTIVE`: Product-side contract/configuration exists, but no active external destination or execution is enabled.
- `ACCOUNT_EXISTS_NOT_CONNECTED`: a supplier account/project exists, but the canonical Digital Observer integration is not operationally connected.
- `NOT_CONFIGURED`: only a candidate/readiness contract exists; no Digital Observer account connection was found.
- `UNKNOWN`: current account, plan, cost or usage could not be safely verified from available authorized evidence.

## Provider reconciliation

| Provider | Service | Account status | Integration status | Real proof status | Monthly cost / exposure | Required action |
|---|---|---|---|---|---|---|
| Vercel | Web hosting and deployment | Paid Pro account evidenced | `CONNECTED_AND_VERIFIED` | Real deployments and current account mail evidence; no new deployment in this task | $20 fixed/month; current overage requires the next invoice/dashboard read | Keep Production owner-controlled; reconcile current invoice and branch/build usage before release |
| Supabase | Database, Auth and APIs | Paid Pro; linked project reported `ACTIVE_HEALTHY` | `CONNECTED_AND_VERIFIED` | Linked Development/Production architecture and real service operation evidenced | $25/month paid on 2026-10-13; current overage not evidenced | Reconcile quotas, backup coverage and next invoice; preserve isolated Development boundary |
| Cloudflare Registrar/DNS | Domain and DNS | Active annual registration | `CONNECTED_AND_VERIFIED` | Live domain/DNS dependency evidenced | $10.46/year, about $0.87/month allocated | Keep current ownership; verify renewal and DNS recovery during supplier reviews |
| Cloudflare R2 | Private release/OTA object storage | R2 Paid active | `CONNECTED_AND_VERIFIED` | Private create/read/hash and anonymous-denial proofs exist | Current invoice $0; conservative full-month storage-only exposure up to $0.045 before tax | Reconcile next cycle; retain only under approved recovery/retention policy, with no unapproved deletion |
| AWS KMS / signing | Protected release signing | Active account with two required KMS keys | `CONNECTED_AND_VERIFIED` | Protected GitHub OIDC signing and live trust verification exist | $2 fixed KMS/month plus requests; owner account envelope $9–$10/month includes retained snapshots but is not invoice-confirmed | Read-only Cost Explorer/resource reconciliation; retain keys and snapshots unless separately authorized |
| Local ONNX runtime | AI inference | No external supplier required for the proven local path | `CONNECTED_AND_VERIFIED` | Real local model/self-test path evidenced; this is not proof of all AI capabilities | External API cost $0; hardware/power not measured | Preserve local-first path; separately meter hardware and future external inference if introduced |
| External AI APIs | Optional cloud inference | No active Digital Observer API account connection found | `NOT_CONFIGURED` | No provider receipt or measured usage | $0 evidenced; future cost unknown | Do not add unless a capability requires it and cost/privacy gates pass |
| Sentry | Error monitoring | Account exists; real Product events/deploy notifications evidenced | `CONNECTED_AND_VERIFIED` | Real monitoring events, not a notification-delivery channel proof | Current plan/cost `UNKNOWN`; prior trial ended | Verify current plan, retention and invoice without changing configuration |
| Resend | Email delivery | Account and verified sending domain evidenced; last verified Free plan | `CONNECTED_NOT_PROVEN` | Deployed configuration/webhook readiness exists; no controlled end-to-end delivery and receipt evidence | Last verified fixed cost $0; current plan/usage not freshly dashboard-verified | Run one owner-approved Development/sandbox delivery to an authorized test recipient, capture provider receipt and cost |
| SendGrid / SES | Alternate email delivery | No connected account evidence | `NOT_CONFIGURED` | None | $0 evidenced | Do not add while Resend remains the selected integration; avoid duplicate supplier spend |
| Firebase / FCM | Mobile Push | Firebase project/account exists | `ACCOUNT_EXISTS_NOT_CONNECTED` | No verified deployed credentials, device registration receipt or delivery receipt | FCM service itself is no-cost; surrounding app/egress cost unmeasured | Reconcile project ownership, then perform an authorized Development-device proof before any activation |
| Twilio | SMS | Account exists; last verified usage $0 and stored balance; account usability/suspension state unresolved | `ACCOUNT_EXISTS_NOT_CONNECTED` | No Product SMS integration or receipt | No current usage charge evidenced; future per-message cost unknown | Resolve account status read-only, then sandbox proof only if approved; do not add a duplicate SMS supplier first |
| Twilio / Meta | WhatsApp Business | Twilio account exists; WABA/sender/template state not verified | `ACCOUNT_EXISTS_NOT_CONNECTED` | No WhatsApp sender integration or receipt | $0 current usage evidenced; future conversation/template cost unknown | Evaluate the existing Twilio account first; verify WABA/sender/opt-in/template eligibility before considering a new supplier |
| Signed webhook adapter | Customer/partner webhook delivery | No external supplier account required | `CONFIGURED_INACTIVE` | Deterministic signing/replay/SSRF QA only; no external destination receipt | No supplier cost; destination operation cost unknown | Use an allowlisted Development endpoint only after owner approval; record receipt and retry cost |
| Twilio | Phone/call escalation | Account exists; Voice configuration not evidenced | `ACCOUNT_EXISTS_NOT_CONNECTED` | No Product call integration or receipt | $0 current usage evidenced; future per-minute/number cost unknown | Verify whether the existing account can satisfy bounded call escalation before selecting any additional supplier |
| Digital Observer payment processing | Recurring payments, refunds and reconciliation | No verified merchant-provider connection | `NOT_CONFIGURED` | Provider-neutral contracts and deterministic QA only | $0 current provider usage; provider fees unknown | Evaluate the existing Morning account first; if insufficient, select one approved processor after sandbox, legal and cost review |
| Morning / Green Invoice | Invoice/receipt generation and possible payment collection | Existing business account and paid Basic plan evidenced historically | `ACCOUNT_EXISTS_NOT_CONNECTED` | No API key, webhook, Digital Observer payment receipt, invoice receipt or reconciliation proof | Current annual renewal amount and API-tier delta `UNKNOWN`; historical offer was ₪637.20/year incl. VAT for a higher plan | Verify current paid plan and API/webhook/recurring/refund capabilities; prefer one combined supplier if all canonical gates pass |
| iCount | Alternate invoice generation | No Digital Observer business-account evidence | `NOT_CONFIGURED` | None | $0 evidenced | Do not add while Morning is the existing account/candidate; avoid duplicate invoice spend |
| Cardcom / Tranzila / Meshulam / Pelecard / Stripe | Alternate payment processors | Repository readiness entries only; no verified Digital Observer connection | `NOT_CONFIGURED` | None | $0 current usage; candidate fees unknown | Keep as alternatives only; do not activate unless Morning fails the canonical checkout/subscription/refund/reconciliation gates |

## Evidence boundaries

- Provider dashboards remain authoritative for current plan, invoices, usage and account state. The reconciliation uses the restricted supplier ledger, provider invoice/account mail evidence, linked-project status, protected signing/OTA evidence and repository configuration contracts.
- A configured secret name or a migration readiness row is not operational proof. No secret value appears here.
- Sentry proves monitoring connectivity; it does not prove PUSH 39 delivery through email, Push, SMS, WhatsApp, webhook or phone.
- PayPal account mail found in the connected mailbox is personal/account evidence, not a verified Digital Observer merchant integration.
- An iCount receipt from another merchant is not evidence that Digital Observer owns an iCount supplier account.

## PUSH 39 external-proof reconciliation

| Channel | Reconciled state | Proof obligation |
|---|---|---|
| Email | `CONNECTED_NOT_PROVEN` through Resend | Controlled authorized Development/sandbox delivery, provider receipt, webhook result and measured cost |
| Mobile Push | `ACCOUNT_EXISTS_NOT_CONNECTED` through Firebase project | Deployed credential boundary, test-device registration, receipt/revocation and measured cost |
| SMS | `ACCOUNT_EXISTS_NOT_CONNECTED` through Twilio | Account usable, sender/channel eligibility, sandbox/Development receipt and retry/cost proof |
| WhatsApp | `ACCOUNT_EXISTS_NOT_CONNECTED` through Twilio; Meta/WABA status unknown | WABA/sender/template/opt-in approval, receipt, callback and cost proof |
| Signed webhook | `CONFIGURED_INACTIVE` | Allowlisted external Development endpoint receipt plus replay/retry proof |
| Phone | `ACCOUNT_EXISTS_NOT_CONNECTED` through Twilio | Approved bounded call proof, authenticated callback and cost proof |

No channel is promoted to `DONE + REAL PROOF` by this reconciliation.

## Payment and invoice consolidation decision

Morning is the first supplier to evaluate because an account already exists and its public product describes payment collection tied to invoice/receipt creation. That does not yet prove that the current Basic plan exposes the API, webhooks, recurring-subscription lifecycle, refunds, out-of-order callbacks, sandbox receipts and reconciliation required by PUSH 40. The canonical decision is therefore:

1. verify the current Morning plan, renewal and API/webhook eligibility without upgrading it;
2. execute provider sandbox proof only after owner approval;
3. use Morning as the single payment+invoice supplier only if all PUSH 40 technical, legal and cost gates pass;
4. otherwise select one payment processor and retain Morning only for lawful invoice/receipt issuance—without adding redundant invoice suppliers.

## Cost truth

The safely bounded known monthly base before tax/FX is **$54.87–$55.92**: Vercel $20, Supabase $25, Cloudflare registrar allocation about $0.87, R2 $0–$0.045 and the owner-approved AWS account planning envelope $9–$10. At the Bank of Israel representative rate used for this reconciliation (USD/ILS 3.0890, 2026-10-16), that is approximately **₪169.47–₪172.70/month before tax**.

This is not the complete all-in monthly cost and not an exact exposure. The exact remaining exposure is **UNMEASURABLE** until current invoices/usage are obtained for Morning, Sentry, GitHub/CI, Codex/ChatGPT and any shared allocations, together with taxes, card FX and the authoritative registered-user and active-paying-user denominators. With no verified active paying Digital Observer users in the Development billing state, the all-in per-paying-user ratio is undefined and the ₪15 ceiling cannot be marked PASS.

## Required decisions and non-actions

- Fully operational existing suppliers: Vercel, Supabase, Cloudflare DNS/R2, AWS signing, Sentry monitoring and the local ONNX path.
- Paid but not integrated into Digital Observer: Morning Basic is the identified case; its current renewal and API entitlement need confirmation. No other paid-but-unused provider is asserted without current invoice evidence.
- Integration/proof only: Resend email; Firebase/FCM Push; Twilio SMS/WhatsApp/phone; signed webhooks.
- Genuinely new suppliers required now: **none proven**. Payment/invoice must first evaluate Morning; WhatsApp must first evaluate the existing Twilio account.
- Duplicate-spend risks: adding SendGrid/SES beside Resend, iCount beside Morning, or multiple payment gateways before one approved provider fails a documented requirement.
- Main and Production remain unchanged. No provider was activated, upgraded, purchased or contacted.

## Evidence references

- Canonical restricted supplier-cost ledger: `exports/restricted/SUPPLIER_COST_LEDGER_2026-09-14.md` (owner-only; post-reconciliation SHA-256 `cc1b3ca6a7837f5118e717560d010c8963b6b1c22cc9c11047656019c134967f`).
- Historical provider inventory: `exports/provider-audit-2026-09-07/` (restricted/historical, not the canonical cost ledger).
- Production provider configuration evidence: `PROVIDER_PRODUCTION_ACTIVATION_FINAL_REPORT.md` and provider activation migrations.
- PUSH 39 internal truth: `DIGITAL_OBSERVER_PUSH_39_IMPLEMENTATION_REPORT.md`.
- PUSH 40 internal truth: `DIGITAL_OBSERVER_PUSH_40_IMPLEMENTATION_REPORT.md`.
- Activation/proof ownership: `DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json`.
- Public supplier capability references used only to assess next steps: Firebase pricing (`https://firebase.google.com/pricing`), Twilio WhatsApp quickstart (`https://www.twilio.com/docs/whatsapp/quickstart`) and Morning payment-initiation description (`https://www.greeninvoice.co.il/magazine/%D7%97%D7%95%D7%A7-%D7%99%D7%99%D7%96%D7%95%D7%9D-%D7%AA%D7%A9%D7%9C%D7%95%D7%9E%D7%99%D7%9D-%D7%95%D7%94%D7%A2%D7%91%D7%A8%D7%94-%D7%99%D7%A9%D7%99%D7%A8%D7%94/`). Public feature descriptions are not account-level proof.
