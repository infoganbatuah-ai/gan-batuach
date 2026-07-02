# PILOT FIX 4 – Environment Inventory

Date: 2026-07-03

## Baseline

| Item | Current finding |
|---|---|
| Branch | `main` |
| Build baseline | `npm run typecheck`, `npm run build`, `git diff --check` passed before this inventory |
| Supabase config | Uses `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY` |
| Vercel config | `vercel.json` exists with global security headers and one cron |
| Capacitor | `capacitor.config.ts`, `android/`, `ios/`, and `mobile:sync` script exist |
| Demo seed scripts | `scripts/seed-demo-full.mjs`, `scripts/seed-test-users.mjs` |
| Demo markers | `is_demo`, `demo_batch_id` exist in multiple migrations and seed helpers |

## Environment Matrix

| Environment | Purpose | Allowed data | Forbidden data | Users | Provider mode | Camera mode | AI mode | Payment mode | Legal/privacy | RLS status | Pilot readiness |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Local development | Developer validation | synthetic/demo only | real child/parent data, real documents, real camera, live payments | developers | mock/sandbox | disabled/mock/readiness | mock/shadow | disabled/mock/sandbox | draft only | local/static only unless explicitly tested | not pilot |
| Internal demo | founder/team/investor/stakeholder demo | synthetic demo data only | real children, real parents, real sensitive docs, live AI/camera/payment claims | controlled demo users | mock/sandbox | readiness/test only | mock/shadow only | disabled/sandbox/manual | drafts, visible disclaimer | not enough for real users | internal demo only |
| Staging / pilot | controlled pilot prep | limited real manager/kindergarten only after gates; parent/child only after signoff | mass onboarding, parent camera, raw AI, live payments without approval | approved pilot users | sandbox/test by default | internal/gateway only by approval | shadow only by default | manual/sandbox unless approved | external review/signoff required | manual Supabase verification required | prep only |
| Production | future public/commercial use | real production data only after all gates | demo/test data, unverified users, unreviewed camera/AI | real customers | production/live only after provider setup | production only after legal/security | production only after legal/security | live only after provider/legal | must be complete | must pass real env RLS | not approved now |

## Vercel Assumptions

Known file: `vercel.json`

Expected environments:

- Development / preview
- Internal demo preview or protected deployment
- Staging/pilot deployment
- Production deployment

Required manual confirmation:

- Which Vercel project maps to internal demo.
- Which deployment, if any, maps to staging/pilot.
- Whether production environment variables are separated from preview/staging.
- Whether Vercel protection/access control is enabled for internal demo and pilot.

## Supabase Assumptions

Required manual confirmation:

- Which Supabase project is local/dev/demo.
- Which Supabase project is staging/pilot.
- Whether production Supabase exists separately.
- Whether all latest migrations are applied to the intended pilot project.
- Whether RLS tests from PILOT FIX 2 were run with real JWT users.

## Storage Buckets

Expected buckets by app behavior:

- child documents
- staff documents
- inspection evidence
- reports
- public assets/logos/gallery
- camera/AI evidence only if enabled

Sensitive buckets must remain private and signed URL based.

## Auth Providers

Current assumptions:

- Supabase Auth is primary.
- Passkeys are present in the app.
- Test account creation can use server-side/admin scripts only.
- No passwords should be committed.

## Provider / Mode ENV Names

List names only:

- `PAYMENT_PROVIDER`, `PAYMENT_MODE`, `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET`
- `INVOICE_PROVIDER`, `INVOICE_MODE`, `INVOICE_API_KEY`, `INVOICE_WEBHOOK_SECRET`
- `EMAIL_PROVIDER`, `EMAIL_MODE`, `EMAIL_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `SMS_PROVIDER`, `SMS_MODE`, `SMS_API_KEY`, `SMS_SENDER_ID`
- `WHATSAPP_PROVIDER`, `WHATSAPP_MODE`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `PUSH_PROVIDER`, `PUSH_MODE`, `FCM_PROJECT_ID`, `APNS_KEY_ID`
- `CAMERA_GATEWAY_MODE`, `CAMERA_GATEWAY_URL`, `CAMERA_GATEWAY_SECRET`, `CAMERA_TOKEN_SECRET`
- `AI_PROVIDER`, `AI_PROVIDER_MODE`, `AI_PROVIDER_API_KEY`, `AI_INFERENCE_ENDPOINT`, `AI_SHADOW_MODE_ENABLED`
- `DIGITAL_OBSERVER_PRODUCT_MODE`, `DIGITAL_OBSERVER_CAMERA_MODE`, `DIGITAL_OBSERVER_AI_MODE`

No secret values were printed.

