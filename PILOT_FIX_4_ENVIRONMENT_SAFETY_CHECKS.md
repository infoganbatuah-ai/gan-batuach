# PILOT FIX 4 – Environment Safety Checks

Date: 2026-07-03

## Static Checks Completed

| Check | Result |
|---|---|
| `.env.example` lists secret env names only | PASS |
| `SUPABASE_SERVICE_ROLE_KEY` is server-only naming | PASS_STATIC |
| Seed scripts use service role in Node scripts, not client code | PASS_STATIC |
| `capacitor.config.ts` uses env names, not committed secrets | PASS |
| `vercel.json` has security headers | PASS |
| Demo seed data uses `is_demo` / `demo_batch_id` | PASS_STATIC |
| Production build passes | PASS |

## Safety Rules

- Do not run `seed-demo-full` against production or pilot unless target environment is confirmed and a backup exists.
- Do not run `seed-test-users` without explicit passwords provided outside code.
- Do not expose service-role keys to browser/client bundles.
- Do not enable live provider modes in QA.
- Do not enable real camera gateway or parent viewing by default.
- Do not enable raw AI parent summaries.
- Do not place sensitive screenshots/test files in `public/`.

## Required Manual Checks

- Confirm real Vercel environment variable values are separated by environment.
- Confirm Supabase pilot project is separate from demo/production.
- Confirm storage buckets for documents/evidence are private.
- Confirm payment/invoice/notification provider modes are disabled/mock/sandbox for pilot prep.
- Confirm no live SMS/WhatsApp/email broadcast is enabled.
- Confirm no camera gateway secret or AI provider key is visible in client.

## Current Blockers

- Real Supabase environment verification remains required before real users.
- Legal/privacy signoff remains required before real parent/child data.
- Feature flag enforcement model remains required before real pilot.

