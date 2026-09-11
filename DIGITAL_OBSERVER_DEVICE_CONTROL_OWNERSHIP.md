# DIGITAL OBSERVER — DEVICE CONTROL OWNERSHIP

Contract: `observer-ha-coordination-v1`

One canonical resource ID identifies an existing managed Gateway, Connector or future Enterprise Edge node. Ownership never creates a Device, Site or Camera Source.

## Authority

- A shared transactional lease records `resource_id`, tenant, Site, owner, monotonically increasing epoch and server-clock expiry.
- The current owner must present the matching fencing epoch for authoritative effects.
- A new owner can take over only after expiry or explicit release; takeover increments the epoch.
- Old epochs are permanently fenced even if their process resumes.
- Command, OTA and resync effect keys are globally unique and accepted once.

SQLite WAL provides local multi-process QA and customer-site single-host coordination only. The Production multi-host contract uses Postgres row locking and server time. Service RPCs remain restricted to the trusted service role after PUSH 18 identity/scope authorization; no private device or signing key is replicated by this mechanism.

## Continuity

Heartbeat-handler failover preserves immutable device ID, tenant/Site binding, camera mappings, credentials and enrollment. Revoked identities remain revoked. An acknowledged command or OTA/resync transition is not repeated after ownership changes.
