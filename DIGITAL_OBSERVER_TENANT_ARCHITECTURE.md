# Digital Observer Tenant Architecture

This document defines the reusable Digital Observer platform structure.

Gan Batuach remains the first and primary implementation. The generic platform layer must not weaken kindergarten privacy or permissions.

Business model split:

- Gan Batuach is one fixed kindergarten plan: 700 ILS/month per kindergarten.
- The kindergarten management system is included.
- The Digital Observer is included as "תצפיתן דיגיטלי כלול" / "מצלמות ותובנות בטיחות" / "ניטור בטיחות כחלק מהמערכת".
- There is no separate observer package upsell inside Gan Batuach at this stage.
- Standalone Digital Observer is a future separate product for non-kindergarten sites.

## Core Hierarchy

```text
Tenant
-> Observer Sites
-> Cameras
-> Zones
-> Events
-> Notifications
```

## Observer Site

Table:

- `observer_sites`

Fields:

- `id`
- `name`
- `site_type`
- `owner_profile_id`
- `garden_id`
- `address`
- `timezone`
- `active`
- `monitoring_enabled`
- `camera_limit`
- `monitoring_hours`
- `event_retention_days`
- `ai_features`
- `storage_limit_mb`

`garden_id` remains for Gan Batuach compatibility.

## Site Type Strategy

Kindergarten:

- Uses existing `gardens`, `children`, parent permissions and inspector workflows.
- Raw observer events are internal.
- Parent-visible events require explicit approval.

Home:

- No kindergarten or child-management assumptions.
- Requires household consent model.

Office / Business / Store:

- Requires employee/visitor notice policy.
- Zones can include lobby, office, storage and restricted areas.

Warehouse:

- Focus on restricted areas, safety events and operational alerts.

Parking Lot:

- Focus on entrances, exits, parking zones and after-hours alerts.

Custom:

- Requires explicit tenant configuration.

## Camera Relationship

Existing table:

- `camera_streams`

New generic link:

- `camera_streams.observer_site_id`

Kindergarten compatibility:

- `camera_streams.garden_id` remains unchanged.

## Zone Relationship

Existing table:

- `camera_zones`

New generic link:

- `camera_zones.observer_site_id`

Generic zones:

- entrance
- exit
- lobby
- office
- classroom
- playground
- storage
- parking
- hallway
- restricted_area
- sleeping_area
- bathroom_entrance
- kitchen
- yard
- staff_only
- custom

## Event Relationship

Existing table:

- `ai_camera_events`

New generic fields:

- `observer_site_id`
- `site_type`

Kindergarten compatibility:

- `kindergarten_id` remains required for current Gan Batuach flows.

Future standalone observer work may introduce a fully generic event table only after access control is proven.

## Subscription Readiness

Gan Batuach subscription:

- fixed 700 ILS/month per kindergarten
- Digital Observer included
- optional future custom/enterprise only for large kindergarten chains

Future standalone Digital Observer packages:

- Home Basic
- Home Plus
- Business
- Enterprise

Standalone pricing dimensions may include:

- camera count
- monitoring hours
- alert types
- event retention
- recording retention
- AI feature flags
- AI level
- storage limits

This phase does not implement standalone observer billing.

## API Readiness

Future private APIs:

- site management
- camera onboarding
- monitoring status
- event feeds
- notification feeds

No public APIs are activated in this phase.

## Privacy Model

Children:

- Highest sensitivity.
- Human review required.
- Parent visibility is explicit and controlled.

Private homes:

- Private-space consent and retention policy required.

Businesses:

- Workplace monitoring policy and visitor signage required.

Public/semi-public areas:

- Local legal review and signage required.

## Non-Goals For This Phase

- No standalone product launch.
- No public API.
- No non-kindergarten onboarding UI.
- No billing changes.
- No real AI expansion.
- No change to existing Gan Batuach permissions.
