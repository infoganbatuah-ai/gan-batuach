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

## Missing or unverified required configuration

| Configuration | State | Release impact |
|---|---|---|
| `CRON_SECRET` | Not present in Vercel Production inventory | **Blocker:** three configured cron routes fail closed |
| `APP_URL`, `NEXT_PUBLIC_APP_URL`, `AUTH_REDIRECT_URL` | Not present | **Blocker until canonical Auth/invitation redirects are verified** |
| Production Supabase Auth signup/Email SMTP/redirect settings | Provider dashboard proof unavailable | **Blocker for core account journeys** |
| `HEALTHCHECK_SECRET` | Not present | Deep health is unavailable; operational blocker |
| `FIELD_ENCRYPTION_KEY_VERSION`, `FIELD_HASH_PEPPER` | Not present | Must be reconciled with active encrypted/hash contracts before release |
| `PASSKEY_RP_ID`, `PASSKEY_ORIGIN` | Not present | Passkeys fail closed; optional capability block if UI is disabled |
| Payment/invoice provider credentials | Not present | Optional; electronic payment must remain unavailable and manual flows truthful |
| SMS/WhatsApp credentials | Not present | Optional by product policy |

## Cron inventory

- Hourly complaint SLA escalation.
- Daily permit expiry scan at 05:00.
- Daily Digital Observer event-media retention at 05:15.

All expect an authenticated cron secret. GB-M39 did not enable or invoke any Production job. No destructive Management retention job should be enabled until the owner-approved retention policy exists.

## Provider readiness

- Resend: credential names exist. Verified sending domain, sender, Production historical send, webhook and bounce proof remain unverified.
- FCM: credential names exist. Live submission/receipt proof remains unverified; payload minimization and token ownership are implemented.
- Payments: no verified live provider; manual tuition/subscription handling must remain canonical.
- SMS/WhatsApp: unconfigured and not required for normal Email-verified accounts.
- Digital Observer: optional Management integration; absent `production_verified` must render readiness/unavailable state.

## Environment separation

The QA/Development runtime uses an isolated local database/Auth/Storage topology and synthetic identities. Production project identity is different. No Production secret was copied into Git, reports or the QA runtime. GB-M39 made only read-only provider/API observations.
