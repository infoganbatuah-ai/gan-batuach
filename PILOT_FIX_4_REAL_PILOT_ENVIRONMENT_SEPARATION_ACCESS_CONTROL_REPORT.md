# PILOT FIX 4 – Real Pilot Environment Separation & Access Control Report

Date: 2026-07-03

## Result

PILOT FIX 4 completed as a planning and readiness phase. No real child/parent data was onboarded. No seed scripts were run. No live payments, cameras or AI were activated.

Final recommendation: **ENVIRONMENT_READY_FOR_PILOT_FIX_5**

Constraint: synthetic data only. Real pilot remains blocked until RLS/legal/environment gates are manually verified and signed off.

## Environment Inventory

Created:

- `PILOT_FIX_4_ENVIRONMENT_INVENTORY.md`

Key result:

- local/internal demo/staging-pilot/production are defined as separate logical environments.
- real mapping of Supabase/Vercel projects must be confirmed manually.

## Separation Policy

Created:

- `PILOT_FIX_4_ENVIRONMENT_SEPARATION_POLICY.md`

Key rule:

- internal demo is synthetic only.
- pilot/staging may receive limited real users only after gates.
- production is not approved.

## Real Data Admission Rules

Created:

- `PILOT_FIX_4_REAL_DATA_ADMISSION_RULES.md`

Key rule:

- no real parent/child data before RLS verification and legal/privacy consent readiness.

## Demo vs Pilot Separation

Created:

- `PILOT_FIX_4_DEMO_VS_PILOT_DATA_SEPARATION.md`

Findings:

- existing demo markers: `is_demo`, `demo_batch_id`
- seed script uses `[DEMO]` prefix
- pilot-specific `pilot_id/environment_scope/tenant_id` is not confirmed consistently across all tables

## Pilot Tenant / Scope Model

Created:

- `PILOT_FIX_4_PILOT_TENANT_SCOPE_MODEL.md`

Recommended first pilot:

- one controlled kindergarten
- limited manager/admin/staff/inspector flow
- parents only after signoff
- no parent camera viewing
- AI shadow only
- manual/sandbox payments

## Seed/Test Accounts Plan

Created:

- `PILOT_FIX_4_SEED_TEST_ACCOUNTS_PLAN.md`

Findings:

- `scripts/seed-test-users.mjs` exists but is too small for A/B boundary tests.
- `scripts/seed-demo-full.mjs` exists but resets demo data and must be treated as demo-only.

## Seed Data Plan

Created:

- `PILOT_FIX_4_SEED_DATA_PLAN.md`

Required synthetic dataset includes:

- Kindergarten A/B
- Parent A/B
- Child A/B
- Manager A/B
- assigned/unassigned staff
- assigned/unassigned inspector
- payments, camera, AI, document, message, inspection fixtures

## Access-Control Dataset Requirements

Created:

- `PILOT_FIX_4_ACCESS_CONTROL_TEST_DATASET_REQUIREMENTS.md`

Required negative tests include:

- Parent A cannot see Child B.
- Manager A cannot see Kindergarten B.
- Staff unassigned cannot see children.
- Inspector assigned A cannot see Kindergarten B.
- Parent/staff/inspector cannot see provider records.
- Parent cannot see raw AI.
- Users cannot access camera credentials.

## Feature Flag / Pilot Access Configuration

Created:

- `PILOT_FIX_4_FEATURE_FLAG_PILOT_ACCESS_CONFIGURATION.md`

Finding:

- unified server-enforced pilot feature flag model was not confirmed.
- safe defaults are documented.

## UI Labels

Required labels:

- "מצב דמו פנימי"
- "נתונים סינתטיים"
- "סביבת פיילוט"
- "לא פרודקשן"
- "מצלמות במצב בדיקה"
- "AI במצב Shadow / בדיקה"
- "תשלומים במצב Sandbox / ידני"

Do not over-label future production users; labels must be environment-aware.

## Admin Control Panel Readiness

Current status: partially ready / improvements required.

Admin has many readiness and provider dashboards, but a single pilot environment control panel was not confirmed.

Required before real pilot:

- current environment/scope
- pilot kindergarten/users
- feature flags
- provider/camera/AI/payment modes
- RLS/legal status
- support/incident owner

## Environment Safety Checks

Created:

- `PILOT_FIX_4_ENVIRONMENT_SAFETY_CHECKS.md`

Static checks passed:

- build passes
- `.env.example` lists env names only
- service role appears in server/admin script contexts
- seed scripts are Node scripts, not client code
- demo markers exist

Manual checks still required:

- Vercel env separation
- Supabase project separation
- storage privacy
- provider modes
- no live broadcast/payment/camera/AI

## Manual Setup Instructions

Created in Hebrew:

- `PILOT_FIX_4_MANUAL_SETUP_INSTRUCTIONS_FOR_DANIEL.md`

## Blocker Register

Created:

- `PILOT_FIX_4_ENVIRONMENT_ACCESS_BLOCKER_REGISTER.md`

High blockers:

- Supabase environment separation not manually confirmed.
- RLS manual signoff still required before real users.
- Legal/privacy signoff still required before real child/parent data.
- Unified server-enforced feature flags not confirmed.

## Capacitor Sync

Capacitor is configured and responsive/layout CSS changed in the previous phase.

Recommendation:

- run `npx cap sync` before the next native/mobile validation.
- this phase does not require full native/mobile QA.

## Final Recommendation

**ENVIRONMENT_READY_FOR_PILOT_FIX_5**

Allowed next step:

- PILOT FIX 5 with synthetic A/B dataset and synthetic test accounts.

Not allowed yet:

- real parent onboarding
- real child data
- real child documents
- parent camera viewing
- live AI alerts
- live payments
- public production/pilot launch

