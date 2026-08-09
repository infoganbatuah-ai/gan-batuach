# DEMO AUTH SETUP 1 - Safe User Creation Plan

## Option A - Manual Supabase Dashboard Creation

Daniel can create missing users manually in Supabase:

1. Open Supabase project `gan-batuah`.
2. Confirm the environment is demo/staging/pilot-safe, not production with real users.
3. Go to Authentication -> Users.
4. Create a new auth user with a synthetic QA email.
5. Set a temporary password manually. Do not put it in git or reports.
6. Confirm email for the user.
7. In the `profiles` table, create/update the profile row with the same auth user id.
8. Set the correct `role`.
9. Set `active` according to the required role state.
10. Link only synthetic data.
11. Verify login through the normal `/app/login` screen.

Suggested missing accounts:

| Role state | Email placeholder | Profile setup |
|---|---|---|
| Staff unassigned | `qa.staff.unassigned@demo.ganbatuach.com` | role `staff`, active `true`, no `garden_id`, no staff assignment |
| Inspector unassigned | `qa.inspector.unassigned@demo.ganbatuach.com` | role `inspector`, active `false` or no inspector row, no garden assignment |
| Digital Observer | `qa.digital.observer@demo.ganbatuach.com` | role `network_manager` or valid app role, synthetic observer site membership |

## Option B - Safe Script

Added:

`scripts/qa/create-demo-role-users.mjs`

Run through:

`npm run qa:create-demo-role-users`

Script guardrails:

- requires `QA_DEMO_USER_SETUP_CONFIRM=I_UNDERSTAND_SYNTHETIC_DEMO_ONLY`;
- requires `QA_DEMO_ENVIRONMENT=local|demo|staging|pilot`;
- refuses production;
- uses server-side service role only from local env;
- never prints passwords;
- does not commit credentials;
- creates/updates synthetic users only when matching password env vars are supplied;
- writes `DEMO_AUTH_SETUP_1_SCRIPT_RESULTS.md`;
- creates a synthetic Digital Observer site/membership when Digital Observer password is supplied.

The script was not run in this phase because local QA passwords were not provided.
