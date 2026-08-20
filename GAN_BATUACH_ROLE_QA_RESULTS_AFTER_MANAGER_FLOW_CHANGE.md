# Gan Batuach - Role QA Results After Manager Flow Change

Date: 2026-08-20

## Remote security and login evidence

- 9/9 normal Supabase logins passed.
- 9/9 boundary assertions passed.
- No QA browser role could read camera credentials.
- The temporary private camera-snapshot sentinel remained hidden and was deleted after the test.
- Admin schema and dashboard probes completed with zero failures after the migrations.

Evidence: `qa-evidence/gan-batuach-completion-audit-1/role-boundary-probes.json`.

## Role states

| State | Login | Expected first destination | Scope/result | Visual result |
|---|---:|---|---|---:|
| Parent assigned | PASS | `/dashboard/parent/family-home` | Own synthetic family context | PASS |
| Parent unassigned | PASS | `/dashboard/parent` | No child/garden data | PASS |
| Manager | PASS | `/dashboard/garden/operations` | Own synthetic kindergarten | PASS |
| Staff assigned | PASS | `/dashboard/staff` | Assigned work context | PASS |
| Staff unassigned | PASS | `/dashboard/staff` | No child/parent context | PASS |
| Inspector assigned | PASS | `/dashboard/inspector/control-center` | Two assigned synthetic gardens | PASS |
| Inspector unassigned | PASS | `/dashboard/inspector/apply` | No garden access | PASS |
| Admin | PASS | `/dashboard/admin` | Synthetic admin control center | PASS |
| Digital Observer | PASS | `/digital-observer/dashboard` | Separate synthetic Observer site | PASS |

## Focused responsive evidence

New final evidence is stored under `qa-evidence/manager-registration-live-flow/`:

- manager registration: 390x844, 768x1024 and 1440x900;
- assigned/unassigned role dashboard evidence;
- assigned inspector after route repair: desktop and mobile;
- unassigned inspector after route repair: mobile;
- assigned parent after final load: desktop viewport.

Focused final metrics:

- assigned inspector desktop: 1440 viewport width, 1440 document width, 0 clipped controls;
- assigned inspector mobile: 390 viewport width, 390 document width, 0 clipped controls;
- unassigned inspector mobile: 390 viewport width, 390 document width, 0 clipped controls;
- assigned parent desktop: 1440 viewport width, 1440 document width, 0 clipped controls, no stuck loading state.

## Notes

- The date in the application header is generated from the current Israel date.
- Historical labels such as `updated 25.5.2026` come from synthetic record timestamps and are not hardcoded current-date claims.
- Provider, camera and AI screens intentionally remain readiness/manual/shadow states.

## Result

`ALL_NINE_SYNTHETIC_ROLE_STATES_AUTHENTICATED_SECURITY_BOUNDARIES_PASS_RESPONSIVE_FINAL_CHECKS_PASS`
