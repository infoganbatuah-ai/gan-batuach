# DIGITAL OBSERVER — ROADMAP TRACEABILITY MATRIX

Date: 2026-09-06
Canonical roadmap: `DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md`

## Traceability rules

The intact verbatim 52/16/16/45 source lists were not found in the current working tree or reachable Git documentation. Every source slot is preserved and mapped, but reconstructed titles are labeled `[RECONSTRUCTED — SOURCE TEXT UNRESOLVED]`. The normalized requirement is based on historical Git documents, the current reconciliation request, `DIGITAL_OBSERVER_MASTER_AUDIT.md`, and final PUSH 1–16 reports.

Status meanings in this register: `DONE`, `PARTIAL`, `BLOCKED`, `READY NOW`, `NOT STARTED`, `LATE STAGE`. `DONE` relies on final closure reports, not intermediate failures.

Canonical mapping may be many-to-one: overlapping source requirements map to the same canonical PUSH without deleting their source identity.

## ORIGINAL 52

Source confidence: requirement intent `MEDIUM`; exact original title `LOW/UNRESOLVED`.

| Source | No. | Original name | Normalized requirement | Domain | Dependencies | Current status | Current implementation / canonical PUSH | Remaining work |
|---|---:|---|---|---|---|---|---|---|
| Original 52 | 1 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Existing-system audit | Audit repository/runtime before development | Audit | None | DONE | PUSH 1 | Maintain report as baseline; re-audit after major releases. |
| Original 52 | 2 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Current architecture | Document actual frontend/backend/video/AI/storage/deployment | Architecture | 52/1 | DONE | PUSH 1–2 | Consolidate duplicate domains in PUSH 26. |
| Original 52 | 3 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Product UI | Real authenticated home/business/admin product surfaces | Product | Auth/data | DONE | Existing UI; PUSH 2,4,13,15 | Native production QA remains PUSH 44. |
| Original 52 | 4 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Backend services | Real APIs and domain services behind UI | Backend | DB/auth | PARTIAL | PUSH 2–15 | Canonical consolidation PUSH 26; API hardening PUSH 42. |
| Original 52 | 5 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Database and migrations | Reproducible schema, migration and rollback state | Database | Environment | PARTIAL | PUSH 2 and release reports | Deterministic CI/migration gate PUSH 24. |
| Original 52 | 6 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Authentication and users | Secure sessions, users and role routing | Identity | DB | PARTIAL | Supabase auth; PUSH 2/15 | Enterprise SSO/service accounts PUSH 41. |
| Original 52 | 7 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Organizations/sites/tenants | Organization → site → camera/user hierarchy and isolation | Tenancy | Auth/RLS | PARTIAL | Observer sites/memberships; PUSH 14–15 | Enterprise isolation proof PUSH 41. |
| Original 52 | 8 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Canonical camera source | One vendor-agnostic source of truth | Camera | Audit | DONE | PUSH 14 | Revalidate through Connector PUSH 16. |
| Original 52 | 9 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] DVR/NVR connectivity | Real recorder/channel connectivity | Camera | Gateway | DONE | PUSH 3 real home DVR | Broader hardware matrix and fleet hardening PUSH 17–23. |
| Original 52 | 10 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] RTSP | Secure server-side RTSP ingest | Camera | Connector/Gateway | PARTIAL | Existing Gateway, PUSH 14–16 | Independent Connector RTSP proof PUSH 16; compatibility matrix later. |
| Original 52 | 11 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] ONVIF | Discovery/profile/stream URI and secure onboarding | Camera | Connector/Gateway | PARTIAL | Existing foundations, PUSH 14–16 | Real independent ONVIF proof PUSH 16 or later matrix. |
| Original 52 | 12 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Vendor cloud/API | Prefer authorized vendor API when viable | Camera | Vendor access | PARTIAL | Resolver/adapter catalogue PUSH 14–15 | Real vendor adapter and evidence later. |
| Original 52 | 13 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Live playback/WebRTC | Secure low-latency user playback | Video | Gateway/auth | PARTIAL | HLS production proof PUSH 7; WebRTC contract | Real WebRTC qualification and scale. |
| Original 52 | 14 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Software Connector | Outbound deployable software connection option | Edge | PUSH 15 | BLOCKED | PUSH 16 implementation complete; E2E blocked | Independent physical source closure. |
| Original 52 | 15 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Physical Gateway | Hardware only as justified Digital-First exception | Edge | Assessment | DONE | Real home Gateway; PUSH 3/14 | Shared package/fleet hardening PUSH 17–23. |
| Original 52 | 16 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Shared edge core | One runtime core for Connector and Gateway | Edge | PUSH 16 | PARTIAL | PUSH 16 shared foundations | Canonical PUSH 17. |
| Original 52 | 17 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Stream ingestion | Continuously ingest authorized real streams | Video | Source/Gateway | DONE | PUSH 3 real home stream | Multi-device/scale qualification PUSH 23/38. |
| Original 52 | 18 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Decode/sample/buffer | Fresh decoding, bounded sampling and buffering | Video | Ingest | PARTIAL | PUSH 3,7 and Gateway core | Offline/resync and adaptive sampling PUSH 21/30. |
| Original 52 | 19 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Reconnect/frozen/health | Detect and recover stream failures | Reliability | Gateway | PARTIAL | Existing monitor; home regression reports | Camera Health Engine PUSH 23; soak PUSH 38. |
| Original 52 | 20 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] AI model/provider | Versioned real inference with provenance | AI | Frames | PARTIAL | ONNX real person model PUSH 3–4 | Hybrid/provider routing and benchmark PUSH 28/32. |
| Original 52 | 21 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Person detection | Real person detection on live frames | AI | Model | DONE | PUSH 3–4 | Broader quality and environment matrix PUSH 28. |
| Original 52 | 22 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Vehicle/animal/object detection | Additional object families with measured quality | AI | Data/models | NOT STARTED | Vocabulary/readiness only | PUSH 28–32 as prioritized by pilots. |
| Original 52 | 23 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Activity/fall/fire/crowd | Safety/activity detectors with human verification | AI | Models/legal | NOT STARTED | Policy/event vocabulary only | Benchmarks, legal scope and real pilot evidence. |
| Original 52 | 24 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Tracking | Stable IDs, duration and trajectory | Tracking | Person detection | DONE | PUSH 5 | Multi-camera/Re-ID remains separate and consent-gated. |
| Original 52 | 25 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Zones and line crossing | Entry/exit, restricted zones and direction | Spatial | Tracking/config | DONE | PUSH 5 | Broader site templates/pilot validation. |
| Original 52 | 26 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Identity/cross-camera | Known/unknown and cross-camera correlation | Identity | Legal/quality | PARTIAL | Incident correlation; identity restrictions | Consent/legal gate and future scoped implementation. |
| Original 52 | 27 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Event schema | Canonical normalized Event with provenance | Events | Detection | DONE | PUSH 3–4 | Consolidate legacy paths PUSH 26. |
| Original 52 | 28 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Incident engine | Correlation, lifecycle, timeline and idempotency | Incidents | Events | DONE | PUSH 6 | Scale/operations regression PUSH 38. |
| Original 52 | 29 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Context/time/schedules | Site, zone, time and expected-hours context | Context | Events/site config | DONE | PUSH 8–9 | Validate across external sites. |
| Original 52 | 30 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Memory/baseline | Per-site/camera baseline and safe learning | Learning | Real history | DONE | PUSH 8/11 | Representative long-run metrics PUSH 28/46–49. |
| Original 52 | 31 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Risk/decision/verification | Explainable risk and verified final decision | Decision | Incident/context | DONE | PUSH 9–10 | Calibrate only through human-gated metrics. |
| Original 52 | 32 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Structured rules | WHEN/conditions/THEN with bounded actions | Rules | Event schema | DONE | PUSH 9/12 | Expand taxonomy only with tests/pilots. |
| Original 52 | 33 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Natural-language rules | Compile, preview, confirm and execute NL rules | NLU | Structured rules | DONE | PUSH 12 | More languages/intents later. |
| Original 52 | 34 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Investigation/search | Grounded NL search over real records/evidence | Investigation | Event/incident/evidence | DONE | PUSH 13 | Scale/index/retention validation. |
| Original 52 | 35 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Alerts/actions | In-app, push, email, SMS, WhatsApp, webhook, phone | Notifications | Decision/providers | PARTIAL | In-app real; adapters/readiness | Canonical PUSH 39. |
| Original 52 | 36 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Evidence/clips | Snapshots and bounded pre/post event clips | Evidence | Event/media | DONE | PUSH 7 | Multi-storage portability PUSH 34. |
| Original 52 | 37 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Storage/retention/deletion | Private storage, signed access and retention | Storage | Evidence/privacy | DONE | PUSH 7 | Provider abstraction/NAS PUSH 34. |
| Original 52 | 38 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Gateway fleet/OTA | Provisioning, certificates, OTA, rollback, watchdog, fleet | Device ops | Connector | PARTIAL | PUSH 16 lifecycle foundations | PUSH 17–23. |
| Original 52 | 39 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Cheap preprocessing | Motion/native events/zones/adaptive sampling | Efficiency | Camera health/data | PARTIAL | Sampling/motion foundations | PUSH 29–30. |
| Original 52 | 40 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] AI queue/routing | Durable jobs, priorities, workers and hybrid routes | AI infrastructure | Preprocessing | PARTIAL | Local worker foundations | PUSH 31–33. |
| Original 52 | 41 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Portable infrastructure | Containers/cloud/dedicated/NAS; no office dependency | Infrastructure | Shared packages/storage | PARTIAL | Docker/service foundations | PUSH 34–37. |
| Original 52 | 42 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Observability | Camera/stream/inference/event/queue/resource metrics | Operations | Stable interfaces | READY NOW | Existing telemetry fragments | PUSH 27. |
| Original 52 | 43 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Quality metrics | Precision/recall/FP/FN/latency/alerts per camera | Quality | Ground truth | PARTIAL | PUSH 11 metric foundations | PUSH 28/49. |
| Original 52 | 44 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Cost engine | Cost by GPU/AI/CPU/bandwidth/storage/camera/tenant | Economics | Telemetry/scale | NOT STARTED | Usage schema only | PUSH 33/49. |
| Original 52 | 45 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Scale/reliability | 10/100/1,000/10,000 camera architecture | Scale | Queue/HA | PARTIAL | Ten-channel home proof | PUSH 36–38/48. |
| Original 52 | 46 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Testing/CI | Unit/integration/E2E/camera/AI/security/load/chaos | Quality engineering | Repository | READY NOW | Extensive focused QA | PUSH 24/28/38. |
| Original 52 | 47 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Security | Encryption, secrets, access, RLS, audit, rate limits | Security | Architecture | READY NOW | Multiple controls and push closures | PUSH 25/41. |
| Original 52 | 48 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Privacy/compliance | Retention, deletion, identity, consent, masks, auditability | Privacy | Legal/product | READY NOW | Strong policy foundations | PUSH 25/45. |
| Original 52 | 49 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] API/SDK/OEM | External versioned API and embeddable platform | Platform | Enterprise/security | NOT STARTED | Internal contracts only | PUSH 42–43. |
| Original 52 | 50 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Pilots/customers/revenue | Real sites, paying customers and operational metrics | Market validation | Reliability/legal | NOT STARTED | Internal home pilot evidence | PUSH 40/46–49/51. |
| Original 52 | 51 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Technical DD | Clean repo, docs, tests, IP/licenses and data room | Acquisition | All technical foundations | READY NOW | Audit/reports exist | PUSH 50; final closure late-stage. |
| Original 52 | 52 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Growth/funding/exit | Partnerships, MRR/ARR, funding and multiple acquirers | Strategy | Product/metrics/DD | LATE STAGE | Historical readiness concepts | PUSH 51–52. |

**Original 52 accounted for: 52/52.** Exact original title text is unresolved for entries 1–52; normalized requirement coverage is complete.

## ORIGINAL 16 — STRATEGIC

Source confidence: requirement intent `MEDIUM`; exact original title `LOW/UNRESOLVED`.

| Source | No. | Original name | Normalized requirement | Domain | Dependencies | Current status | Current implementation / canonical PUSH | Remaining work |
|---|---:|---|---|---|---|---|---|---|
| Strategic 16 | 1 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Autonomous security brain | Vendor-agnostic autonomous Observer North Star | Strategy | Audit | PARTIAL | PUSH 1–15 foundations | Infrastructure/pilots PUSH 16–49. |
| Strategic 16 | 2 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Digital-First camera access | Prefer cloud/direct/RTSP/Connector before hardware | Camera strategy | Camera layer | DONE | PUSH 14–15 | Connector closure PUSH 16 and adapter expansion. |
| Strategic 16 | 3 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Home product | Safe home onboarding/monitoring/privacy | Vertical | Camera/product | PARTIAL | Home pilot pipeline and UI | External home pilot PUSH 46. |
| Strategic 16 | 4 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Business product | Business sites, schedules, zones and notices | Vertical | Home/common core | PARTIAL | Templates/UI/rules | External business pilot PUSH 47. |
| Strategic 16 | 5 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Enterprise multi-site | Organizations, policy teams, SLA and escalation | Enterprise | Scale/security | PARTIAL | Sites/memberships foundations | PUSH 41/48. |
| Strategic 16 | 6 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Perception | Real people/objects/activities with provenance | AI | Real streams | PARTIAL | Real person PUSH 3–4 | Additional measured detectors PUSH 28–32. |
| Strategic 16 | 7 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Tracking/zones/identity | Track and spatial meaning with bounded identity | Intelligence | Perception/legal | PARTIAL | PUSH 5 | Cross-camera/identity future gated work. |
| Strategic 16 | 8 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Events and incidents | Canonical fact-to-incident lifecycle | Core | Tracking | DONE | PUSH 3–6 | Scale and legacy consolidation. |
| Strategic 16 | 9 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Context/memory/baseline | Understand site/time/history/normal behavior | Learning | Events | DONE | PUSH 8/11 | Long-run representative validation. |
| Strategic 16 | 10 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Risk and decisions | Explainable risk and safe automatic decisions | Decision | Incident/context | DONE | PUSH 9–10 | Broader calibration/pilot thresholds. |
| Strategic 16 | 11 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Verification and learning | Verify before disturbing; learn from feedback safely | Quality | Decision/users | DONE | PUSH 10–11 | Measured quality program PUSH 28. |
| Strategic 16 | 12 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Natural language | Rules and investigation in natural language | NLU | Canonical core | DONE | PUSH 12–13 | Broader coverage/scale. |
| Strategic 16 | 13 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Actions and evidence | Preserve evidence and execute alerts/escalation | Operations | Decision/providers | PARTIAL | Evidence PUSH 7; in-app decisions | External channels PUSH 39. |
| Strategic 16 | 14 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] API/OEM platform | Expose Observer Core beyond first-party UI | Platform | Enterprise/security | NOT STARTED | Internal integration contracts | PUSH 42–43. |
| Strategic 16 | 15 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Pilots and economics | Real customers, quality, uptime, cost and revenue | Validation | Production stack | NOT STARTED | Internal pilot evidence only | PUSH 46–51. |
| Strategic 16 | 16 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Acquisition/exit | Build a defensible strategic-acquisition asset | Strategy | DD/commercial proof | LATE STAGE | Audit/report foundation | PUSH 50–52. |

**Original 16 — Strategic accounted for: 16/16.** Exact original title text is unresolved for entries 1–16.

## ORIGINAL 16 — TECHNICAL/DD

Source confidence: requirement intent `MEDIUM-HIGH` because the current request enumerates these technical domains; exact original title `LOW/UNRESOLVED`.

| Source | No. | Original name | Normalized requirement | Domain | Dependencies | Current status | Current implementation / canonical PUSH | Remaining work |
|---|---:|---|---|---|---|---|---|---|
| Technical/DD 16 | 1 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Audit and architecture | Evidence-based architecture/repository baseline | DD | None | DONE | PUSH 1–2 | Keep current; CI hardening PUSH 24. |
| Technical/DD 16 | 2 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Canonical contracts | One source/event/incident/risk contract | Architecture | Audit | PARTIAL | PUSH 4/6/9/14 | Legacy retirement PUSH 26. |
| Technical/DD 16 | 3 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Connector/Gateway package | Shared deployable edge package | Edge | Camera contracts | PARTIAL | PUSH 16 | E2E PUSH 16; hardening PUSH 17. |
| Technical/DD 16 | 4 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Device provisioning | Identity, enrollment, certificates and rotation | Device security | Shared package | PARTIAL | PUSH 16 lifecycle proof | PUSH 17–18. |
| Technical/DD 16 | 5 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] OTA and rollback | Signed remote updates and recovery | Fleet | Identity/package | NOT STARTED | Packaging only | PUSH 19. |
| Technical/DD 16 | 6 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Self-healing/offline | Watchdog, buffering and resync | Reliability | Device runtime | PARTIAL | Local restart/retry foundations | PUSH 20–21. |
| Technical/DD 16 | 7 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Camera health/observability | Health engine, diagnostics and SLO telemetry | Operations | Stable runtime | PARTIAL | Existing health/heartbeat | PUSH 22–23/27. |
| Technical/DD 16 | 8 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Cheap preprocessing | Native events, motion, scene and adaptive sampling | Efficiency | Health/quality | PARTIAL | Sampling/motion foundations | PUSH 29–30. |
| Technical/DD 16 | 9 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Queue and hybrid AI | Durable jobs, portable workers and routing | AI infrastructure | Preprocessing/metrics | PARTIAL | Local inference foundations | PUSH 31–33. |
| Technical/DD 16 | 10 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Storage portability | Abstract cloud/local/NAS evidence storage | Storage | Evidence/privacy | PARTIAL | Supabase production evidence | PUSH 34. |
| Technical/DD 16 | 11 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Portable scale/HA | No-office deployment, horizontal scale and failover | Infrastructure | Queue/storage | NOT STARTED | Containers/readiness only | PUSH 35–38. |
| Technical/DD 16 | 12 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Security/privacy | RLS, secrets, access, retention, compliance | Security | Architecture | READY NOW | Strong controls, incomplete independent proof | PUSH 25/45. |
| Technical/DD 16 | 13 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Enterprise controls | Multi-tenancy, RBAC, SSO and service accounts | Enterprise | Security/scale | PARTIAL | Site memberships and roles | PUSH 41. |
| Technical/DD 16 | 14 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] API/SDK/OEM | Versioned external consumer platform | Platform | Enterprise | NOT STARTED | Internal APIs/contracts | PUSH 42–43. |
| Technical/DD 16 | 15 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Tests/metrics/cost | CI, load, quality and unit economics | Qualification | Telemetry/data | PARTIAL | Focused QA and calibration records | PUSH 24/27/28/33/38/49. |
| Technical/DD 16 | 16 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] DD/acquisition readiness | Data room, IP/licenses, runbooks and buyer readiness | Acquisition | All evidence | READY NOW | Audit/report history | PUSH 50–52. |

**Original 16 — Technical/DD accounted for: 16/16.** Exact original title text is unresolved for entries 1–16.

## DIGITAL-FIRST 45

Source confidence: requirement intent `HIGH` for entries represented explicitly by PUSH 14–16/current request, `MEDIUM` for later infrastructure slots; exact original title `LOW/UNRESOLVED`.

| Source | No. | Original name | Normalized requirement | Domain | Dependencies | Current status | Current implementation / canonical PUSH | Remaining work |
|---|---:|---|---|---|---|---|---|---|
| Digital-First 45 | 1 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Camera layer audit | Inventory real, partial, mock and missing camera paths | Audit | None | DONE | PUSH 1/14 inventory | Revalidate after infrastructure changes. |
| Digital-First 45 | 2 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Canonical source | One vendor-agnostic Camera Source | Camera core | Audit | DONE | PUSH 14 | Connector E2E regression. |
| Digital-First 45 | 3 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Adapter interface | Bounded adapter contract | Camera core | Source model | DONE | PUSH 14 | Add adapters only with evidence. |
| Digital-First 45 | 4 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Capability model | Normalize live, playback, events, PTZ, audio and health | Camera core | Adapter | DONE | PUSH 14 | Real per-adapter qualification. |
| Digital-First 45 | 5 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Vendor Cloud/API first | Prefer authorized vendor integration | Connectivity | Adapter credentials | PARTIAL | PUSH 14 resolver | Real provider adapter. |
| Digital-First 45 | 6 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Direct secure connection | Use secure reachable direct path when proven | Connectivity | Network/security | PARTIAL | PUSH 14 policy | Real direct-connect proof. |
| Digital-First 45 | 7 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] RTSP support | Server-side RTSP over safe transport | Connectivity | Gateway/Connector | PARTIAL | Real DVR relay and contracts | Independent Connector RTSP proof PUSH 16. |
| Digital-First 45 | 8 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] ONVIF support | Discover/profile/connect authorized cameras | Connectivity | LAN Connector | PARTIAL | ONVIF foundations | Independent real ONVIF qualification. |
| Digital-First 45 | 9 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] DVR/NVR support | Recorder discovery, shared session and channels | Connectivity | Gateway | DONE | PUSH 3 real home DVR | Broader vendor matrix/hardening. |
| Digital-First 45 | 10 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Playback transport | HLS/WebRTC without raw credential exposure | Video | Source/auth | PARTIAL | HLS production proof PUSH 7 | WebRTC/scale qualification. |
| Digital-First 45 | 11 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Connection assessment | Collect evidence and constraints before recommendation | Onboarding | Adapters | DONE | PUSH 14–15 | Broader provider data. |
| Digital-First 45 | 12 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Digital-First resolver | Explainably choose safest viable method | Onboarding | Assessment | DONE | PUSH 14 | Real diverse-source validation. |
| Digital-First 45 | 13 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Zero-touch onboarding | Guided state machine from assessment to activation | Product | Resolver | DONE | PUSH 15 | External usability metrics. |
| Digital-First 45 | 14 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Truthful activation | Never claim live before verified health/source | Product safety | Onboarding | DONE | PUSH 15 | Maintain invariant in future adapters. |
| Digital-First 45 | 15 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Hardware exception | Physical Gateway only when justified | Strategy | Resolver | DONE | PUSH 14 real home assessment | Revalidate new hardware recommendations. |
| Digital-First 45 | 16 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Software Connector | Outbound software option before new hardware | Edge | Onboarding | PARTIAL | PUSH 16 implementation | Real independent physical source. |
| Digital-First 45 | 17 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Separate identity E2E | Prove connector-owned real source and event provenance | Edge verification | Independent camera | BLOCKED | PUSH 16B safety stop | PUSH 16C when camera arrives. |
| Digital-First 45 | 18 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Shared package | Unify Connector/Gateway runtime package | Edge architecture | PUSH 16 | PARTIAL | Shared core foundations | PUSH 17. |
| Digital-First 45 | 19 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Provisioning | Repeatable install/enroll/configure/recover | Device ops | Shared package | PARTIAL | PUSH 16 | PUSH 17–18 real devices. |
| Digital-First 45 | 20 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Certificates/rotation | Device-bound trust and rotation | Device security | Provisioning | PARTIAL | Token rotation/revocation | Certificate/attestation PUSH 18. |
| Digital-First 45 | 21 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Camera Health Engine | Unified freshness/uptime/frozen/reconnect | Reliability | Runtime telemetry | PARTIAL | Existing monitor/heartbeat | PUSH 23. |
| Digital-First 45 | 22 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Watchdog/self-heal | Recover process/stream safely | Reliability | Device identity | PARTIAL | Local restart foundations | PUSH 20. |
| Digital-First 45 | 23 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] OTA | Signed remote software updates | Fleet | Identity/package | NOT STARTED | No real OTA proof | PUSH 19. |
| Digital-First 45 | 24 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Rollback | Atomic rollback after bad update | Fleet | OTA | NOT STARTED | Config rollback tests only | PUSH 19 real rollback. |
| Digital-First 45 | 25 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Offline buffering | Bounded offline metadata/evidence queue | Reliability | Storage/policy | PARTIAL | Journal/outbox foundations | PUSH 21. |
| Digital-First 45 | 26 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Resync | Ordered idempotent cloud reconciliation | Reliability | Offline buffer | PARTIAL | Outbox retry foundations | PUSH 21 real outage. |
| Digital-First 45 | 27 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Fleet management | Inventory/version/status at device scale | Fleet | Identity/health | NOT STARTED | Single-device lifecycle | PUSH 22. |
| Digital-First 45 | 28 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Remote commands | Scoped auditable device actions | Fleet | Fleet security | PARTIAL | Private NVR command contracts | PUSH 22 real fleet proof. |
| Digital-First 45 | 29 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Diagnostics | Remote safe diagnostic bundles | Operations | Fleet/telemetry | PARTIAL | Heartbeat/diagnostic foundations | PUSH 22/27. |
| Digital-First 45 | 30 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Native events | Consume trusted camera/DVR event metadata | Preprocessing | Adapter capability | NOT STARTED | Capability vocabulary only | PUSH 29. |
| Digital-First 45 | 31 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Motion filter | Gate expensive processing with cheap motion | Preprocessing | Frame sampling | PARTIAL | Motion/activity metrics | PUSH 29 measured impact. |
| Digital-First 45 | 32 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Scene/zones filter | Use scene change and zones before inference | Preprocessing | Zones | PARTIAL | PUSH 5 zones, activity metrics | PUSH 29. |
| Digital-First 45 | 33 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Adaptive sampling | Change sample rate by risk/activity/freshness | Efficiency | Metrics/quality | NOT STARTED | Fixed/bounded sampling | PUSH 30. |
| Digital-First 45 | 34 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Candidate Events | Promote cheap signals into bounded candidates | Event infrastructure | Preprocessing | PARTIAL | Journal qualification | PUSH 30. |
| Digital-First 45 | 35 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] AI Job Queue | Durable prioritized inference queue | AI infrastructure | Candidates | PARTIAL | Local worker/queue concepts | PUSH 31. |
| Digital-First 45 | 36 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Portable workers | Same worker contract across environments | AI infrastructure | Job queue | NOT STARTED | Local ONNX worker | PUSH 31. |
| Digital-First 45 | 37 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Local/edge AI | Privacy/cost-aware local inference | AI routing | Portable workers | PARTIAL | Real local ONNX person | PUSH 32 qualification. |
| Digital-First 45 | 38 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Cloud/dedicated AI | Optional scalable provider inference | AI routing | Provider contracts | NOT STARTED | Readiness only | PUSH 32. |
| Digital-First 45 | 39 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Hybrid router | Select edge/local/cloud by policy | AI routing | Multiple providers | NOT STARTED | No measured router | PUSH 32. |
| Digital-First 45 | 40 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Priority/backpressure | Protect streams/tenants under load | Scale | Durable queue | PARTIAL | Bounded local concurrency | PUSH 31/36. |
| Digital-First 45 | 41 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] GPU/cost control | Measure and optimize inference cost | Economics | Routing/telemetry | NOT STARTED | No reconciled cost engine | PUSH 33. |
| Digital-First 45 | 42 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Storage abstraction/NAS | Portable evidence/recording storage | Storage | Evidence/privacy | PARTIAL | Supabase production evidence | PUSH 34. |
| Digital-First 45 | 43 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] No-office portable infra | Dedicated/cloud deployment independent of office | Infrastructure | Package/storage | NOT STARTED | Docker/readiness | PUSH 35. |
| Digital-First 45 | 44 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Scale/failover/observability | Horizontal operation and measurable reliability | Scale | Queue/HA | PARTIAL | Ten-channel home + telemetry fragments | PUSH 27/36–38. |
| Digital-First 45 | 45 | [RECONSTRUCTED — SOURCE TEXT UNRESOLVED] Production/OEM proof | Demonstrate portable platform to customers/partners | Productization | Scale/security/API | NOT STARTED | Internal product only | PUSH 42–49. |

**Digital-First 45 accounted for: 45/45.** Exact original title text is unresolved for entries 1–45; requirement intent is preserved.

# CURRENT PUSH → ORIGINAL REQUIREMENTS COVERED

| Current PUSH | Original 52 | Strategic 16 | Technical/DD 16 | Digital-First 45 | Coverage result |
|---:|---|---|---|---|---|
| 1 | 1–7,46–48 | 1 | 1,12 | 1 | COMPLETE |
| 2 | 2,4–7,46–47 | 1 | 1–2,12,15 | 1 | COMPLETE |
| 3 | 9–11,15,17–21 | 2,6 | 3,7–9 | 7–10,21,31,37 | COMPLETE |
| 4 | 20–23,27 | 6,8 | 2,9 | 34–37 | COMPLETE |
| 5 | 24–26 | 7 | 2,8 | 32 | COMPLETE |
| 6 | 27–28 | 8 | 2 | 34 | COMPLETE |
| 7 | 13,18,36–37 | 13 | 10,12 | 10,25–26,42 | COMPLETE — NEEDS LATER SCALE QA |
| 8 | 29–30 | 9 | 8,15 | 31–34 | COMPLETE — NEEDS LATER SCALE QA |
| 9 | 31–32 | 10 | 2,15 | 34 | COMPLETE |
| 10 | 31,43 | 11 | 15 | 34,44 | COMPLETE |
| 11 | 30,43 | 9,11 | 15 | 31,33,41,44 | COMPLETE — NEEDS LATER SCALE QA |
| 12 | 32–33 | 12 | 2 | 34 | COMPLETE |
| 13 | 34,36–37 | 12–13 | 10,14 | 42,45 | COMPLETE — NEEDS LATER SCALE QA |
| 14 | 8–15 | 2 | 2–4 | 2–12,15 | COMPLETE |
| 15 | 8,12,14–15 | 2–4 | 3–4 | 11–16 | COMPLETE |
| 16 | 14,16,18–19,38 | 2 | 3–7 | 16–29 | PARTIAL — OPEN HARDWARE VERIFICATION BLOCKER |

No current PUSH is marked complete solely because a UI or schema exists. PUSH 16 remains non-PASS.

# COVERAGE CHECKSUM

- Original 52 rows: **52**.
- Original 16 — Strategic rows: **16**.
- Original 16 — Technical/DD rows: **16**.
- Digital-First 45 rows: **45**.
- Total source slots represented: **129**.
- Canonical pushes: **52**.
- Dropped source slots: **0**.
- Exact verbatim source titles unresolved: Original 52 entries 1–52; Strategic 16 entries 1–16; Technical/DD 16 entries 1–16; Digital-First 45 entries 1–45.
