# PILOT BLOCKER FIX 1 - Environment Separation Closure

Date: 2026-07-12

## Closure Status

Status: **reduced / manual_required**

The existing environment plan documents local, internal demo, staging/pilot and production boundaries. This phase does not create or mutate remote environments.

## Required Environment Rules

| Environment | Allowed data | Forbidden data | Provider mode | Pilot status |
|---|---|---|---|---|
| Local | synthetic only | real child/parent data | mock/manual | development only |
| Internal demo | synthetic only | real child/parent/documents | mock/manual/readiness | demo only |
| Staging/pilot | synthetic, then limited real data after gates | real child/parent data before RLS/legal signoff | manual/sandbox only | manual signoff required |
| Production | none until future approval | pilot experimentation | production only after full gates | not approved |

## Manual Confirmation Required

Daniel must confirm:

- Supabase project ref for demo.
- Supabase project ref for staging/pilot.
- Supabase project ref for production if present.
- Vercel environment used for internal demo.
- Vercel environment used for pilot/staging.
- Which environment variables are set in each environment, names only for reports.
- That no real child/parent data exists in demo/internal QA.
- That no live payment, SMS, WhatsApp, push, camera parent viewing or live AI is enabled.

## Demo vs Pilot Data Separation

Required markers remain:

- `environment`
- `data_scope`
- `is_demo`
- `is_synthetic`
- `pilot_id`
- `tenant_id`
- `kindergarten_id`

If the schema lacks these markers, the first pilot must rely on separate Supabase projects and strict manual data admission.

## Safe Fix Result

No destructive seed scripts were run. No environment mutation was performed.

Remaining blocker: **environment_manual_signoff_required**.
