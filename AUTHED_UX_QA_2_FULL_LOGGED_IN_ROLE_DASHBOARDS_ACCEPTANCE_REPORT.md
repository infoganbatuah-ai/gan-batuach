# AUTHED UX/UI QA 2 - Full Logged-In Role Dashboards Acceptance Report

## Build / Baseline

- typecheck: PASS
- build: PASS
- git diff --check baseline: PASS
- push: not performed

## Demo Account / Login Readiness

Parent, assigned Manager, assigned Staff, assigned Inspector and Admin demo users exist in seed definitions. Unassigned Staff, unassigned Inspector and Digital Observer authenticated accounts remain missing/unconfirmed.

## Session Switching

Session switching was not completed for non-parent roles. The Parent role remained the only accepted authenticated browser session.

## Visual Evidence

Accepted screenshots:

- Parent mobile 390
- Parent tablet 768
- Parent desktop 1366

Other role screenshot files created during attempted runs are not accepted because session identity was not proven.

## Responsive First-Load Result

Parent: PASS for tested viewports.

All other roles: BLOCKED_AUTH_SESSION_SWITCH or BLOCKED_MISSING_DEMO_LOGIN.

## Role Results

| Role | Result |
|---|---|
| Parent | PASS_PARTIAL |
| Kindergarten Manager | BLOCKED_AUTH_SESSION_SWITCH |
| Staff unassigned | BLOCKED_MISSING_DEMO_LOGIN |
| Staff assigned | BLOCKED_AUTH_SESSION_SWITCH |
| Inspector unassigned | BLOCKED_MISSING_DEMO_LOGIN |
| Inspector assigned | BLOCKED_AUTH_SESSION_SWITCH |
| Admin | BLOCKED_AUTH_SESSION_SWITCH |
| Digital Observer | BLOCKED_MISSING_DEMO_LOGIN |

## Critical Button QA

Parent dashboard links were visible. Deep workflow button QA for all roles remains blocked.

## Dummy / Static Data Regression

Parent runtime: PASS for stale date/fake live checks.

Manager static code check: Product Reality Fix 1 removed fake date/count/time fallbacks.

Manager runtime: not accepted.

## Backend Error Regression

Previous `children.kindergarten_id` issue was not found in the Parent dashboard code path. During the accepted Parent dashboard run, server logs revealed the actual blocking schema mismatch: `children.pickup_status` did not exist. A safe code fix removed that nonexistent field from the Parent children select in `lib/domain/parent-family.ts`, and the Parent dashboard was reloaded without observing the same `pickup_status` error.

Full Supabase/schema verification remains out of scope.

## Security / Truthfulness

Parent runtime did not show obvious secret exposure, raw AI, fake live payment, fake live camera or fake live AI.

Admin/provider pages were not accepted logged-in.

## Safe Fixes Applied

One safe backend query fix was applied: `pickup_status` was removed from the Parent children query in `lib/domain/parent-family.ts`. No auth, RLS, service-role, or live-feature behavior was changed.

## Blocker Register

See `AUTHED_UX_QA_2_BLOCKER_REGISTER.md`.

## Final Recommendation

AUTHED_UX_QA_2_BLOCKED_PARTIAL_AUTH_ACCESS

Do not proceed to Controlled Pilot Prep 1. Parent authenticated dashboard is partially accepted, but all required role dashboards were not accepted.
