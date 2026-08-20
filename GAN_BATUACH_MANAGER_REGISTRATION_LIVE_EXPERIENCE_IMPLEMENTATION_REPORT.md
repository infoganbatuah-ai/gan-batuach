# Gan Batuach - Manager Registration And Live Experience Implementation

Date: 2026-08-20  
Environment: synthetic Demo (`gan-batuah`)  
Push: not performed

## Implemented manager journey

The manager journey now runs as one continuous five-stage setup without an admin approval stop:

1. Manager identity and kindergarten details.
2. Age groups, pricing, staff and camera readiness.
3. Gan Batuach subscription summary and payment preference.
4. Optional parent/child invitations; this stage can be skipped.
5. Confirmation, safety locks and dashboard activation.

Server behavior:

- the manager profile becomes active for onboarding immediately;
- final activation requires at least one age group;
- the kindergarten becomes active after the manager completes the flow;
- a 14-day trial is created with `charge_today_nis: 0`;
- the recurring base price is NIS 700 plus the configured additional-class increment;
- no card details are collected locally;
- live payment remains blocked until a selected provider and explicit approval exist;
- Digital Observer capabilities included with Gan Batuach remain inside the manager dashboard and do not require use of the standalone external Observer interface.

## Parent and child relationship

- A parent may request to join a kindergarten. The manager must approve.
- A manager may invite an existing or new parent. The parent must approve and select a child.
- A new parent can create one or more permanent child files before selecting a kindergarten.
- A parent can inspect public kindergarten details and published class pricing before requesting enrollment.
- Approval copies the relevant permanent child file into the selected kindergarten work context and records the relationship, enrollment and timeline audit event.
- The activation helper now checks every relationship write and refuses to report success if any write fails.
- The legacy direct-parent-creation route is blocked and directs callers to the mutual-consent invitation flow.

## Live in-app experience

- Same-origin dashboard links use client navigation instead of browser document reloads.
- A small Gan Batuach loading overlay appears only while a route transition is pending.
- Profile/avatar interaction opens a live in-screen drawer and saves through the profile API.
- Error recovery refreshes dashboard data through the application router, not `window.location.reload()`.
- Previously premature onboarding links were replaced with truthful post-activation readiness labels.
- No empty click handlers, `href="#"`, `javascript:void`, or console-only UI actions were found in the application scan.

## Safety

- Live payment, production invoice, external production messaging, parent camera viewing and live AI remain disabled.
- No RLS bypass, browser service-role use, password logging or real child/parent data was introduced.
- Invitation and enrollment actions remain ownership- and role-scoped on the server.

## Verification

- `qa:manager-parent-live-contract`: 20/20 PASS.
- Supabase role probe: 9 logins PASS, 9 boundary assertions PASS.
- Assigned inspector route: `/dashboard/inspector/control-center`.
- Unassigned inspector route: `/dashboard/inspector/apply`.
- Assigned parent route: `/dashboard/parent/family-home` and no stuck loading state.
- Visual checks at 1440x900 and 390x844: no horizontal overflow and no clipped controls in the final focused checks.

## Decision

`MANAGER_PARENT_PRODUCT_FLOW_IMPLEMENTED_AND_SYNTHETICALLY_VERIFIED_LIVE_PROVIDERS_REMAIN_BLOCKED`
