# MANUAL SIGNOFF 1 - Environment Separation Signoff

Date: 2026-07-12

## Environment Details

- Current environment name:
- Supabase project:
- Vercel environment:
- App URL:
- Owner:
- Date:

## Allowed / Forbidden Data

- Allowed data:
- Forbidden data:
- Demo data marker:
- Pilot data marker:
- Real data admission rule:

## Provider Modes

- Payment mode:
- Invoice mode:
- Notification mode:
- Camera mode:
- AI mode:
- Digital Observer mode:

## Safety Confirmation

- Demo/internal data is separated from pilot data: yes / no
- Pilot data is separated from production data: yes / no
- No live provider accidentally enabled: yes / no
- No production secrets exposed to client: yes / no
- Demo users cannot access pilot data: yes / no / not tested
- Pilot users cannot access demo/private QA data: yes / no / not tested
- Rollback/delete process documented: yes / no

## Signoff Options

Select one:

- environment_signed_off_for_synthetic_only
- environment_signed_off_for_manager_only
- environment_signed_off_for_limited_staff
- environment_not_ready_for_real_parent_child_data
- environment_failed

## Notes

-

If demo and pilot data are not separated, real pilot remains blocked.
