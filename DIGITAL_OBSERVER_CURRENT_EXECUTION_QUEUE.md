# DIGITAL OBSERVER — CURRENT EXECUTION QUEUE

Date: 2026-09-06
Canonical roadmap: `DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md`

This is the operational queue. It does not authorize execution by itself.

## CURRENT BLOCKER

### PUSH 16 — Software Observer Connector

Status: `OPEN — HARDWARE VERIFICATION BLOCKER` / `BLOCKED — INDEPENDENT REAL SOURCE REQUIRED`.

Implementation already evidenced:

- deployable Software Connector package;
- shared Gateway edge core;
- outbound-only network model;
- unique installation/device identity;
- scoped provisioning and Production backend support;
- heartbeat and configuration contract;
- credential rotation, idempotent retry and revocation;
- command boundary and onboarding handoff;
- focused Connector QA and Production lifecycle verification.

Missing PASS proof:

```text
independent physical RTSP/ONVIF camera
→ new separate SOFTWARE_CONNECTOR identity
→ authorized canonical Camera Source binding
→ real fresh frame
→ real Observer inference/Journaling
→ REAL_CAMERA_AI Event with connector provenance
→ Production persistence
→ authorized Product UI and evidence verification
```

The active home DVR must not be used by a second independent process unless parallel authenticated reads and duplicate suppression are first proven safe. The current ten-channel Physical Gateway must not be endangered.

## NEXT ACTION WHEN CAMERA ARRIVES

Run **PUSH 16C — Independent Physical Camera Software Connector Closure Verification** as a sub-verification of canonical PUSH 16; it does not receive a new canonical roadmap number.

Required sequence:

1. Record camera make/model/protocol and confirm it is independent of the active home DVR.
2. Enroll a fresh `SOFTWARE_CONNECTOR` identity scoped to the authorized test site.
3. Bind exactly one canonical Camera Source without duplicating an existing source.
4. Prove live freshness and source ownership through the Connector.
5. Produce one fresh physical person Event through the existing Observer pipeline.
6. Verify source anchor, model/provenance, Event persistence, Incident behavior as applicable, and authorized UI visibility.
7. Verify no customer-facing duplicate Event/Incident/action.
8. Interrupt/restart the Connector once and verify identity persistence/recovery.
9. Revoke the test identity and verify post-revocation denial, unless the camera is approved to remain as a pilot source.
10. Regress the existing home Physical Gateway and confirm ten-channel operation remains unchanged.

PASS only when all required real-source evidence is captured. If the test fails, PUSH 16 remains open and the failure is reported without substituting mock/replay media.

## SAFE PUSHES THAT MAY RUN NOW

Ordered recommendation; start only after explicit instruction:

1. **PUSH 24 — Repository and CI Quality Gate** (`READY NOW`, `CAN EXECUTE EARLY`).
2. **PUSH 25 — Security, RLS and Privacy Hardening** (`READY NOW`, `CAN EXECUTE EARLY`).
3. **PUSH 27 — Product Observability and Operational Telemetry** (`READY NOW`, `CAN EXECUTE EARLY`).
4. **PUSH 50 — Acquisition Technical DD and Data Room, documentation-only early slice** (`READY NOW`, `CAN EXECUTE EARLY`; cannot receive final PASS yet).

These pushes must exclude material modifications to the frozen areas below.

## FROZEN AREAS

- `services/video-gateway/**`.
- Software Connector run/install/package/service files.
- camera adapter, capability, assessment and Digital-First resolver contracts.
- canonical Camera Source mapping and stream binding semantics.
- Gateway/Connector provisioning, enrollment, identity, heartbeat, rotation and revocation.
- stream relay, source ownership, sampling, inference handoff, Journal/outbox and evidence-capture semantics.
- `app/api/video-gateway/**` paths used by Connector/Gateway lifecycle and ingest.
- active home DVR credentials, session ownership, configuration and ten production relays.
- connector/camera migrations or identifiers that would change the pending E2E baseline.

Read-only inspection and non-mutating evidence collection are allowed. A second login to the active DVR is not allowed without proof of safe parallel access.

## WHEN PUSH 16 PASSES

Sequential execution resumes at:

**PUSH 17 — Unified Connector/Gateway Package + Provisioning Hardening**.

Before starting PUSH 17:

- merge/record PUSH 16 closure evidence;
- verify current Production health;
- regress the home Gateway pipeline;
- compare the frozen-area revision against the tested revision;
- confirm no early push changed Connector/Gateway semantics.

## EARLY-COMPLETED PUSH HANDLING

If a later canonical push is completed while PUSH 16 is blocked:

- keep its original number;
- mark it `DONE EARLY`;
- retain its report and exact tested revision;
- when sequence reaches it, run only revision/environment/dependency revalidation;
- reopen only invalidated acceptance items;
- never repeat the entire push or create replacement numbering.

## CURRENT QUEUE SNAPSHOT

| Order | Canonical PUSH | State | Action |
|---:|---:|---|---|
| 1 | 16 | BLOCKED | Wait for independent physical camera, then execute PUSH 16C verification only. |
| 2 | 24 | READY NOW | Optional early CI/repository quality work, excluding frozen areas. |
| 3 | 25 | READY NOW | Optional early security/RLS/privacy work, excluding frozen identity/stream contracts. |
| 4 | 27 | READY NOW | Optional early product telemetry through stable interfaces. |
| 5 | 50 | READY NOW | Optional documentation/data-room inventory only. |
| 6 | 17 | NOT STARTED | Begin only after PUSH 16 PASS. |

## STOP STATE

No roadmap push was executed by this reconciliation. The queue is waiting for the next explicit instruction.
