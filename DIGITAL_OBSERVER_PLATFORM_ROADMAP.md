# Digital Observer Platform Roadmap

Gan Batuach remains the primary product. The Digital Observer platform layer is introduced so the same observer engine can later support additional monitored sites without duplicating code.

## Platform Model

```text
Tenant
-> Sites
-> Cameras
-> Zones
-> Events
-> Notifications
```

Current product mapping:

```text
Kindergarten
-> observer_site(site_type = kindergarten)
-> camera_streams
-> camera_zones
-> ai_camera_events
```

## Supported Site Types

- `kindergarten`
- `home`
- `office`
- `business`
- `warehouse`
- `store`
- `parking_lot`
- `custom`

## Phase 1: Kindergartens

Business value:

- Safety monitoring readiness for Gan Batuach.
- Camera health, shadow AI review, pickup readiness, safety incident review.

Technical scope:

- Keep `kindergarten_id` compatibility.
- Add `observer_site_id` as generic site link.
- Keep children privacy and parent visibility policies strict.

Status:

- In progress.

## Phase 2: Homes

Business value:

- Home monitoring service for families and private property.

Expected features:

- Simple home site onboarding.
- Indoor/outdoor camera zones.
- Person detection.
- Door/gate alerts.
- No child-specific kindergarten workflows.

Privacy:

- Household consent and private-space policy required.
- No face recognition without explicit opt-in.

Complexity:

- Medium.

## Phase 3: Businesses

Business value:

- Storefront and small-business monitoring.

Expected features:

- Open/close routine.
- Entrance/lobby/storage zones.
- Staff-only areas.
- Camera health.
- After-hours movement indicators.

Privacy:

- Employee and visitor notice requirements.

Complexity:

- Medium.

## Phase 4: Warehouses

Business value:

- Operational safety and restricted-area monitoring.

Expected features:

- Storage zones.
- Restricted-area entry.
- Forklift/vehicle future readiness.
- After-hours movement.
- Crowd/occupancy indicators.

Privacy:

- Workplace monitoring policy required.

Complexity:

- High.

## Phase 5: Enterprise Monitoring

Business value:

- Multi-site SaaS for organizations with many locations.

Expected features:

- Tenant hierarchy.
- Site groups.
- Multi-site dashboards.
- Role-based monitoring teams.
- SLA and escalation policies.
- API/webhook integrations.

Privacy:

- Enterprise DPA and audit logs required.

Complexity:

- Very high.

## Generic Zone Model

Supported zones:

- `entrance`
- `exit`
- `lobby`
- `office`
- `classroom`
- `playground`
- `storage`
- `parking`
- `hallway`
- `restricted_area`
- `sleeping_area`
- `bathroom_entrance`
- `kitchen`
- `yard`
- `staff_only`
- `custom`

Kindergarten zones remain compatible.

## Subscription Readiness

Future observer-specific plan fields:

- camera count
- monitoring hours
- event retention
- AI features
- storage limits

No billing implementation is activated in this phase.

## Future APIs

No public APIs are exposed yet.

Planned API groups:

- site management
- camera onboarding
- monitoring status
- event feeds
- notification feeds

## Privacy by Site Type

Kindergarten:

- Minors are involved.
- Parent visibility must be explicitly approved.
- Raw AI events remain internal.

Home:

- Private-space monitoring.
- Household consent and strict data minimization required.

Business / Office:

- Employee/visitor notice required.
- Workplace monitoring policy required.

Warehouse:

- Safety and operational monitoring.
- Restricted-area policies required.

Parking:

- Public/semi-public area considerations.
- Retention and signage requirements.

## Immediate Next Steps

1. Keep Gan Batuach kindergarten observer stable.
2. Add internal admin site management when needed.
3. Build camera onboarding around `observer_site_id`.
4. Add generic event feeds after access control is proven.
5. Add standalone Observer product branding only after pilot validation.
