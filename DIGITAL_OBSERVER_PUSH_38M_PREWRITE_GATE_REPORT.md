# PUSH 38M — pre-write gate stopped

Observed 2026-09-13 UTC. **NOT READY FOR V8. No live write was performed.** PR #28 remains draft/unmerged. This was the controlled Home QA/pilot pre-write check, not a deployment or reliability qualification.

## Exact baseline and rollout material

The zero-write signed-baseline planner passed immediately before the health check. The live Connector matched all 250 members of the exact legacy capture `ee82c20a77acb7fd8caf692682569ad53581e9c057b11724845c6d947c5a982a`; the live Gateway matched its authorized 491-member baseline `91bf6814075f74e703cbc0b85d30673237531247ec46633c54576d5a4627144d`. The device-bound transition record and strict-valid QA transition package verified, and no managed-layout conflict was detected. This is read-only compatibility evidence, not authorization to skip the health gate.

## Home health gate: FAIL

The first accessible local health read returned the Gateway's old generic payload with **0/10 DVR relays progressing and 10 stalled**, while Connector/Tapo returned **1/1 progressing and 0 stalled**. The new structured probe classified both old payloads as `INVALID_PAYLOAD` because the `observer-edge-health-v1` contract is not yet installed; this classification does not override the actual 0/10 DVR count. Two subsequent read-only Gateway samples showed automatic recovery to 10/10 and 0 stalled; the timestamped samples at `2026-09-13T19:51:56.459Z` and `2026-09-13T19:52:04.240Z` were healthy by the legacy relay count. The latter reported cumulative lifetime counters of 1,502 relay starts, 1,470 socket errors/upstream ends, 22 input aborts, 15 stale-input events, 6,607 recorder-session attempts and 7 session failures. These are **cumulative**, not counts attributable to this one outage. The first failed sample was not timestamped by the probe, so its exact start/end and duration cannot be established.

Ten simultaneous stalled DVR relays indicate a shared-dependency window, but the old health contract lacks sufficient per-channel/session/transport diagnostics to assign an exact root cause. The subsequent recovery is not evidence that the known common-cause instability is resolved. The six DVR empty/unassigned slots remain the canonical configuration, but their live count was not independently revalidated in this stopped gate.

The mandatory instruction was to stop and diagnose if baseline Home was unhealthy. Therefore Connector transition, Gateway bootstrap, both remediation updates, identity/source before-and-after comparison, Product playback, AI gate, learning coverage, resource trends, 60-minute pre-soak and V8 were **not attempted or measured**. Acknowledged-loss, duplicate-effect and cross-tenant-leakage counts were not measured; they are not represented as zero. No manual recovery was performed. The original Gateway and Connector runtimes, services, Site/source bindings, identity, credentials, queues and trust roots were not changed by this gate.

## Next gate

Investigate the shared DVR stall with read-only diagnostics and establish a healthy immediate baseline before a **new** pre-write attempt. Recheck exact hashes, signed rollback material, Home health and canonical non-secret identity/source counts then. Do not reuse this failed gate as a pre-soak start. Production signing custody, Apple Developer ID and notarization remain separate external gaps. PUSH 38 is NOT DONE; PR #28 must remain draft/unmerged; pre-soak and V8 remain NOT STARTED.
