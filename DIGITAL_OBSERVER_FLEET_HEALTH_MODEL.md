# DIGITAL OBSERVER — FLEET HEALTH MODEL

Fleet health combines, without collapsing, PUSH 18 identity, heartbeat freshness, PUSH 19 update state, PUSH 20 supervision and PUSH 21 resynchronization backlog.

| Dimension | Examples |
|---|---|
| Component | healthy, recovering, offline, auth degraded, needs attention |
| Camera dependency | physical cameras affected by this component |
| Configuration | desired, actual, pending, incompatible or failed |
| Update | pending, installing, healthy, rolled back, quarantined |
| Supervision | recovery count, failed recovery, crash loop, stale stream |
| Offline/resync | queue depth/bytes/age and resync state |

Component and camera availability remain separate. One failed camera does not automatically fail its Gateway; one failed Gateway may explain several affected cameras. Six empty DVR slots are capacity metadata, not cameras, failures, alerts or SLO denominator.

Fleet values are measurements, not commercial SLA commitments. Missing/stale heartbeat becomes `OFFLINE`, never silently `HEALTHY`. Alerts deduplicate by component and normalized state while retaining affected-resource count.
