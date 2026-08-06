# AUTH ACCESS FIX 1 - Authenticated QA Readiness Report

## Recommendation

`AUTH_QA_ACCESS_READY_MANUAL_LOGIN_REQUIRED`

## Demo User Availability

Demo users are available in seed definitions for Parent, Manager, Staff assigned, Inspector assigned, and Admin. Dedicated unassigned Staff, unassigned Inspector, and Digital Observer accounts still require confirmation or creation.

## Account Creation Plan

Use existing seeded demo users where available. Create only missing unassigned/Digital Observer users in a demo/staging/pilot-safe environment with synthetic data.

## Session Switching Plan

Use normal auth only:

- manual logout/login per role, or
- isolated browser profiles/contexts.

No QA login helper or auth bypass was implemented.

## QA Login Helper Decision

Not implemented for safety. Existing login/logout flow is sufficient if credentials/sessions are available.

## Parent Children Query

Fixed direct `children.kindergarten_id` selections in Parent-facing code paths and replaced them with stable `garden_id` usage.

## Role Route Map

Documented in `AUTH_ACCESS_FIX_1_ROLE_DASHBOARD_ROUTE_MAP.md`.

## Synthetic Data Requirements

Documented in `AUTH_ACCESS_FIX_1_SYNTHETIC_DATA_REQUIREMENTS_FOR_AUTHED_QA.md`.

## Manual Daniel Instructions

Documented in `AUTH_ACCESS_FIX_1_MANUAL_LOGIN_INSTRUCTIONS_FOR_DANIEL.md`.

## Remaining Blockers

- Manual credentials/session access required for every role.
- Unassigned staff account not confirmed.
- Unassigned inspector account not confirmed.
- Digital Observer authenticated account not confirmed.
- AUTHED UX/UI QA 2 must verify the Parent query fix in runtime logs.

## Can AUTHED UX/UI QA 2 Run?

Yes, with manual login or isolated browser contexts. It should not claim all-role acceptance until each role is actually logged in and tested.

