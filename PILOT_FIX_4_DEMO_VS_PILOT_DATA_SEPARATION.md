# PILOT FIX 4 – Demo vs Pilot Data Separation

Date: 2026-07-03

## Current Markers Found

The repository already uses:

- `is_demo`
- `demo_batch_id`
- `[DEMO]` name prefix in `scripts/seed-demo-full.mjs`

Several migrations add `is_demo` / `demo_batch_id` to important operational tables.

## Recommended Markers

Use where supported:

- `environment`
- `data_scope`
- `is_demo`
- `is_synthetic`
- `pilot_id`
- `tenant_id`
- `kindergarten_id`
- `created_by_seed`
- `demo_profile_type`

## Rules

- Demo data must be clearly labeled with `is_demo=true` and `demo_batch_id`.
- Synthetic QA records must not use real child/parent/staff details.
- Pilot data must not appear in investor/demo screens.
- Demo users must not access pilot data.
- Pilot users must not access demo admin/testing data unless explicitly intended and logged.
- Screenshots must use synthetic data unless Daniel gives explicit approval.
- Reports must say when data is demo/synthetic.

## Current Gap

The schema has demo markers in many places, but pilot-specific tenant fields are not consistently present everywhere. For the first controlled pilot, use `kindergarten_id/garden_id` and pilot program tables where available. A future migration may be needed for consistent `environment_scope`, `pilot_id` and `tenant_id` across all sensitive tables.

## Migration Recommendation

Do not create a migration in this phase. Before real pilot, design a safe additive migration for missing pilot markers if manual RLS tests show a gap.

