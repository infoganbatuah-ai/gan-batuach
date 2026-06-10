# Multi-Kindergarten Scale Validation

## Goal

Validate Gan Batuach as a multi-kindergarten platform before expanding from one pilot kindergarten to 5-10 independent kindergartens and later to dozens or hundreds.

This phase does not add major product features. It focuses on scale visibility, tenant isolation, operational readiness and performance monitoring.

## Dashboard Added

Added:

- `/dashboard/admin/scale-validation`

The dashboard shows:

- Total and active kindergartens
- Managers, inspectors, parents, staff and children
- Camera readiness and disconnected cameras
- Inspection load and overdue/open inspection requirements
- Observer event load
- Parent, staff and manager activity signals
- Performance readiness checks
- Open pilot issues
- 0-100 scale readiness score
- Kindergarten-by-kindergarten comparison

The national admin dashboard now links to this page from the scale action card.

## Scale Readiness Score

The score is calculated from:

- Tenant coverage
- Tenant isolation status
- Performance readiness
- Platform stability
- Onboarding completion
- Adoption signals

The score is intentionally conservative. Missing activity data lowers confidence rather than pretending the platform is fully validated.

## Tenant Isolation Findings

Current architecture is multi-tenant by `garden_id` with role-specific access helpers.

Validated policy patterns:

- Parents: scoped through `parents`, `parent_kindergarten_links`, `children` and `can_parent_access_garden`
- Staff: scoped through `staff.garden_id`, `profiles.garden_id` and `can_access_garden`
- Managers/owners: scoped through `profiles.garden_id`, `gardens.manager_id`, `current_garden_id` and `can_access_garden`
- Inspectors: scoped through assigned gardens, `gardens.inspector_id`, `inspections.inspector_id` and `can_access_garden`
- Admin: global visibility by design

Remaining required validation:

- Live cross-garden URL attempts
- API ownership tests for `garden_id`, `child_id`, `camera_id`, `document_id`
- Parent camera permission tests across multiple gardens
- Inspector assignment tests across multiple cities/regions

## Multi-Kindergarten Analytics

The scale dashboard provides three analytics views:

- Kindergarten comparison dashboard: users, cameras, inspection load, observer load and adoption per garden
- Growth dashboard: active gardens versus total gardens and multi-pilot coverage
- Activity dashboard: parent, staff and manager usage signals

Current data limitations:

- Dashboard usage is only as strong as `pilot_usage_analytics`
- Parent activity is inferred from notifications, camera sessions and documents
- Staff activity is inferred from attendance, child journals and task completion
- Manager activity depends on pilot analytics instrumentation

## Load Readiness Findings

The dashboard reads from `performance_readiness_checks`.

Tracked areas:

- Database
- API
- Observer
- Notifications
- Camera

Remaining real-world work:

- Add automated dashboard timing checks
- Add API latency sampling per route group
- Add database query timing snapshots
- Add observer processing latency measurements
- Run a real 5-10 kindergarten load exercise

## Multi-Camera Readiness

Tracked:

- Total cameras
- Active cameras
- Offline/unhealthy cameras
- Camera usage sessions
- Camera health by kindergarten

Remaining real-world work:

- Validate gateway load with multiple simultaneous sites
- Validate playback token behavior under concurrent parent viewing
- Validate disconnected camera alert handling
- Validate no RTSP URLs or credentials reach the browser

## Multi-Inspector Readiness

Tracked:

- Active inspectors
- Required inspections
- Completed inspections
- Open inspection load by kindergarten

Remaining real-world work:

- Workload balancing by inspector
- Regional assignment visibility
- SLA tracking for overdue inspections
- GPS validation sampling during real field work

## Parent Activity Analytics

Tracked:

- Notifications opened
- Camera sessions
- Document usage

Recommended next measurements:

- Daily active parents by garden
- Message response rate
- Pickup workflow completion
- Parent onboarding completion

## Staff Activity Analytics

Tracked:

- Attendance updates
- Child journal updates
- Task completion

Recommended next measurements:

- Shift completion rate
- Child update completion rate
- Incident response time
- Late/missing staff update rate

## Manager Activity Analytics

Tracked:

- Pilot usage analytics for manager role
- Feature usage count
- Screen views where available

Recommended next measurements:

- Dashboard usage frequency
- Communication actions
- Unresolved issue handling time
- Parent/staff response SLA

## Executive Scale Dashboard

The dashboard now shows:

- Total kindergartens
- Total users
- Total cameras
- Total inspections
- Total observer events
- Growth readiness score

## Current Readiness Assessment

The platform has the core multi-tenant shape needed for 5-10 kindergarten validation:

- Shared tables are scoped by `garden_id`
- Role helpers exist for garden access
- Parent-to-kindergarten link model exists
- Inspector assignment model exists
- Camera and observer data are garden-scoped
- Admin has national visibility

The platform is not yet externally proven at high load.

## Launch Recommendation

Recommended next step:

Run a controlled 5-kindergarten pilot with seeded or real users, real role separation tests and measured dashboard/API timings.

Do not proceed to broad rollout until:

- Cross-tenant access tests pass
- API ownership tests pass
- Camera gateway load is measured
- Performance readiness checks have real latency values
- Customer success dashboard tracks recurring support issues

## Remaining Risks

- Some usage metrics are inferred rather than directly instrumented
- Performance readiness requires real measurements, not only status rows
- Multi-camera gateway capacity is not proven without real streams
- Observer scale depends on review queue staffing and processing latency
- Legal/compliance review remains required before broad real-family rollout
