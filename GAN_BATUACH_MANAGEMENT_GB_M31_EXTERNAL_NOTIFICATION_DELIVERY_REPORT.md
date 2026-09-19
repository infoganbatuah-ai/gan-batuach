# GB-M31 — communication channels and external delivery

## Before State

GB-M04's Management account guard universally required both confirmed email and phone. GB-M30 already owned notification creation, recipient fan-out, preferences, quiet hours and one external intent per channel, but correctly left every external intent unavailable. Existing Resend, FCM, WhatsApp and SMS adapters had separate readiness/dry-run semantics; no GB-M30 delivery worker consumed the intents. Provider configuration in live dashboards and paid delivery were not verified in this task.

## Account Verification Policy

The central Management evaluator now treats confirmed email as sufficient for a newly enrolled normal account. Phone remains independently unverified until Supabase Auth confirms ownership. `verified_phone_action` still requires a verified phone; `high_assurance_action` remains blocked pending an actual MFA/reauthentication guard. See `GAN_BATUACH_ACCOUNT_VERIFICATION_POLICY.md`.

## GB-M04 Compatibility

The existing `contact_verification_required` marker and legacy opt-out are preserved. A forward-only SQL migration replaces the five current Management RPC definitions that enforced a universal phone check and introduces one SQL email-first policy helper. The historical GB-M04 migration is unchanged. Client callback, server guards, onboarding, enrollment, Staff and Inspector flows now use the email-first outcome; tenant/employment/approval gates remain separate. No phone timestamp is fabricated.

## Email / Resend

The existing provider adapter is reused. Resend submission receives a stable idempotency key for notification-linked sends, and a provider API acceptance is recorded distinctly from verified delivery. The existing signed Resend webhook verifies its Svix signature before processing; authenticated, deduplicated receipts update the Management delivery log without regressing a terminal state. Auth verification/recovery remain Supabase Auth flows; whether the owner's Resend account is configured as Supabase SMTP and whether a live sending domain is verified remain dashboard checks. Bounce/suppression maps to terminal failure, not delivery. No live send was made.

## Push / FCM

Existing device-token ownership/RLS and multi-device storage are reused. The Management worker resolves current active tokens (bounded to 20 per user), sends generic safe content only when FCM readiness and explicit delivery activation allow it, and retires provider-declared invalid tokens. FCM acceptance is **not** proof of notification display on a device. The old readiness bug that could report real-send capability with missing project/service-account credentials is corrected. Live device E2E remains open.

## WhatsApp

The existing Meta/Twilio template adapters remain dry-run; no business account, number, template or paid channel was activated. [Meta's current category/market model](https://whatsappbusiness.com/products/platform-pricing/) and [Twilio's $0.005/message markup plus Meta fees](https://www.twilio.com/en-us/whatsapp/pricing) are compared in the cost model. Direct Meta is the cost candidate if WABA operations are acceptable. WhatsApp OTP is prepared as an optional future phone verification transport, not claimed implemented or delivered.

## SMS

The existing SMS adapters remain mock/dry-run. Normal account use no longer depends on SMS. SMS is reserved for explicit phone-verification or selected critical fallback after owner approval, provider setup and an Israel sender/rate quote. [Twilio's Israel list price](https://www.twilio.com/en-us/sms/pricing/il) illustrates why routine SMS fan-out is excluded.

## Provider Architecture

Domain events still flow through GB-M30 `notifications` and `communication_logs`; the new bounded worker only consumes linked intents. It rechecks current recipient relationship, preferences, quiet hours and verified destination before provider submission. It uses a fixed privacy-safe title/body and never forwards a message, complaint or Child record body. The worker endpoint requires its own server-only secret and an independent `GB_M31_EXTERNAL_DELIVERY_ENABLED=true` gate; neither is provisioned here. There is no automatic scheduler. SMS/WhatsApp are explicitly unavailable rather than false-success adapters.

## Delivery States

Queued, sending, provider-accepted, delivered, transient/permanent failure, bounced, expired and unavailable are distinct. `accepted_by_provider` does not mean delivered. Supabase logs keep one notification/channel dedupe key; provider message IDs appear only after authoritative acceptance. Unknown send outcome is terminal for automatic retry and requires reconciliation to avoid duplicate paid delivery.

## Receipts / Webhooks

Resend's signed webhook binds provider message ID to a pre-existing notification-linked log, stores a minimal provider/event ID receipt, and tolerates replay/out-of-order arrival. The receipt table contains no raw payload or address. WhatsApp/SMS production receipt handlers are **not** activated; this is a remaining channel-specific gate.

## Retry / Concurrency

The claim RPC uses `FOR UPDATE SKIP LOCKED`, a bounded 50-row batch, unique lease token and at most three attempts. A second worker cannot claim the same queued row. Explicit Resend 429/5xx responses may retry with bounded delay and the same idempotency key. In-flight rows with expired leases are **not** automatically retried because an unknown provider outcome could double-send; manual reconciliation is required. After the ordered Development migration, two separate synthetic database connections competed for one queued intent: exactly one claimed it, and the row remained `sending` with one attempt. The disposable fixture was deleted.

## Fallback Policy

GB-M30 in-app notification always exists independently. The worker never automatically escalates Push failure to SMS. WhatsApp and SMS remain unavailable. A future critical fallback matrix must be an explicit server-defined policy with verified Safety provenance; client urgency alone never enables a paid channel.

## Cost-Aware Routing

The implemented conservative policy attempts only configured, verified Push/Email channels with current user preferences. Paid phone channels are disabled. Cost never overrides a future approved critical Safety rule. No arbitrary client route can choose a provider or recipient.

## Cost Telemetry

The existing per-intent log carries Garden, channel, category and provider. The new columns distinguish estimated and actual ILS cost; unknown remains NULL. An Admin/service-only monthly aggregate reports intent/send counts and unknown-cost count. No provider cost is fabricated.

## Scale Model

See `GAN_BATUACH_NOTIFICATION_PROVIDER_COST_MODEL.md` for official pricing links, the 100/1,000/10,000/100,000 user scenarios, FX date, assumptions, provider floor and missing Meta/tax/infrastructure costs.

## Owner Actions

1. Verify Resend's actual plan, sender/domain, Supabase SMTP, signed webhook secret, bounce/suppression and rate/spend controls in provider dashboards; place secrets only in the approved server-side store.
2. Verify FCM project/service account, platform configuration, token ownership and controlled device E2E.
3. If WhatsApp is desired, approve the supplier/cap, complete Meta Business/WABA/phone/template/webhook setup and obtain Israel rate-card evidence. Do not send secrets in chat.
4. If optional SMS fallback is desired, approve supplier, sender ID/number, budget caps and the explicit category allowlist after a written Israel quote.
5. Before any live activation, reconcile the all-in supplier ledger, active paying-user denominator, ≤₪15 ceiling, backup/recovery, provider limits and controlled release QA. No flag is set by GB-M31.

## Security

The receipt and lease RPCs are service-role-only; authenticated/anonymous callers cannot claim or finish deliveries. The worker's secret uses constant-time comparison. Every delivery resolves a pre-existing notification, user and current Garden/Child/Staff/Inspector relationship. Notification-linked logs retain the GB-M30 restrictive RLS policy. Provider API keys and device tokens are never returned through readiness. Digital Observer mock/shadow events remain blocked by GB-M30; no Observer core changed.

## Tests

The focused contact test covers email-only normal account, unverified phone, phone-required action and non-substitutable higher assurance. Rollback-only SQL against the synthetic Development database checks both migrations, verified email/phone-null acceptance, unconfirmed-email rejection, intent dedupe, private log RLS, unauthorized worker RPC denial, lease/finish idempotency and Resend receipt replay/out-of-order handling. No fixture is retained from that transaction. Management 228/228, domain 29/29, Parent/Manager contract 20/20, security 7/7, migration audit, release contract, typecheck and lint baseline passed on the feature worktree. Production build and exact integration evidence are recorded separately after completion.

## Live / Sandbox QA

No provider message or OTP was sent in this task. `LIVE EXTERNAL DELIVERY QA: BLOCKED BY PROVIDER/ENVIRONMENT`. Controlled email/FCM device delivery and phone-provider receipts need real authorized configuration. No real customer was notified.

## Monthly Cost Delta

New paid supplier commitment: **₪0/month**. Resend, FCM, WhatsApp, SMS, Vercel, Supabase, AWS and other provider plans were not changed. New queued Development metadata has unmeasured storage/compute cost; it is not labeled zero. See the cost model.

## <=15 ILS Target

The full platform cost ceiling cannot be certified from this branch: current invoices, active paying-user denominator, FX/tax and peak usage are unavailable. The modeled communications floor is well below ₪1–2/user at the stated low SMS rate, but excludes Meta and whole-platform costs. Owner release preflight must calculate and approve the real bounded forecast before activation.

## Carried QA Debt

GB-M21–M30 live role/browser/provider debt remains in the development ledger. GB-M29 and GB-M30 are integrated but Production release is deferred. GB-M31 adds controlled Resend/FCM sends, webhook receipts, optional phone OTP, real device delivery, separate-connection lease race and whole-platform supplier-cost evidence.

## Inputs For GB-M32

Keep private content out of external payloads and secure documents/attachments independently. If GB-M32 adds external document notices, emit only GB-M30 notification intents and reauthorize the document at destination. Resolve the provider/account/cost gates through explicit owner-controlled release, not by setting send flags to pass a test.

## Development / Production Status

Feature source is preserved on `codex/gb-m31-external-delivery` at `bf93be20dd859cae735dc35892429fc3788816a5`; PR #67 exact head `593d829de9f3a82168f3ec20f744a43002522002` passed 9/9 required checks and merged by ancestry into `integration/development` at `3556cb9a4282fdb9a28be889d4e60dc585eb8a8d`. A separate clean closure worktree preserved the Development-only migration approval at `e27ca721215d4de414b36f140e74d8e8b3b9722f`. Both reviewed migrations were applied in order to the guarded synthetic Development database, with receipt fingerprints `4947e75053f908796e31cbee7fc3abdb7868c7b5e19b5d522baef469e81a1778` and `784d9838e667f69dbd424dcf9e7217821e1eab438cdcf94851df6045b715fa8e`. RLS, service-only grants, indexes, synthetic receipt/replay and two-connection worker claim passed. The private pre-migration `pg_dump` archive is `/private/tmp/gb-m31-dev-pre-migration.dump`, SHA-256 `fa1a880c03279502438950adbb1ffa2f30106d1069cf9103d72e6f40c9ac382d`; archive listing was verified. Cumulative Product QA remains pending at this record point. `main` and Production are untouched. **DIGITAL OBSERVER CORE DIFF: 0**.
