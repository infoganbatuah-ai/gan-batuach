# Gan Batuach Management Production Configuration Inventory

Date: 2026-09-23. Values are intentionally omitted; this records names/readiness only.

## Vercel and domain

- Project: `gan-batuach`; framework Next.js; Production branch `main`; repository `infoganbatuah-ai/gan-batuach`.
- Verified domains: `ganbatuach.com` and `gan-batuach.vercel.app`.
- Latest Production deployment observed: `dpl_7N3RZmP34J4MTGsXq8JHQiq7bgiu`, READY, commit `8113d0607e4282dc8778540aa58c1502367f4221`.
- Development pushes are disabled by repository deployment policy; `main` is the only enabled deployment branch.

## Present Production variable names

Present names cover Supabase URL/publishable/service-role credentials, application environment, communication send mode, Email provider/from/mode/real-delivery switch, Resend API/webhook credentials, FCM project/service account/public Firebase configuration, field encryption current key, invitation signing, Sentry, Production activation flags, push provider/mode/real-delivery switch, video gateway integration and Google Maps.

Presence does not prove correctness, domain verification, least privilege, live delivery or receipt handling.

## GB-M40 Auth configuration proof

Read-only Supabase configuration export verified: canonical site URL `https://ganbatuach.com`; canonical callback/confirm redirects plus the existing Vercel domain and localhost Development entries; signup enabled; Email signup and Email confirmation enabled; 8-digit OTP with 3,600-second expiry; 1-minute Email frequency limit; 3,600-second JWT expiry; refresh-token rotation enabled with 10-second reuse interval; anonymous sign-in disabled; TOTP enrollment/verification enabled. Configuration is **verified**; a live Production signup/recovery journey was deliberately not executed because it would mutate a Production identity.

Supabase Auth uses custom Gmail SMTP (`smtp.gmail.com`, port 465) with a Gan Batuach sender identity. Password presence was confirmed without reading it. This is not Resend. Domain deliverability, bounce/webhook handling and historical Production send evidence remain unproved.

## Missing or unverified required configuration

| Configuration | State | Release impact |
|---|---|---|
| `CRON_SECRET` | Not present in Vercel Production inventory | **Blocker:** three configured cron routes fail closed |
| `APP_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_REDIRECT_URL` | Not present in Vercel inventory | Supabase Auth URLs match; explicit `NEXT_PUBLIC_APP_URL=https://ganbatuach.com` remains required so application-generated invitation/recovery links do not depend on a Vercel fallback |
| Production Supabase Auth signup/Email SMTP/redirect settings | **Configuration verified** read-only | Live Production identity journey not executed; controlled release-window smoke only |
| `HEALTHCHECK_SECRET` | Not present | Deep health is unavailable; operational blocker |
| `FIELD_ENCRYPTION_KEY_VERSION`, `FIELD_HASH_PEPPER` | Not present | GB-M40 makes a dedicated hash pepper mandatory in Production; configure both without rotating the existing encryption key |
| `PASSKEY_RP_ID`, `PASSKEY_ORIGIN` | Not present | Passkeys fail closed; optional capability block if UI is disabled |
| Payment/invoice provider credentials | Not present | Optional; electronic payment must remain unavailable and manual flows truthful |
| SMS/WhatsApp credentials | Not present | Optional by product policy |

## Cron inventory

- Hourly complaint SLA escalation: Management `CORE_REQUIRED` for automatic SLA processing; idempotent bounded RPC; source complaints remain usable while disabled.
- Daily permit expiry scan at 05:00: Management `CORE_REQUIRED` for automatic permit expiry/action notifications; no permit deletion.
- Daily Digital Observer event-media retention at 05:15: `DIGITAL_OBSERVER_OWNED` and `DESTRUCTIVE_POLICY_BLOCKED`; do not enable without the independent approved DO retention policy.
- Monthly inspection and inspection-reminder routes exist but are not scheduled in `vercel.json`; classify `OPTIONAL` until a Product schedule is approved.
- Demo expiration freeze exists for QA/demo and is `QA_ONLY` / `DESTRUCTIVE_POLICY_BLOCKED` in Production.

All expect an authenticated cron secret. GB-M39 did not enable or invoke any Production job. No destructive Management retention job should be enabled until the owner-approved retention policy exists.

## Provider readiness

- Resend: credential names exist. Verified sending domain, sender, Production historical send, webhook and bounce proof remain unverified.
- FCM: credential names exist. Live submission/receipt proof remains unverified; payload minimization and token ownership are implemented.
- Payments: no verified live provider; manual tuition/subscription handling must remain canonical.
- SMS/WhatsApp: unconfigured and not required for normal Email-verified accounts.
- Digital Observer: optional Management integration; absent `production_verified` must render readiness/unavailable state.

## Environment separation

The QA/Development runtime uses an isolated local database/Auth/Storage topology and synthetic identities. Production project identity is different. No Production secret was copied into Git, reports or the QA runtime. GB-M39 made only read-only provider/API observations.
