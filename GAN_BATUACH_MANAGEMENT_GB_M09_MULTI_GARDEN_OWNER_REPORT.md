# GB-M09 — Owner multi-garden memberships and active Garden context

## Before State

Owner and manager authority ultimately depended on `profiles.garden_id`, so one profile could not retain authority for more than one Garden. Garden pages also read that single field directly.

## Canonical Owner Membership Model

`garden_management_memberships` is the single Management relationship for owner and manager authority. It records profile, Garden, contextual role, lifecycle status, activation/end times, source, default preference, actor references and audit-safe metadata.

## Multi-Garden Relationships

One profile can hold active owner or manager relationships for multiple Gardens. Granting another Garden does not overwrite an earlier membership. Revoking one row leaves every other relationship intact.

## Active Garden Context

The selected Garden is stored in the HTTP-only `gb_active_garden` cookie. `management_gardens_for_current_user` returns only active, authorized Gardens. Each privileged request resolves the cookie again and separately calls `can_manage_garden`; selection is never an access grant.

## `profiles.garden_id` Remaining Role

The field remains a legacy mirror and preferred/default hint for compatibility and onboarding. It is no longer used by `can_manage_garden` as owner/manager authority.

## `can_manage_garden` Changes

Owner and manager decisions now require an active canonical membership, active profile and operational Garden. Existing admin and network-manager branches remain scoped. A user with A+B receives true for A and B and false for unrelated C.

## Owner-as-Teacher Interaction

GB-M08 remains Garden-specific through `garden_teaching_assignments.garden_id`. Owning A+B does not copy an owner-teacher assignment from A into B.

## Delegated Teacher Interaction

Delegated teaching remains bound to the staff record, active employment and teaching assignment in the same Garden. No permission follows the owner into another Garden.

## Context Switching

`GET /api/management/gardens` lists authorized Gardens. `POST /api/management/gardens` verifies the requested Garden through session-scoped database authority before changing the cookie. The existing shell shows a compact selector only when more than one Garden is available.

## APIs Updated

The shared role, Management Garden and operational-role guards now resolve the validated active Garden. Existing Garden pages and guarded APIs continue reading `profile.garden_id`, but receive a request-scoped compatibility value containing the validated active Garden. Admin membership grant, activation, revocation and default selection are available through `/api/admin/garden-memberships`.

## RLS / Service Role

Membership rows expose self-read only; writes are admin-only. Service-role Garden routes continue to pass through the Management guard before payload processing and receive the verified Garden identifier. Resource-level Garden filters and existing RLS remain in place.

## Migration / Backfill

Migration `20260911010000` is additive. It backfills direct `gardens.owner_profile_id`, `gardens.manager_id` and the formerly authoritative role-matching `profiles.garden_id`. Names and emails never create authority. New direct Garden owner/manager assignments synchronize through a trigger.

## Legacy Compatibility

One-Garden users select their sole valid Garden automatically. Existing profile and Garden columns remain intact. Multi-Garden users use an explicit/default relationship and see the selector.

## Security / IDOR Tests

Contract tests cover A/B/C selection, invalid requested Garden denial, independent revocation semantics, owner-teacher and delegated-teacher Garden isolation, service-route context propagation and representative child, attendance, staff, message and document Garden scoping.

## Live Probe

`LIVE MULTI-GARDEN AUTHORIZATION PROBE: BLOCKED BY ENVIRONMENT` until controlled non-customer A/B/C identities are available. Production health and unauthenticated denial are still verified after deployment.

## Remaining Debt

Full staff multi-Garden employment remains GB-M19. Full live cross-tenant evidence remains GB-M35/36. Portfolio analytics and final selector design remain later roadmap work.

## Inputs For GB-M10

GB-M10 must create/activate the Garden and canonical management membership in one atomic, idempotent onboarding transition while retaining `profiles.garden_id` only as a compatibility preference.

## Digital Observer Boundary

`DIGITAL OBSERVER CORE DIFF: 0`
