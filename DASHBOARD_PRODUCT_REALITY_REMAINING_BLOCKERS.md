# Dashboard Product Reality - Remaining Blockers

## Counts

- Critical dashboard UX blockers: **0**
- High dashboard UX blockers: **0**
- High backend blocker: **1**
- Native/mobile distribution blocker: **1**, only if the first pilot includes Capacitor builds

## High backend blocker

### DO-RLS-001 - Digital Observer membership policy recursion

- Area: Digital Observer data source
- Evidence: authenticated requests to `observer_sites` and `observer_site_memberships` return PostgreSQL `42P17`, infinite recursion in the `observer_site_memberships` policy.
- Root cause: the existing membership read policy queries `observer_site_memberships` from inside a policy on the same table.
- Fix prepared: `supabase/migrations/20260814000100_observer_membership_rls_recursion_fix.sql`.
- Safety: the migration replaces recursion with security-definer access helpers, revokes public execution and grants only authenticated/service roles. It preserves owner, active member, admin and authorized kindergarten scope.
- Current state: **READY_TO_APPLY, NOT YET APPLIED TO THE REMOTE SUPABASE PROJECT**.
- Required action: apply the migration to the correct `gan-batuah` demo-to-pilot Supabase project, then rerun the authenticated Digital Observer data check.
- Pilot impact: blocks claiming that Digital Observer live data is operational. It does not break the honest readiness UI and does not block Gan Batuach dashboard visual review.

## Native reminder

- Capacitor is configured.
- Dashboard/mobile CSS changed.
- Run `npx cap sync` before native Android/iOS QA.
- This does not block web-only internal review.

## Closed security follow-up

- Parent family, camera listing and playback authorization now use the authenticated user client and RLS only.
- Invalid optional camera-scope queries against nonexistent parent/child fields were removed.
- No Service Role fallback remains in these parent-facing paths.
- Parent camera viewing remains locked unless the stored camera policy, assignment, attendance, MFA and gateway checks all pass.

## Recommendation

`DASHBOARDS_READY_FOR_DANIEL_INTERNAL_REVIEW`

Do not claim Digital Observer data readiness until DO-RLS-001 is applied and rechecked. Do not move to controlled pilot solely on this UX result; existing legal, real-environment RLS and operational signoffs remain separate gates.
