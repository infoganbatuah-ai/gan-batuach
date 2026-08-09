# DEMO AUTH SETUP 1 - Safe Demo Users, Role Sessions & Authenticated QA Access Report

## Build / Baseline

- typecheck baseline: PASS
- build baseline: PASS
- git diff --check baseline: PASS
- push: not performed

## Required Role Matrix

See `DEMO_AUTH_SETUP_1_REQUIRED_ROLE_MATRIX.md`.

## Existing Demo User Discovery

Assigned Parent, Manager, Staff, Inspector and Admin demo accounts exist in `scripts/seed-demo-full.mjs`. Passwords are known to the seed source but are not printed in this report.

Missing/unconfirmed accounts:

- Staff unassigned
- Inspector unassigned
- Digital Observer authenticated owner/admin

See `DEMO_AUTH_SETUP_1_EXISTING_DEMO_USER_DISCOVERY.md`.

## Chosen Safe Auth Access Strategy

Use normal Supabase login only, with manual credentials or ignored local env credentials. No bypass helper was added. GET logout was added to support safe role switching.

See `DEMO_AUTH_SETUP_1_SAFE_AUTH_ACCESS_STRATEGY.md`.

## Credentials Handling Plan

`.env.qa-demo.example` was created with placeholders only. Real values must go into ignored local files or be entered manually by Daniel.

See `DEMO_AUTH_SETUP_1_CREDENTIALS_HANDLING_PLAN.md`.

## Safe User Creation Plan

Two safe paths are available:

1. Manual Supabase Dashboard creation by Daniel.
2. Optional guarded script: `npm run qa:create-demo-role-users`.

The script was created but not run because local QA passwords were not provided.

See `DEMO_AUTH_SETUP_1_SAFE_USER_CREATION_PLAN.md`.

## Synthetic Data Linking Plan

See `DEMO_AUTH_SETUP_1_SYNTHETIC_DATA_LINKING_PLAN.md`.

## Session Switching Instructions

See `DEMO_AUTH_SETUP_1_QA_SESSION_SWITCHING_INSTRUCTIONS_HE.md`.

## QA Login Helper Decision

No client-side login helper was implemented. This avoids backdoor risk.

See `DEMO_AUTH_SETUP_1_QA_LOGIN_HELPER_DECISION.md`.

## Role Route Verification

Routes exist for Parent, Manager, Staff, Inspector, Admin and Digital Observer dashboards. GET logout route now works as a browser-safe sign-out path.

See `DEMO_AUTH_SETUP_1_ROLE_DASHBOARD_ROUTE_VERIFICATION.md`.

## Parent Query Regression Check

The previous `children.pickup_status` query issue remains fixed at code/build level.

See `DEMO_AUTH_SETUP_1_PARENT_QUERY_REGRESSION_CHECK.md`.

## Smoke Test

No new all-role login smoke test was run because credentials were not provided in a safe local form. Parent remains previously proven from AUTHED UX/UI QA 2.

See `DEMO_AUTH_SETUP_1_AUTH_READINESS_SMOKE_TEST.md`.

## Updated Auth Blocker Register

See `DEMO_AUTH_SETUP_1_UPDATED_AUTH_BLOCKER_REGISTER.md`.

## Safe Fixes Applied

See `DEMO_AUTH_SETUP_1_SAFE_FIXES_APPLIED.md`.

## Final Recommendation

DEMO_AUTH_READY_MANUAL_CREDENTIALS_REQUIRED

The auth-access blocker is reduced but not fully closed. AUTHED UX/UI QA 3 can proceed only after Daniel provides local/manual demo credentials and creates or confirms the missing Staff unassigned, Inspector unassigned and Digital Observer accounts.
