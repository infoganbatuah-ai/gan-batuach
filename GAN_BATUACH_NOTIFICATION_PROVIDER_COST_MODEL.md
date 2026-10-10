# Communication provider cost model — GB-M31

Pricing research: **2026-09-20**. USD→ILS illustration uses the [Bank of Israel representative rate for 2026-09-18](https://www.boi.org.il/en/economic-roles/financial-markets/exchange-rates/), **₪3.028/USD**. Actual invoice conversion, tax, carrier/Meta fees and month of billing can differ. This is a scenario, not a supplier invoice or permission to buy/enable anything.

## Compared providers and recommendation

- [Firebase Cloud Messaging](https://firebase.google.com/pricing) lists FCM itself as no-cost. Use as first external channel when controlled device E2E and provider configuration pass; Vercel/Supabase/app traffic still has a cost.
- [Resend](https://resend.com/pricing) lists a free 3,000-email monthly tier with a 100/day limit. Its [published Pro overage example](https://resend.com/changelog/pay-as-you-go-pricing) is $20 for 50,000/month and $0.90 per extra 1,000 when overage is enabled. The owner already has an account; its actual plan and spend cap were not independently verified. Keep email transactional, privacy-safe and rate-limited.
- [Meta WhatsApp Business Platform](https://whatsappbusiness.com/products/platform-pricing/) prices by recipient market and template category. The exact current Israel utility/authentication price must be read from the owner account/rate card before activation; it is **unknown in this forecast**. Direct Meta avoids the [Twilio WhatsApp](https://www.twilio.com/en-us/whatsapp/pricing) $0.005/message handling fee but requires WABA/business/number/template/webhook operations. Prefer direct Meta only if that operational setup and billing cap are acceptable; otherwise compare a controlled Twilio pilot. Do not classify operational alerts as Marketing without provider review.
- [Twilio Israel SMS](https://www.twilio.com/en-us/sms/pricing/il) lists $0.2575 per outbound segment, with possible carrier/number/failed processing charges. This is too costly for routine fan-out. Vonage/local Israeli vendors need written quotes for actual route, sender approval, delivery receipts, minimums and volume tiers before selection. SMS remains optional fallback.

## Explicit scale scenario

Assumptions **per active user per month**: eight FCM pushes, one transactional email, 0.1 WhatsApp utility/authentication template and 0.02 one-segment SMS fallback. All sends are synthetic forecast counts; actual preference mix and deliverability are unknown. Email column assumes free tier where within both monthly and daily limits; at 10k/100k users it uses Pro with enabled overage solely as a hypothetical comparison. WhatsApp column is **Twilio markup only**; add the current Meta Israel fee × WhatsApp messages. No provider has been activated.

| Active users | Push sends / FCM fee | Email sends / illustrative Resend fee | WhatsApp sends / Twilio markup | SMS segments / Twilio fee | Known provider floor, USD | Known floor, ILS | Known floor per user, ILS |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 100 | 800 / $0 | 100 / $0 | 10 / $0.05 | 2 / $0.515 | $0.565 | ₪1.71 | ₪0.0171 |
| 1,000 | 8,000 / $0 | 1,000 / $0 | 100 / $0.50 | 20 / $5.15 | $5.65 | ₪17.11 | ₪0.0171 |
| 10,000 | 80,000 / $0 | 10,000 / $20 | 1,000 / $5.00 | 200 / $51.50 | $76.50 | ₪231.64 | ₪0.0232 |
| 100,000 | 800,000 / $0 | 100,000 / $65* | 10,000 / $50.00 | 2,000 / $515.00 | $630.00 | ₪1,907.64 | ₪0.0191 |

\* $65 is the $20 Pro base plus 50 one-thousand-email overage buckets at $0.90; the owner has **not** enabled paid overage. A different current Resend plan or daily/volume restrictions can change this.

The known floor excludes Meta fees, taxes, payment FX spread, delivery failures, retries, Vercel/Supabase/AWS traffic and all other platform expenses. It is **not** the complete ≤₪1–2 communication cost/user proof. At the modeled rate, the remaining communication headroom is large, but the WhatsApp Meta rate, supplier caps, actual send volume and invoices must be verified before activation. One routine SMS/user would cost about ₪0.78/user at the cited Twilio one-segment rate and FX even before other fees; multi-segment Hebrew SMS can cost more.

## Whole-platform ₪15 ceiling

The repository contract uses **active paying users**, excluding staff/free/test users, as denominator. This table uses active users only because the actual distinct active **paying** count and current supplier cost ledger were unavailable in this task. Therefore it cannot establish the whole-platform ₪15 ceiling. The owner-controlled release preflight must combine real Supabase, Vercel, AWS, GitHub/CI, AI, domain, backup, messaging, payment and other attributable invoices, tax and conversion, then model current/2×/5× load with the paying-user denominator. If there are zero paying users, report fixed burn and a break-even count rather than a per-user compliance claim.

## Monthly cost delta for this push

No paid provider, plan, number, overage or live sending was activated. **New committed fixed supplier spend: ₪0/month.** Resend, FCM, WhatsApp and SMS incremental provider charges are ₪0 while the worker and paid channels remain disabled. Vercel, Supabase, AWS and other infrastructure plan changes: **none**. Incremental Development/Production DB storage and future queue/worker compute are **unmeasured**, not asserted to be zero; no new polling scheduler was enabled. Any activation requires a measured forecast, volume/rate cap and the explicit owner approval required by `AGENTS.md`.
