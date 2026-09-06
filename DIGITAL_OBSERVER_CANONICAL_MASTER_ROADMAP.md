# DIGITAL OBSERVER — CANONICAL MASTER ROADMAP

Date: 2026-09-06
Repository state reviewed: `395f414` on `codex/push16-software-connector-20260906`
Purpose: roadmap reconciliation only. This document does not authorize implementation, deployment, refactoring, or PUSH 17.

# EXECUTIVE STATE

Digital Observer has completed the canonical product path from audit through Digital-First onboarding: PUSH 1–15 are reconciled as `DONE` by their final closure evidence. PUSH 16 has substantial implementation and production lifecycle proof but remains `BLOCKED` because the required independent physical-camera Software Connector E2E has not happened.

The canonical roadmap contains **52 pushes**. It preserves the existing numbers 1–16 and continues through production infrastructure, pilots, commercial proof, technical due diligence, and acquisition/exit. Later work may be executed early only when its `EXECUTION MODE` says `CAN EXECUTE EARLY`; its canonical number never changes.

Current sequential position: **PUSH 16**.
Current blocker: **independent real RTSP/ONVIF camera for a separately enrolled Software Connector**.
Next sequential push after closure: **PUSH 17 — Unified Connector/Gateway Package + Provisioning Hardening**.

## Status semantics

- `DONE`: final acceptance evidence exists for the canonical scope.
- `DONE EARLY`: completed before its sequential turn; revalidate later, do not rebuild.
- `OPEN`: active and not yet accepted.
- `BLOCKED`: cannot reach PASS until its stated external or dependency gate is available.
- `READY NOW`: sufficiently independent and may be started by explicit instruction.
- `NOT STARTED`: not yet executed.
- `LATE STAGE`: requires pilots, commercial data, or acquisition timing.

Implementation is never equivalent to PASS when a push requires real hardware, provider, scale, customer, or external-consumer evidence.

# CURRENT POSITION

```text
PUSH 1–15  DONE
PUSH 16     BLOCKED — INDEPENDENT REAL SOURCE REQUIRED
PUSH 17     next sequential push after PUSH 16 PASS
PUSH 24/25/27/50  safe candidates for explicit early execution
```

PUSH 16 PASS requires this exact chain:

```text
REAL PHYSICAL CAMERA
→ separately enrolled SOFTWARE_CONNECTOR identity
→ canonical Camera Source binding
→ real fresh frame and Observer processing
→ canonical REAL_CAMERA_AI Event
→ Production backend persistence
→ authorized Product UI / evidence proof
```

No replay, uploaded clip, mock frame, manual Event, reused Physical Gateway identity, or unproven parallel DVR session can substitute for this chain.

# SOURCE ROADMAPS

## Located current evidence

- `DIGITAL_OBSERVER_MASTER_AUDIT.md`.
- Final PUSH reports for PUSH 2–16B in the repository root.
- `docs/digital-observer/software-connector.md`.
- `PRODUCTION_RELEASE_PROCESS.md` and `DIGITAL_OBSERVER_AUTOMATED_QA_RESULTS.md`.

## Located historical Git evidence

The following source documents were recovered read-only from Git revision `96ac3eb` and related history; they are not restored into the working tree:

- `DIGITAL_OBSERVER_PLATFORM_ROADMAP.md`.
- `DIGITAL_OBSERVER_24_7_RELIABILITY_ROADMAP_HE.md`.
- `V2_ROADMAP.md`.
- `DEPLOYMENT_FUTURE_ARCHITECTURE.md`.
- `CAMERA_AND_DIGITAL_OBSERVER_INFRASTRUCTURE.md`.
- `DIGITAL_OBSERVER_PRODUCTION_REMAINING_WORK.md`.
- `PILOT_FIX_1_ROADMAP_TO_REAL_PILOT_READY.md`.
- `DIGITAL_OBSERVER_CORE_EXTRACTION_AND_VERTICAL_CAPABILITY_MANAGEMENT.md`.
- Historical pilot, provider, security, privacy, mobile, scale, commercial and acquisition reports listed by Git history.

## Source-confidence boundary

The exact verbatim numbered originals named “52-push”, “16-phase strategic”, “16-phase technical/DD”, and “45-push Digital-First” were not found as intact lists in the current tree or reachable Git documents. Their numbered slots are therefore reconstructed from the historical documents above, the current request, the master audit, and PUSH 1–16 final reports.

- Requirement intent/coverage confidence: **MEDIUM to HIGH**.
- Exact original title wording confidence: **LOW**; every reconstructed source title is marked in the traceability matrix.
- No numbered slot is dropped. Coverage is `52/52`, `16/16`, `16/16`, and `45/45` at the normalized-requirement level.

# REQUIREMENT REGISTER SUMMARY

| Source | Slots | Verbatim list found? | Register treatment | Accounted |
|---|---:|---|---|---:|
| Original 52 | 52 | No | Reconstructed slot-by-slot from audit, historical platform/reliability/pilot/production docs | 52/52 |
| Original 16 — Strategic | 16 | No | Reconstructed from platform, vertical, commercial, pilot and acquisition documents | 16/16 |
| Original 16 — Technical/DD | 16 | No | Reconstructed from infrastructure, security, portability, scale and DD documents | 16/16 |
| Digital-First 45 | 45 | No | Reconstructed from current request plus PUSH 14–16 reports and camera/Gateway history | 45/45 |

The complete requirement register, including source number, reconstructed original name, normalized requirement, domain, dependencies, current status, implementation mapping and remaining work, is in `DIGITAL_OBSERVER_ROADMAP_TRACEABILITY_MATRIX.md`.

Source shorthand used below: `52` = Original 52, `S16` = Original 16 — Strategic, `T16` = Original 16 — Technical/DD, and `DF45` = Digital-First 45.

## Current PUSH 1–16 reconciliation

| Current PUSH | Final meaning | Original requirements covered | Reconciled status |
|---|---|---|---|
| 1 | Existing System Audit | Current architecture, capability inventory, real-vs-mock classification, blockers | DONE |
| 2 | Runtime/Baseline Closure | Web/Gateway/DB baseline, encryption separation, critical QA | DONE |
| 3 | Real Camera + Real Person E2E | Real DVR, live frames, ONNX person detection, source anchors, Event delivery | DONE |
| 4 | Product Observer Real-AI Integration | Canonical REAL_CAMERA_AI boundary, mock isolation, Product UI provenance | DONE |
| 5 | Tracking + Zones | Stable Track IDs, entry/exit, line crossing, dedupe and zone safety | DONE |
| 6 | Unified Incident Architecture | Canonical Incident, event correlation, timeline, automatic closure, idempotency | DONE |
| 7 | Evidence Production | Real bounded clip, private storage, signed access, production playback, no-recording policy | DONE |
| 8 | Context + Baseline | REAL_CAMERA_AI baseline input, source exclusion, time/context and maturity | DONE |
| 9 | Risk + Decision | Deterministic explainable Risk and Decision, confidence separation | DONE |
| 10 | Incident Verification | Canonical verification confidence and final Decision integration | DONE |
| 11 | Feedback + Calibration | User feedback, reviewed ground truth, calibration and human-gated learning | DONE |
| 12 | Natural-Language Rules | Hebrew compiler, preview/confirmation, structured rule, real match | DONE |
| 13 | Natural-Language Investigation | Bounded tenant-safe search, grounded real records and evidence playback | DONE |
| 14 | Digital-First Camera Layer | Canonical source/adapter/capability model, assessment and resolver | DONE |
| 15 | Zero-Touch Onboarding | State model, recommendation, reassessment, truthful activation and handoff | DONE |
| 16 | Software Observer Connector | Deployable connector, shared core, provisioning, heartbeat, rotation, revocation; real separate-source E2E absent | BLOCKED |

# CANONICAL NUMBERED ROADMAP

| PUSH | Name | Objective | Source requirements covered | Dependencies | EXECUTION MODE | Current status | PASS condition |
|---:|---|---|---|---|---|---|---|
| 1 | Existing System Audit | Establish evidence-based current reality and prevent rebuilds. | 52/1–7; S16/1; T16/1; DF45/1 | None | SEQUENTIAL | DONE | Complete repository/runtime matrix with evidence and no roadmap implementation. |
| 2 | Runtime and Baseline Closure | Make the audited Web/Gateway/DB baseline reproducible and close critical diagnostic blockers. | 52/2–7,46–47; T16/1–2 | PUSH 1 | SEQUENTIAL | DONE | Web, Gateway and DB baseline verified; critical security/runtime diagnostics pass or are explicitly external. |
| 3 | Real Camera and Real-Person E2E | Prove real DVR → frame → ONNX detection → anchored Event → backend. | 52/8–23; S16/2,6; DF45/7–10 | PUSH 2; authorized physical source | SEQUENTIAL | DONE | Fresh physical person produces a canonical real Event with source provenance; no mock/manual substitute. |
| 4 | Product Observer Real-AI Integration | Make real Gateway Events the Product Observer source of truth and isolate mock/shadow data. | 52/20–23,27; S16/6,8 | PUSH 3 | SEQUENTIAL | DONE | Production Product UI/API displays real provenance and excludes mock/shadow from real claims. |
| 5 | Real Tracking and Zones | Prove stable Track IDs, directional crossing, zones and duplicate suppression. | 52/24–26; S16/7; DF45/32 | PUSH 4 | SEQUENTIAL | DONE | Fresh real entry and exit preserve one Track and produce exactly the allowed normalized events. |
| 6 | Unified Incident Architecture | Correlate real Events into one canonical Incident lifecycle. | 52/27–28; S16/8 | PUSH 5 | SEQUENTIAL | DONE | Real entry/exit form one idempotent Incident timeline and close automatically. |
| 7 | Evidence Production | Preserve bounded event evidence with private storage and authorized playback. | 52/36–37; S16/13 | PUSH 6 | SEQUENTIAL | DONE | Fresh real eligible Event captures bounded clip, persists privately and plays through signed authorized access. |
| 8 | Context and Behavioral Baseline | Build factual site/camera context only from eligible real events. | 52/29–30; S16/9 | PUSH 7 | SEQUENTIAL | DONE | REAL_CAMERA_AI contributes; mock/shadow/manual inputs are excluded; maturity state is visible. |
| 9 | Explainable Risk and Decision | Separate detector confidence from deterministic risk and product decision. | 52/31–32; S16/10 | PUSH 8 | SEQUENTIAL | DONE | Fresh real Incident automatically receives auditable Risk and Decision without threshold weakening. |
| 10 | Incident Verification and False-Alarm Reduction | Add independent verification confidence before final decision. | 52/31,43; S16/11 | PUSH 9 | SEQUENTIAL | DONE | Real Incident runs through canonical Verification; detector confidence, risk and verification remain distinct. |
| 11 | Feedback, Ground Truth and Calibration | Turn authorized review into measured, reversible calibration evidence. | 52/30,43; S16/11 | PUSH 10 | SEQUENTIAL | DONE | Real feedback → reviewed ground truth → calibration sample/metric; no automatic model/risk mutation. |
| 12 | Natural-Language Watch Rule Compiler | Compile bounded Hebrew intent into a confirmed structured rule. | 52/32–33; S16/12 | PUSH 11 | SEQUENTIAL | DONE | Confirmed NL rule matches a fresh real Event and influences Risk/Decision through canonical flow. |
| 13 | Natural-Language Investigation | Search authorized real Events/Incidents/Evidence with grounded answers. | 52/34; S16/12 | PUSH 12 | SEQUENTIAL | DONE | Bounded query returns tenant-safe real records and authorized evidence playback; unsupported identity refused. |
| 14 | Digital-First Universal Camera Layer | Establish vendor-agnostic source/adapter/capability contracts and explainable resolver. | 52/8–15; S16/2; DF45/2–12,15 | PUSH 13 | SEQUENTIAL | DONE | Existing real source maps to canonical model and resolver selects the safest viable path with evidence. |
| 15 | Zero-Touch Camera Onboarding | Convert assessment into truthful customer onboarding and connector/Gateway handoff. | 52/8,12,14–15; DF45/11–15 | PUSH 14 | SEQUENTIAL | DONE | Existing/new systems can be assessed, recommended and activated only after verified readiness. |
| 16 | Software Observer Connector | Provide an outbound deployable connector sharing the canonical edge core. | 52/14,16–19; T16/3–4; DF45/16–17 | PUSH 15; independent physical source | BLOCKED BY PUSH 16 | BLOCKED | Independent physical camera through separate SOFTWARE_CONNECTOR identity produces real frame, canonical Event, backend persistence and authorized UI evidence. |
| 17 | Unified Connector/Gateway Package and Provisioning Hardening | Consolidate shared runtime contracts and production provisioning without forked behavior. | 52/14–16,38; T16/3–4; DF45/18–20 | PUSH 16 PASS | BLOCKED BY PUSH 16 | NOT STARTED | Both physical Gateway and Software Connector install from shared versioned package; provisioning/reprovisioning and rollback QA pass on real devices. |
| 18 | Device Identity, Certificates and Rotation | Establish device-bound identity, certificate lifecycle, attestation and safe key rotation. | 52/38,47; T16/4; DF45/19–20 | PUSH 17 | SEQUENTIAL | NOT STARTED | Real device enrolls, rotates, expires/revokes, and cannot cross tenant/site or replay credentials. |
| 19 | OTA Update and Atomic Rollback | Remotely update Connector/Gateway with signed artifacts and automatic rollback. | 52/38; T16/5; DF45/23–24 | PUSH 17–18; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Real remote device updates to a signed version; induced failure rolls back and preserves identity/configuration. |
| 20 | Watchdog and Self-Healing Runtime | Detect process/stream failure and recover without unsafe duplicate ownership. | 52/19,38,45; T16/6; DF45/22 | PUSH 17–18; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Real process, network and stream faults recover within defined SLO; no duplicate Events/actions or credential leak. |
| 21 | Offline Buffering and Resynchronization | Preserve bounded metadata/evidence during disconnection and replay idempotently. | 52/18,38,45; T16/6; DF45/25–26 | PUSH 17–20; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Real offline interval buffers within policy, reconnects, resyncs in order and creates no duplicate Event/Incident. |
| 22 | Fleet Management and Remote Diagnostics | Manage versions, commands, health and diagnostics across devices. | 52/38,42; T16/7; DF45/27–29 | PUSH 18–21; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Multi-device fleet view, scoped remote command, diagnostic bundle and audit trail work on real devices. |
| 23 | Camera Health Engine and SLOs | Normalize camera uptime, freshness, frozen stream, reconnect and degradation. | 52/19,42; T16/7; DF45/21 | PUSH 17,20–22; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Measured real-camera health detects disconnect/freeze/recovery with defined uptime and alert SLOs. |
| 24 | Repository and CI Quality Gate | Make typecheck, lint, tests, migration checks and build deterministic. | 52/5,46; T16/1,15 | None; frozen-area exclusion | CAN EXECUTE EARLY | READY NOW | Clean CI from fresh checkout runs required checks; zero unexplained failures; no frozen camera runtime changes. |
| 25 | Security, RLS and Privacy Hardening | Close tenant, secret, signed-media, rate-limit, audit and privacy gaps. | 52/47–48; S16/5,13; T16/12 | None; do not modify frozen connector contracts | CAN EXECUTE EARLY | READY NOW | Independent tenant/RLS/storage/secret tests pass; critical/high findings closed or formally accepted; frozen areas untouched. |
| 26 | Canonical Domain Consolidation and Legacy Retirement | Remove duplicated Event/Incident/observer paths through measured migration. | 52/2–7,27–28; T16/2 | PUSH 16,24–25 | BLOCKED BY PUSH 16 | NOT STARTED | One source of truth remains per domain; compatibility migration and rollback pass; no real pipeline regression. |
| 27 | Product Observability and Operational Telemetry | Expose end-to-end camera, inference, event, decision, notification and resource telemetry. | 52/42–45; T16/7,15; DF45/44 | Existing metrics; frozen-area adapters only via stable interfaces | CAN EXECUTE EARLY | READY NOW | Dashboards/alerts show defined SLOs from current services; telemetry failures do not affect processing; no frozen runtime semantics changed. |
| 28 | Quality Measurement and Benchmark Program | Measure precision, recall, FP/FN, latency and review coverage by model/site/event. | 52/43; S16/11,15; T16/15 | PUSH 11; representative labeled product/pilot data | SEQUENTIAL | NOT STARTED | Versioned representative dataset and ground truth produce reproducible metrics with confidence intervals and drift gates. |
| 29 | Native Events and Cheap Preprocessing | Use camera/DVR metadata, motion and scene filters before expensive AI. | 52/39; T16/8; DF45/30–32 | PUSH 23; connector/Gateway hardening; adapter evidence | SEQUENTIAL | NOT STARTED | Real source metadata/preprocessing reduces AI work without reducing measured critical-event recall beyond approved limit. |
| 30 | Adaptive Sampling and Candidate Events | Generate bounded candidates using freshness, zones, motion and priority. | 52/18,39; T16/8; DF45/33–34 | PUSH 23,28–29; product/pilot metrics | SEQUENTIAL | NOT STARTED | Real workload demonstrates adaptive sampling and candidate recall/latency against fixed baseline. |
| 31 | Durable AI Job Queue and Portable Workers | Decouple stream handling from prioritized, retryable inference jobs. | 52/40,45; T16/9; DF45/35–36,40 | PUSH 24,29–30; scale foundation | SEQUENTIAL | NOT STARTED | Durable queue survives worker loss, enforces tenant priority/backpressure and runs identical worker contract in two environments. |
| 32 | Hybrid AI Routing | Route tasks among edge, local, cloud and dedicated inference using policy/capability. | 52/20,40; T16/9; DF45/37–39 | PUSH 28,31; scale foundation | SEQUENTIAL | NOT STARTED | Measured policy selects eligible provider, fails over safely, preserves provenance and meets quality/latency/privacy gates. |
| 33 | AI and Infrastructure Cost Engine | Attribute GPU/CPU/AI/bandwidth/storage/notification cost per camera and tenant. | 52/44; S16/15; T16/15; DF45/41 | PUSH 27,31–32; scale foundation | SEQUENTIAL | NOT STARTED | Reconciled measured cost per camera/hour/month and tenant matches provider bills within approved tolerance. |
| 34 | Storage Abstraction, NAS and Retention Portability | Decouple evidence policy from Supabase and support approved object/NAS backends. | 52/36–37,41; T16/10; DF45/42 | PUSH 7,25 | SEQUENTIAL | NOT STARTED | Same retention, signed-access, deletion and evidence-integrity contract passes on two storage providers. |
| 35 | Portable Deployment and No-Office Dependency | Run core services on reproducible dedicated/cloud infrastructure without office dependency. | 52/41; T16/11; DF45/43 | PUSH 17,24,34; connector/Gateway hardening | SEQUENTIAL | NOT STARTED | Clean environment deploys from documentation, restores backup and operates without developer laptop/office server. |
| 36 | Horizontal Queue and Worker Scale Foundation | Partition tenants/cameras and scale stateless processing horizontally. | 52/40,45; T16/11; DF45/40,44 | PUSH 31,35; scale foundation | SEQUENTIAL | NOT STARTED | Load test shows horizontal throughput increase, bounded queue age and tenant fairness with no data crossing. |
| 37 | High Availability, Load Balancing and Failover | Eliminate single points of failure across API, workers, DB, storage and device control. | 52/41,45; T16/11; DF45/44 | PUSH 35–36; scale foundation | SEQUENTIAL | NOT STARTED | Controlled node/zone/provider failures meet RTO/RPO and preserve idempotency and device ownership. |
| 38 | Reliability, Load, Soak and Chaos Qualification | Prove 24/7 behavior at 10, 100 and 1,000-camera milestones. | 52/45–46; S16/15; T16/15 | PUSH 23,31,36–37; scale foundation | SEQUENTIAL | NOT STARTED | Measured staged tests publish uptime, latency, loss, recovery and capacity; target tier passes agreed SLOs. |
| 39 | External Notifications, Actions and Escalation | Activate provider-isolated push/email/SMS/WhatsApp/webhook/phone workflows safely. | 52/35; S16/13; DF45/44 | PUSH 10,25,27; provider sandboxes | SEQUENTIAL | NOT STARTED | Each enabled provider passes sandbox retry/dedupe/ack/quiet-hours/failure tests; production activation is explicit and reversible. |
| 40 | Billing, Subscription and Entitlement Production | Activate payment/invoice lifecycle and camera/AI entitlements. | 52/44,50; S16/15 | PUSH 25,39; provider/legal approval | SEQUENTIAL | NOT STARTED | Sandbox then limited production checkout, webhook idempotency, refund/failure/grace and entitlement reconciliation pass. |
| 41 | Enterprise Tenancy, RBAC, SSO and Service Accounts | Support organizations, multi-site policy, monitoring teams and machine identities. | 52/6–7,47,49; S16/5; T16/13 | PUSH 25–26,36; scale foundation | SEQUENTIAL | NOT STARTED | External tenant-isolation test, role matrix, SSO and scoped service-account flows pass across multiple organizations/sites. |
| 42 | External API and Webhook Platform | Publish versioned tenant-scoped API with auth, limits, audit and docs. | 52/49; S16/14; T16/14 | PUSH 25,26,41 | SEQUENTIAL | NOT STARTED | Independent consumer completes camera/status/event/evidence integration from published docs and conformance tests. |
| 43 | SDK, OEM and White-Label Proof | Package Observer Core for external embedding and OEM branding. | 52/49; S16/14; T16/14 | PUSH 42 | SEQUENTIAL | NOT STARTED | External-consumer-style sample integrates SDK/API without first-party UI; tenancy, branding and upgrade contract pass. |
| 44 | Native Mobile Production Readiness | Complete Android/iOS device, push, deep-link, security and store readiness. | 52/3,35,46,50; S16/13 | PUSH 25,39 | SEQUENTIAL | NOT STARTED | Signed real-device builds pass supported matrix, permissions/background/resume/push tests and store policy review. |
| 45 | Legal, Privacy and Compliance Closure | Obtain external review for video, identity, retention, workplace/home and AI use. | 52/47–48,50; S16/3–5,15; T16/12 | PUSH 25; defined pilot scope | SEQUENTIAL | NOT STARTED | Written scoped approvals/decisions, notices, DPA/consent, deletion/export and incident obligations are complete. |
| 46 | Real External Home Pilot | Operate a consented external home with measured support and reliability. | 52/50; S16/3,15 | PUSH 16,23,25,28,38–39,45; product/pilot metrics | SEQUENTIAL | NOT STARTED | Non-team external site runs agreed period with real cameras, support log, quality/SLO and privacy sign-off. |
| 47 | Real External Business Pilot | Validate business workflows, notices, zones, operations and customer value. | 52/50; S16/4,15 | PUSH 41,45–46; product/pilot metrics | SEQUENTIAL | NOT STARTED | Paying or contractually committed external business completes pilot exit criteria and referenceable outcome. |
| 48 | 100+ Camera / Monitoring-Center Pilot | Validate operator workflows and multi-site scale. | 52/45,50; S16/5,15 | PUSH 37–43,47; scale foundation | SEQUENTIAL | NOT STARTED | Real 100+ camera deployment meets SLOs, alert-load targets, operator acknowledgement and failover criteria. |
| 49 | Production Economics and KPI Proof | Establish uptime, FP/FN, latency, alerts/camera/day, cost/camera and retention economics. | 52/43–44,50; S16/15; T16/15 | PUSH 28,33,38,46–48; product/pilot metrics | SEQUENTIAL | NOT STARTED | Auditable cohort metrics and unit economics are sustained across defined period and reconciled to bills/revenue. |
| 50 | Acquisition Technical DD and Data Room | Produce architecture, security, test, IP, license, dependency, runbook and evidence package. | 52/51; S16/16; T16/16 | Documentation can start now; final closure needs 24–49 | CAN EXECUTE EARLY | READY NOW | Early PASS is not allowed; final PASS only when data room is complete, internally reconciled and independently reviewable. |
| 51 | Paying Customers, Growth, Funding and Strategic Partnerships | Prove repeatable demand, MRR/ARR, channels and strategic integration value. | 52/50,52; S16/15–16 | PUSH 46–49 | LATE-STAGE ONLY | LATE STAGE | Multiple paying customers, measured retention/unit economics and documented partner/funding pipeline exist. |
| 52 | Acquisition Process and Exit Readiness | Run a competitive strategic-acquirer process without single-buyer dependency. | 52/51–52; S16/16; T16/16 | PUSH 43,49–51 | LATE-STAGE ONLY | LATE STAGE | Complete DD, IP/financial/contract readiness, board/owner mandate and multiple qualified buyer paths exist. |

# DEPENDENCY GRAPH

```text
P16 real connector proof
  └─ P17 shared package/provisioning
      ├─ P18 identity/certificates
      ├─ P19 OTA/rollback
      ├─ P20 watchdog
      ├─ P21 offline/resync
      ├─ P22 fleet/diagnostics
      └─ P23 camera health
          └─ P29 cheap preprocessing → P30 candidate events

P24 CI + P25 security + P27 observability
  ├─ can execute early without changing frozen camera semantics
  └─ support P26 consolidation, P28 metrics, P31 queue, P39 providers and P50 DD

P28 quality + P30 candidates + P31 queue
  └─ P32 hybrid routing → P33 cost
      └─ P35 portability → P36 scale → P37 HA → P38 qualification

P41 enterprise → P42 API → P43 SDK/OEM
P45 legal + P38 reliability + P39 alerts
  └─ P46 home pilot → P47 business pilot → P48 100+ cameras
      └─ P49 KPI/economics → P51 growth/partners → P52 acquisition
```

Dependency classes:

- `READY NOW`: PUSH 24, 25, 27 and documentation-only preparation within PUSH 50.
- `DEPENDS ON PUSH 16`: PUSH 17 and PUSH 26.
- `DEPENDS ON CONNECTOR/GATEWAY HARDENING`: PUSH 18–23, 29 and 35.
- `DEPENDS ON SCALE FOUNDATION`: PUSH 31–33, 36–38, 41 and 48.
- `DEPENDS ON PRODUCT/PILOT METRICS`: PUSH 28, 30, 46, 47 and 49.
- `LATE / ACQUISITION STAGE`: PUSH 51–52; final PASS for PUSH 50 is also late.

# SAFE TO EXECUTE BEFORE PUSH 16 CLOSES

Only by a new explicit instruction; none is started by this reconciliation.

1. **PUSH 24 — Repository and CI Quality Gate.** Exclude frozen camera/connector runtime files; focus on deterministic checks, test orchestration, migration validation and documentation.
2. **PUSH 25 — Security, RLS and Privacy Hardening.** Limit work to DB/API/access/media-policy verification and non-camera secret controls; do not alter device identity or stream contracts.
3. **PUSH 27 — Product Observability and Operational Telemetry.** Add/read telemetry through existing stable interfaces; do not change sampling, relay, identity or connector semantics.
4. **PUSH 50 — Acquisition Technical DD and Data Room (documentation-only early slice).** Inventory architecture, ownership, dependencies, licenses, evidence and runbooks. The push remains `READY NOW`, not PASS, until late-stage proof is complete.

# FROZEN AREA UNTIL PUSH 16 CLOSES

No material changes, refactors, dependency upgrades, behavior changes, schema changes or deployment substitutions in these areas before the independent real-source test:

- `services/video-gateway/**`, including shared edge runtime, relay, sampling, journal, source ownership and secret stores.
- `scripts/run-software-connector.mjs`, `scripts/install-software-connector.mjs`, `scripts/run-video-gateway-local.sh`.
- `scripts/qa/check-software-connector.mjs`, production Connector verification scripts and real-source binding QA.
- `lib/domain/digital-observer/camera-connection-layer.ts`, connection resolver/adapter/capability contracts and source mapping.
- `lib/domain/digital-observer/connectors.ts`, `camera-connection-methods.ts`, `camera-gateway-adapter.ts`.
- `lib/domain/gateway-device-enrollment.ts`, device identity, enrollment, heartbeat, rotation, revocation and provenance semantics.
- `app/api/video-gateway/**` and `app/digital-observer/cameras/connector/**` where they participate in Connector enrollment, binding, heartbeat, discovery, ingest or playback.
- Relevant camera/connector migrations and canonical source identifiers.
- The active home Physical Gateway configuration, ten production relay sessions and DVR credentials/session ownership.

Permitted before closure: read-only inspection, evidence collection, documentation, and tests that do not open a second real DVR session or mutate the listed contracts.

# WHEN PUSH 16 PASSES

1. Record one closure report for PUSH 16/16B with the independent camera E2E evidence.
2. Re-run regression for the existing Physical Gateway ten-channel home pipeline.
3. Confirm no duplicate source, Event, Incident, evidence or device identity was created.
4. Mark PUSH 16 `DONE` only after Production backend/UI proof.
5. Resume sequentially at **PUSH 17**.
6. If PUSH 24, 25, 27 or the early documentation slice of 50 was completed early, do not redo it; perform only the regression/revalidation stated below.

# EARLY-COMPLETED PUSH HANDLING

An early push keeps its canonical number and is marked `DONE EARLY`. When sequential progress reaches it:

1. Verify its original PASS evidence still applies to the current revision/environment.
2. Run only dependency-sensitive regression tests introduced since early completion.
3. Reopen only failed or invalidated acceptance items.
4. Do not rebuild the capability or renumber the roadmap.
5. Convert `DONE EARLY` to `DONE` after revalidation; retain links to both the early report and revalidation report.

# ACQUISITION / EXIT END STATE

The roadmap ends only when the technology and business are independently inspectable: real external pilots, paying customers, measured quality/uptime/latency/cost, stable API/OEM proof, clean IP and license ownership, complete security/privacy evidence, reconciled contracts and financials, strategic partnerships, and multiple qualified acquisition paths. “Software works” is not the exit criterion.

# RECONCILIATION ACCEPTANCE

- One canonical numbered roadmap: PASS.
- PUSH 1–15 numbers and final meanings retained: PASS.
- PUSH 16 remains blocked, not PASS: PASS.
- All reconstructed source slots represented: PASS (`52/52`, `16/16`, `16/16`, `45/45`).
- Dependencies and early execution mode explicit: PASS.
- Frozen area and single resume point defined: PASS.
- Acquisition/exit included: PASS.
- Code/deploy/refactor performed: NO.
