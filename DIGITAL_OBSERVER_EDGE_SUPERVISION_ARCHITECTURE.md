# Digital Observer Edge Supervision Architecture

## Scope

`observer-edge-supervision-v1` is the shared supervision contract for Digital Observer-managed Software Connector, Physical Gateway and future Enterprise Edge profiles. It does not apply to true zero-install cameras and does not create a second service, update, fleet or camera-health system.

## Health dimensions

The runtime keeps process, device authentication, cloud connectivity, source connectivity, relay, frame progression, inference and Product playback health separate. A running process is not proof of progressing video, and progressing video is not proof of authorized Product playback.

Only assigned physical sources enter availability and recovery. `CHANNEL_EMPTY / UNASSIGNED` slots remain healthy capacity metadata and never trigger reconnect, availability loss or alerts.

## Detection and recovery

Normalized failures include process exit/crash loop, stale heartbeat, cloud disconnection, authentication failure, stopped relay, stale stream, lost DVR session, unavailable source, stalled inference, repeated transport failure and invalid configuration.

The bounded allow-listed ladder is:

`retry request → reconnect source → restart relay → renew DVR session → restart bounded worker → restart managed service → signal PUSH 19 update health → escalate`

Actions are selected by failure class. Authentication/configuration failures are escalated rather than restarted indefinitely. Temporary cloud loss retries cloud communication while preserving local processing and never starts a destructive service loop. Exponential backoff with jitter, attempt limits and crash-loop quarantine prevent storms.

## Ownership and security

Recovery preserves managed-device identity, tenant/Site binding, camera sources and relay ownership. It never creates arbitrary shell access, resets credentials, changes camera configuration, or opens a second uncontrolled DVR session. PUSH 19 remains the only owner of update rollback; supervision can report release-correlated failure but cannot roll software back itself.

## Runtime integration

The Gateway health contract now exposes sanitized `supervision`, per-relay recovery counters and genuine frame progression. Existing relay replacement is bounded with backoff. The desktop Connector service restarts its bounded child with backoff and quarantines repeated crashes while leaving the signed-in service available for diagnostics/recovery.

## Future consumers

PUSH 22 fleet and PUSH 23 Camera Health consume this contract. PUSH 21 may add offline buffering/resync around it. Long-duration soak and scale proof remain PUSH 38.
