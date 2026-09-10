# DIGITAL OBSERVER — NORTH-STAR COMPLETION MATRIX

Date: 2026-09-10
Roadmap boundary: the existing canonical 52 PUSHES only.

This register maps every requested North-Star capability to an existing canonical owner and a final proof obligation. Status is deliberately evidence-based: code or UI alone is not `DONE + REAL PROOF`.

`52/52 PUSHES DONE != PRODUCT COMPLETE` unless a future North-Star Completion Audit confirms that every mandatory row has reached its required final evidence state. No PUSH 53+ is implied or authorized by this matrix.

## STATUS HISTORY

| Capability | Previous Status | New Status | PUSH / reason | Evidence added, removed or reinterpreted |
|---|---|---|---|---|
| Fleet Management count ledger | Reported aggregate: `22 DONE / 15 implemented / 70 foundation / 18 partial / 64 not started / 1 external` | Matrix truth retained: `24 / 20 / 69 / 17 / 59 / 1` | PUSH 23 reconciliation | PUSH 22 report arithmetic did not match its committed 190-row matrix. No row-level transition supported the reported regression, so no capability was silently downgraded. |
| Camera Health | Previous: PARTIAL | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 23 canonical health contract | Added bounded dimensions, expiry, expected/capacity denominator, common-cause root cause, flapping, API/UI and nine deterministic failure cases. Real destructive fault proof remains outstanding. |
| Canonical domain consolidation | No row status transition | No row status transition | PUSH 26 ownership/compatibility closure | Added executable ownership manifest, unified Product Incident discriminator, explicit mock/shared-product provenance, retirement register and regression evidence. This strengthens existing rows without claiming new real-world capability proof. |
| Precision | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 28 benchmark engine | Added denominator-scoped precision, Wilson 95% interval, dataset/model/camera/Site scope and first reviewed real result; representative volume remains missing. |
| Recall | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 28 benchmark engine | Added explicit FN opportunity contract and truthful non-measurable result when missed-event review is incomplete; representative blind review remains missing. |
| False-positive rate | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 28 benchmark engine | Added categorized FP ledger and denominator/version scope; current reviewed real sample is only n=1. |
| False-negative analysis | Previous: NOT STARTED | New: FOUNDATION | PUSH 28 benchmark engine | Expected-but-missing events are representable, but current Product data does not yet enumerate false negatives. |
| Confidence calibration | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 28 benchmark engine | Added confidence bins/ECE and insufficiency gate; current real sample is too small for calibration. |
| Metadata-first processing | Previous: FOUNDATION | New: PARTIAL | PUSH 29 candidate contract | Added vendor-agnostic native-signal vocabulary, candidate-only provenance and sanitized capability learning; current DVR/Tapo native metadata remains unverified. |
| Preprocessing | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 29 cheap preprocessing | Local frame difference now gates ONNX through dedupe/coalescing, never-blind fallback, Watch Rule/critical overrides and exact workload counters; representative FN Ground Truth remains missing. |
| Sampling | Previous: FOUNDATION | New: PARTIAL | PUSH 29 bounded scheduling | Added human-gated candidate/always/adaptive policy and a 22-sample real-input comparison; full adaptive Candidate Events remain PUSH 30. |
| Sampling | Previous: PARTIAL | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 30 adaptive scheduler | Added explicit purpose/priority, never-blind floor, Watch/Incident/Track protection, deterministic pressure/fairness QA, 11-camera real-input workload and 11/11 learning scheduling. Recall and representative duration remain unproven. |
| Queues | Previous: NOT STARTED | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 31 durable AI queue | Added restart-safe WAL jobs, lease/ACK/retry/dead-letter, expiry, priority, hierarchical fairness and backpressure; production horizontal scale remains unproven. |
| AI job queue | Previous: NOT STARTED | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 31 queue/worker closure | Worker-loss recovery, duplicate-effect prevention, two-environment portable contract and a real Tapo queue→ONNX→Tracker sample passed; multi-node Production operation remains future proof. |
| Hybrid routing | Previous: NOT STARTED | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 32 eligibility/router | Privacy/tenant/capability/health/capacity policy, target explanations, no-target and bounded failover passed; real Cloud and multi-provider Production proof remain absent. |
| Model routing | Previous: FOUNDATION | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 32 target capability and quality policy | Model-class matching and reviewed-quality sample gating are executable; representative multi-model quality evidence remains future work. |
| Edge/cloud allocation | Previous: FOUNDATION | New: PARTIAL | PUSH 32 execution classes | Real EDGE_LOCAL and isolated LOCAL_DEDICATED routing pass; Cloud classes are contracts only because no provider is configured. |
| Cost-aware optimization | Previous: NOT STARTED | New: FOUNDATION | PUSH 33 cost inputs and safety gate | Versioned rates, usage provenance and quality/privacy guard are executable; routing remains unchanged until approved cost and quality evidence exists. |
| Per-camera economics | Previous: NOT STARTED | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 33 attribution engine | Camera/Site/tenant attribution, shared-cost allocation and empty-slot exclusion pass; real provider reconciliation and sustained duration are absent. |
| Scale economics | Previous: NOT STARTED | New: FOUNDATION | PUSH 33 labeled projections | 10/100/1,000 resource projections are reproducible and explicitly assumption-bound; no scaled real cohort or reconciled monetary evidence exists. |
| Customer-hosted recording access | Previous: NOT STARTED | New: FOUNDATION | PUSH 34 source-recording reference | Added tenant/Site/source/time/retrieval-bound references without credentials or copying source media; real DVR/NVR/VMS retrieval remains unimplemented. |
| Retention | Previous: PARTIAL | New: IMPLEMENTED — NEEDS REAL PROOF | PUSH 34 portable retention executor | Backend-independent eligibility, legal hold, delete-before-tombstone, retry and two-backend QA pass; approved legal periods and Production deletion proof remain. |

## CAMERA PLATFORM

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Universal Camera Platform | FOUNDATION | Canonical source, adapter, registry and orchestrator contracts | 14, 17 | Expand verified vendor and deployment coverage | Real mixed-vendor pilots without architecture changes |
| Zero-Install connection | FOUNDATION | Resolver and wizard rank secure persistent zero-install first | 17 | Implement and validate vendor/direct integrations | Real camera persists without phone, Connector or DO hardware |
| Mobile-assisted onboarding | FOUNDATION | Mobile discovery and cross-device contracts | 17, 44 | Native implementation and OS validation | Signed iOS/Android real-device onboarding proof |
| Software Connector exception | DONE + REAL PROOF | Real Tapo C211, frames, AI, Event and Product UI | 16, 17 | Distribution signing and broader host coverage | Existing proof plus signed installer matrix |
| Physical Gateway last resort | DONE + REAL PROOF | Real home DVR with ten populated channels | 17, 18 | Preserve resolver policy across future routes | Real policy-selection test and continuing DVR proof |
| Mixed vendors in one Site | DONE + REAL PROOF | One Home contains DVR cameras and Tapo | 16, 17 | Add further vendor combinations | Real mixed-site inventory and isolation proof |
| DVR/NVR/VMS integrations | PARTIAL | Real DVR through Physical Gateway | 14, 17, 42, 47 | Add NVR/VMS connectors and partner contracts | Independent customer VMS/NVR pilot |
| Vendor Cloud/API integrations | EXTERNAL COVERAGE GAP | Registry can describe cloud/account paths | 17, 42 | Vendor authorization and adapters | Supported vendor account link on real hardware |
| Live View | DONE + REAL PROOF | Real DVR and Tapo moved in authorized Product player | 7, 14, 18 | Keep playback regression in release gates | Fresh moving Product video for every supported path |
| Recordings/playback | IMPLEMENTED — NEEDS REAL PROOF | Private evidence playback and live HLS contracts | 7, 34 | Broader recording-provider and retention coverage | Real retained recording playback across supported storage |
| Evidence | DONE + REAL PROOF | Real bounded private evidence and authorized playback | 7 | Extend providers and deletion evidence | Real event-to-evidence integrity and policy proof |
| Camera Health | IMPLEMENTED — NEEDS REAL PROOF | PUSH 23 canonical source/frame/relay/playback/AI/component/auth/cloud/recording model, tenant-scoped API, customer UI and deterministic fault matrix | 23, 27 | Controlled real source/playback/AI/common-cause fault proof and long-duration qualification | Fault injection on real cameras with truthful recovery |
| Universal Camera Controls | FOUNDATION | Capability and command allow-list foundations | 14, 22, 39 | Vendor-agnostic control execution and policy | Real authorized controls across two vendors |
| PTZ | FOUNDATION | Capability representation only | 14, 22, 39 | Implement supported adapter controls | Real pan, tilt and stop with authorization/audit |
| Zoom | FOUNDATION | Capability representation only | 14, 22, 39 | Implement optical/digital capability mapping | Real supported zoom action and fallback proof |
| Presets | NOT STARTED | No real preset execution proof | 22, 39 | Preset discovery, validation and execution | Real preset recall with tenant/action policy |
| Speaker | NOT STARTED | No real two-way audio proof | 22, 39 | Audio capability, consent and transport | Authorized real-device audio proof |
| Siren | NOT STARTED | No real siren action proof | 39, 45 | Safety policy, consent and adapter | Real bounded action with audit and cancellation |
| Spotlight/light | NOT STARTED | No real light action proof | 39 | Capability mapping and adapter execution | Real bounded action with failure recovery |
| Vendor-agnostic action capability mapping | FOUNDATION | Registry and strategy capability model | 14, 17, 39 | Add action schema and vendor implementations | Conformance tests plus two real vendors |

## OBSERVER INTELLIGENCE

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Broad perception | PARTIAL | Real person pipeline and canonical Event domains | 3, 4, 28, 32 | Expand representative object/event classes | Versioned real benchmark across approved classes |
| Person detection | DONE + REAL PROOF | Real physical person processed by ONNX | 3, 4 | Ongoing benchmark and drift gates | Reproducible real dataset precision/recall |
| Vehicle detection | IMPLEMENTED — NEEDS REAL PROOF | Detector/event schema support exists | 4, 28 | Representative real vehicle validation | Fresh real-camera vehicle benchmark |
| Smoke/fire detection | FOUNDATION | Event taxonomy supports safety classes | 4, 28, 39 | Approved models, datasets and escalation policy | Realistic controlled benchmark and safety review |
| Intrusion detection | IMPLEMENTED — NEEDS REAL PROOF | Zones, crossings, incidents and rules exist | 5, 6, 12 | External-site scenario evidence | Real zone intrusion end-to-end proof |
| Violence/fight/distress | NOT STARTED | No supported quality claim | 28, 32, 39, 45 | Define lawful scope, models and human verification | Approved benchmark and human-gated pilot |
| Object/event detection | PARTIAL | Canonical Event pipeline and bounded detections | 3, 4, 28 | Broader classes and quality evidence | Representative labeled real data |
| Tracking | DONE + REAL PROOF | Real Track ID, entry/exit and dedupe proof | 5 | Broader conditions and occlusion QA | Real multi-condition tracking benchmark |
| Multi-Camera Tracking | NOT STARTED | Single-camera tracking only | 28, 31, 32, 48 | Cross-stream association architecture and quality | Real multi-camera sequence with measured errors |
| Cross-Camera Correlation | FOUNDATION | Incident correlation model exists | 6, 31, 32, 48 | Spatial/temporal cross-camera identity logic | Real site timeline across multiple cameras |
| Identity Continuity | NOT STARTED | No production biometric/ReID claim | 10, 28, 32, 45, 48 | Policy-approved ReID and uncertainty handling | Legal approval plus real benchmark |
| Scene/Space Understanding | FOUNDATION | Zones, Site, camera and context models | 5, 8, 28 | Semantic spatial model and evidence | Real site map and grounded scene queries |
| Room/area understanding | FOUNDATION | Site and zone context exists | 5, 8 | Add area relationships and validation | Real-site semantic topology proof |
| Semantic camera naming suggestions | FOUNDATION | Friendly-name onboarding and registry metadata | 15, 17, 28 | Suggestion model and confirmation UX | Real onboarding usability proof |
| Zones | DONE + REAL PROOF | Real zone/line crossing and safe normalization | 5 | Multi-layout QA | Real entry/exit regression across layouts |
| Site topology | FOUNDATION | Tenant, Site, camera and zone relationships | 5, 8, 17, 41 | Spatial graph and enterprise hierarchy | Real multi-site topology and access proof |
| Context/Baseline | DONE + REAL PROOF | Real-only baseline input and maturity state | 8 | Longer external-site learning | Real pilot stability and drift proof |
| Site learning | PARTIAL | Site/camera baseline aggregation exists | 8, 11, 28, 46 | External cohort and seasonality | Long-running real-site evaluation |
| User-specific learning | FOUNDATION | Feedback and reviewed ground truth are scoped | 11, 25, 45 | Consent, controls and personalization proof | User-controlled pilot with deletion/export |
| Global Observer Intelligence | FOUNDATION | Sanitized calibration architecture | 11, 28, 32, 45 | Privacy-preserving aggregation and quality gates | Independent privacy review and multi-tenant benchmark |
| Connection Intelligence | IMPLEMENTED — NEEDS REAL PROOF | Registry, observations, maturity and safety gates | 17, 23, 27, 38 | More vendor/stability samples | Multi-vendor real outcomes with no sensitive data |

## DECISION / AUTONOMY

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Events | DONE + REAL PROOF | REAL_CAMERA_AI Event reached Production UI | 3, 4 | Broader classes and scale | Fresh real events under load |
| Incidents | DONE + REAL PROOF | Real event correlation and lifecycle | 6 | External scenarios and scale | Real multi-event incident pilot |
| Risk | DONE + REAL PROOF | Deterministic explainable evaluation | 9 | Calibration with reviewed outcomes | Real calibrated cohort evidence |
| Verification | DONE + REAL PROOF | Independent verification state in decision flow | 10 | More signals and time-to-verification data | Real representative false-alarm reduction |
| Decision | DONE + REAL PROOF | Canonical auditable decision persisted | 9, 10 | Action policies and external outcomes | Real decision-to-action pilot |
| Predictive risk | FOUNDATION | Baseline and risk primitives exist | 8, 9, 28, 32 | Prospective models and guardrails | Time-separated validated real dataset |
| Recommended actions | FOUNDATION | Decision/rule output can represent guidance | 9, 12, 39 | Action catalog and policy | Real operator acceptance/effectiveness proof |
| Autonomous camera actions | NOT STARTED | No autonomous physical action claim | 22, 39, 45 | Authorization, safeguards and adapters | Real reversible action with audit and fail-safe |
| Escalation | FOUNDATION | Decision and provider boundaries exist | 10, 39 | Production provider workflows | Real acknowledged escalation pilot |
| Emergency workflows | NOT STARTED | No production emergency integration | 39, 44, 45, 46 | Legal, provider and human-response design | Approved real drill with failure handling |
| Human verification boundaries | PARTIAL | Feedback/review and verification separation | 10, 11, 39, 45 | Define mandatory human gates by action | Policy audit plus real workflow proof |
| Action authorization/policy | FOUNDATION | RBAC and command allow-list controls | 18, 25, 39, 41 | Fine-grained action policy engine | Cross-role negative tests and real action audit |

## NATURAL LANGUAGE

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Watch Rule Compiler | DONE + REAL PROOF | Hebrew intent compiled, confirmed and matched real Event | 12 | Expand language and ambiguity evidence | Real tenant-safe rule suite |
| Personalized monitoring instructions | FOUNDATION | Structured rules and scoped feedback | 12, 39, 45 | Preference model and consent | Real user-controlled longitudinal pilot |
| Investigation | DONE + REAL PROOF | Tenant-safe real Event/Incident/Evidence search | 13 | Broader enterprise data and latency | External user investigation benchmark |
| Conversational control | FOUNDATION | NL compiler/search boundaries exist | 12, 13, 39, 42 | Session, authorization and confirmation UX | Real bounded conversation with negative tests |
| Natural-language camera/action commands | NOT STARTED | No physical command execution proof | 12, 22, 39 | Intent-to-policy/action pipeline | Authorized real-device command with confirmation/audit |

## IDENTITY / BIOMETRICS

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Known People | FOUNDATION | Privacy boundary and unsupported-query refusal | 10, 13, 25, 45 | Consent, lifecycle and quality implementation | Legal approval plus real consented pilot |
| Face Recognition | NOT STARTED | Explicitly not claimed | 28, 32, 45, 48 | Jurisdiction policy, model and consent | Approved legal scope and representative benchmark |
| Biometric matching | NOT STARTED | No production biometric matcher | 28, 32, 45, 48 | Template security and quality | Independent biometric/privacy assessment |
| Identity Continuity for biometrics | NOT STARTED | No production identity continuity | 10, 28, 32, 45, 48 | Uncertainty and cross-camera ReID | Consented real multi-camera benchmark |
| Unknown-person handling | FOUNDATION | Events can remain unidentified; unsupported identity refused | 10, 13, 45 | Policy and UX | Real non-identification and escalation proof |
| Watchlists | NOT STARTED | No lawful production watchlist | 39, 41, 45, 48 | Governance, audit and matching | Jurisdiction-approved pilot |
| LPR/vehicle identity | NOT STARTED | No verified plate recognition | 28, 32, 45, 48 | Model, jurisdiction and retention | Real approved plate benchmark |
| Consent/policy/jurisdiction controls | PARTIAL | Privacy, retention and RBAC controls documented | 25, 41, 45 | Formal legal decisions and enforcement | External legal review plus negative tests |

## GUARDIAN / PERSONAL SAFETY

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Personal/Mobile Observer | FOUNDATION | Mobile and notification architecture | 39, 44, 46 | Native sensors, background and pilot | Signed real-device home pilot |
| Child safety | FOUNDATION | Restrictive privacy mode boundaries | 25, 39, 44, 45, 46 | Legal/guardian policy and scenarios | Consented family pilot and safety review |
| Guardian mode | NOT STARTED | No complete guardian workflow | 39, 44, 45, 46 | Product state and escalation | Real controlled end-to-end drill |
| Safe Journey | NOT STARTED | No journey state machine | 39, 44, 45, 46 | Location, check-in and privacy design | Real journey test with recovery |
| SOS | NOT STARTED | No production SOS | 39, 44, 45, 46 | Mobile trigger and response integration | Real drill and provider acknowledgement |
| Silent SOS | NOT STARTED | No production silent SOS | 39, 44, 45, 46 | Covert UX, abuse safeguards and response | Approved real-device drill |
| Safety check-ins | NOT STARTED | No check-in workflow | 39, 44, 46 | Scheduling and escalation | Real missed-check-in drill |
| Safety Circle | NOT STARTED | No trusted-contact graph | 39, 44, 45, 46 | Consent, invitations and revocation | Multi-user privacy/notification test |
| Location/context signals | FOUNDATION | Context model and future mobile hooks | 8, 32, 44, 45 | Mobile permissions and fusion | Real-device privacy-controlled evidence |
| Phone + camera sensor fusion | NOT STARTED | No fused inference proof | 32, 44, 46 | Time alignment and uncertainty | Real synchronized scenario benchmark |
| Missing Person Response | NOT STARTED | No response workflow | 39, 44, 45, 48 | Legal policy, search and escalation | Authorized controlled exercise |
| Last Known State | FOUNDATION | Incident timelines and evidence references | 6, 13, 44, 48 | Identity/location linkage | Authorized real scenario proof |
| Visual location without child phone | NOT STARTED | No identity/search implementation | 13, 28, 32, 45, 48 | Consent, ReID and strict policy | Legally approved real multi-camera exercise |
| Cross-camera missing-person search | NOT STARTED | No cross-camera identity search | 13, 28, 32, 45, 48 | ReID/search and human verification | Approved real benchmark |
| Guardian escalation workflows | NOT STARTED | Provider escalation not active | 39, 44, 45, 46 | Safe contacts/providers and dedupe | Real drill with recovery and audit |

## ENTERPRISE INVESTIGATION & INTELLIGENCE

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Existing VMS/NVR/camera estate integration | PARTIAL | Real DVR retained and integrated | 14, 17, 34, 42, 47 | VMS APIs and recording access | External enterprise integration pilot |
| Integration without replacing VMS | FOUNDATION | Intelligence-layer architecture preserves current DVR | 34, 42, 43, 47 | Deep links, APIs and customer-hosted access | Customer VMS remains primary viewer in real pilot |
| Enterprise Edge | FOUNDATION | Shared edge profile contract | 17, 18, 22, 35, 41 | Packaging, policy and scale | Customer-hosted real deployment |
| Customer-hosted video access | FOUNDATION | Source/storage abstraction direction | 34, 35, 42, 47 | Connectors and policy | Real customer-hosted stream authorization proof |
| Customer-hosted recording access | FOUNDATION | `observer-source-recording-reference-v1` safely binds customer-owned archive media without credentials or forced copying | 34, 42, 47 | Implement authorized DVR/NVR/VMS retrieval adapters and retention mapping | Real customer-hosted recording retrieval |
| Metadata-first processing | PARTIAL | PUSH 29 vendor-agnostic candidate contract and real local-frame-difference path; native DVR/Tapo metadata unverified | 29, 31, 32, 47 | Verified native vendor/VMS adapters and representative quality QA | Real reduced-video workload with quality proof |
| Federated investigation | NOT STARTED | Investigation is current-platform scoped | 13, 32, 42, 48 | Federated query and authorization | Cross-system external pilot |
| Image upload search | NOT STARTED | No production image-reference search | 13, 28, 32, 42, 45 | Privacy and matching pipeline | Authorized real benchmark |
| Video-reference search | NOT STARTED | No production video-reference search | 13, 28, 31, 32, 42 | Feature extraction and policy | Authorized real benchmark |
| Person search | FOUNDATION | NL investigation exists; identity is refused | 13, 28, 32, 45, 48 | Lawful appearance/ReID search | Approved representative pilot |
| Vehicle search | FOUNDATION | Event investigation primitives exist | 13, 28, 32, 48 | Vehicle attributes and quality | Real multi-camera vehicle search |
| Object search | FOUNDATION | Event/evidence investigation primitives | 13, 28, 32, 48 | Object embeddings/taxonomy | Real labeled search benchmark |
| Appearance/ReID | NOT STARTED | No production ReID claim | 28, 32, 45, 48 | Model, policy and benchmark | Consented independent evaluation |
| Cross-camera investigation | FOUNDATION | Incident/evidence timeline primitives | 6, 13, 32, 48 | Cross-camera correlation and UI | Real multi-camera case reconstruction |
| Timeline reconstruction | PARTIAL | Incident timeline and grounded evidence search | 6, 13, 48 | Cross-system/camera ordering | External operator case proof |
| Historical investigation | IMPLEMENTED — NEEDS REAL PROOF | Search over retained Events/Incidents/Evidence | 13, 34, 42, 48 | Scale, retention and enterprise UX | Large retained dataset investigation |
| Current/live investigation | FOUNDATION | Recent event search and live view exist | 13, 18, 27, 42, 48 | Live query subscription and scale | Real ongoing incident operator test |
| Continuous Watch | FOUNDATION | Watch rules exist | 12, 39, 48 | Persistent cross-camera targets and alerts | Real long-running watch pilot |
| Watch Targets | FOUNDATION | Rule model can target scoped resources | 12, 39, 45, 48 | Identity/vehicle/object target governance | Authorized real target workflow |
| Alert when person/vehicle appears | NOT STARTED | No lawful identity/vehicle watch proof | 12, 28, 39, 45, 48 | Matching, consent and escalation | Approved real alert proof |
| Behavioral Watch Targets | FOUNDATION | Rules, context and risk primitives | 8, 9, 12, 28, 48 | Behavior models and quality | Real representative behavior pilot |
| Investigation Reports | FOUNDATION | Grounded result and evidence references | 13, 42, 48, 50 | Export, provenance and review | External operator-generated report |
| Evidence references | DONE + REAL PROOF | Signed private evidence links in Product | 7, 13, 42 | External API references | Independent API consumer proof |
| Confidence/explanation | DONE + REAL PROOF | Detection, risk and verification remain distinct/explained | 9, 10, 13 | Broader model calibration | External user comprehension and calibration test |
| Quantitative analysis | FOUNDATION | Observability/calibration aggregates | 27, 28, 49 | Product-safe analytical queries | Auditable real cohort analysis |
| Big-Data analysis | NOT STARTED | No warehouse-scale proof | 31, 36, 38, 48, 49 | Scalable analytical architecture | Real large-volume performance and correctness test |
| Trends | FOUNDATION | Bounded observability trends | 27, 28, 49 | Product analytics separation and cohorts | Real longitudinal tenant-safe dashboard |
| Risk concentrations | FOUNDATION | Risk bands and aggregates exist | 9, 27, 28, 49 | Spatial/temporal concentration analysis | Real cohort with statistical bounds |
| Recommendations | FOUNDATION | Explainable decision primitives | 9, 28, 39, 49 | Evidence-based recommendation policy | Measured operator/customer usefulness |
| Customer-data-derived operational recommendations | NOT STARTED | No validated recommendation engine | 28, 45, 47, 49 | Privacy, causality and feedback | External customer validation without leakage |

## ENTERPRISE INTEGRATION OUTPUT

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| API | FOUNDATION | Internal tenant-scoped APIs exist | 42 | Public versioning, auth, limits and docs | Independent consumer conformance proof |
| SDK | NOT STARTED | No public supported SDK | 43 | Package, examples and support contract | Independent integration from docs |
| Webhooks | FOUNDATION | Signed provider/webhook boundaries | 25, 39, 42 | Public delivery, replay and lifecycle | External receiver retry/idempotency proof |
| Event callbacks | FOUNDATION | Outbox and provider primitives | 4, 39, 42 | Public callback contract | Real external consumer delivery proof |
| Investigation API | NOT STARTED | Product investigation API is not public platform | 13, 42 | Scoped public contract | Independent consumer query proof |
| Watch API | NOT STARTED | Product watch rules are not public platform | 12, 42 | Scoped public rule lifecycle | Independent consumer conformance proof |
| Result delivery | FOUNDATION | Notifications/outbox architecture | 39, 42 | Public delivery providers and audit | External end-to-end receipt proof |
| Evidence references for integrations | FOUNDATION | Authorized evidence references exist internally | 7, 42 | External scoped reference lifecycle | Independent consumer opens authorized evidence |
| Deep-link/open-camera in customer VMS | NOT STARTED | No customer VMS deep-link proof | 42, 43, 47 | Vendor-specific deep-link mapping | Real VMS integration proof |
| Embedded Intelligence | FOUNDATION | Observer Core/domain separation exists | 31, 32, 43 | Supported embedding contract | External-host sample app |
| OEM | NOT STARTED | No external OEM proof | 43, 50, 51 | Packaging, contracts and support | Signed partner integration |
| White-label | NOT STARTED | No white-label deployment proof | 43, 50, 51 | Branding/isolation/upgrade contract | External branded deployment |
| Service accounts | FOUNDATION | Device principals exist; enterprise accounts do not | 18, 41, 42 | Scoped enterprise machine identities | Cross-tenant negative and rotation tests |
| Enterprise auth | FOUNDATION | Current RBAC/tenant controls | 25, 41 | SSO, SCIM/session policy | External organization SSO proof |
| Enterprise audit | PARTIAL | Security-sensitive audit coverage exists | 25, 41, 42, 45 | Complete enterprise action/export audit | Independent audit trace exercise |

## SCALE

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Home | DONE + REAL PROOF | One real home with 11 physical cameras | 16, 17, 18, 46 | External non-team pilot | Sustained consented external home proof |
| SMB | FOUNDATION | Site/tenant/product architecture | 41, 47 | Real business workflows | External business pilot |
| Multi-site business | FOUNDATION | Tenant/Site schema and RBAC | 41, 47 | Multi-site policy and operations | Real multi-site customer proof |
| Mall | NOT STARTED | No mall-scale deployment | 36, 37, 38, 48 | Scale/operator workflows | Real or representative 100+ camera proof |
| Campus | NOT STARTED | No campus deployment | 36, 37, 38, 48 | Distributed topology and policy | Representative campus-scale pilot |
| Hospital/industrial | NOT STARTED | No regulated industrial pilot | 37, 38, 45, 48 | Domain safety/compliance | Approved sector pilot |
| Large security operation | NOT STARTED | No monitoring-center proof | 36, 37, 38, 48 | Operator load and escalation | Real monitoring-center pilot |
| City-scale architecture | FOUNDATION | Horizontal/distributed roadmap ownership | 31, 35, 36, 37, 38 | Architecture, privacy and scale proof | Staged city-scale benchmark and governance |
| Thousands of streams | NOT STARTED | No thousand-stream test | 31, 36, 37, 38 | Queue, workers, storage and cost | Measured 1,000-stream qualification |
| Distributed processing | FOUNDATION | Edge/cloud and worker contracts | 31, 32, 35, 36 | Portable production implementation | Two-environment failover/load proof |
| Enterprise Edge scale | FOUNDATION | Shared edge profile contract | 17, 18, 22, 35, 48 | Production packaging and fleet | Multi-edge enterprise pilot |
| Queues | IMPLEMENTED — NEEDS REAL PROOF | PUSH 31 durable WAL jobs, lease recovery, priority/fairness/backpressure and dead-letter QA | 31, 36, 38 | Multi-node deployment and sustained load | Real horizontal worker-loss and tenant-fairness proof |
| Load balancing | NOT STARTED | No horizontal production proof | 36, 37 | Implement routing and balancing | Measured scale/failover test |
| Failover | NOT STARTED | No full multi-zone/provider proof | 37 | Implement HA ownership and recovery | RTO/RPO fault injection |
| Fleet management | IMPLEMENTED — NEEDS REAL PROOF | Canonical inventory/API/UI, bounded commands and 10,000-component synthetic QA | 22 | Real multi-tenant/multi-site operational deployment | Real multi-device fleet proof |

## RELIABILITY

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| OTA | DONE + REAL PROOF | Shared Ed25519-signed manifest, verified artifact, atomic isolated update on Connector and Gateway profiles | 19 | Production key custody and staged customer rollout operations | Signed isolated update plus future bounded real canary evidence |
| Rollback | DONE + REAL PROOF | Controlled bad 1.2.0 release automatically restored healthy known-good 1.1.0 and quarantined failure | 19 | Continue platform/customer canary evidence | Induced bad update automatically recovers identity/config/health |
| Watchdog | IMPLEMENTED — NEEDS REAL PROOF | PUSH 20 shared progress-aware supervisor, bounded backoff and isolated process/stream fault matrix | 20, 38 | Long-duration real fault qualification | Real fault recovery within target |
| Self-healing | IMPLEMENTED — NEEDS REAL PROOF | PUSH 20 bounded recovery ladder, audit, duplicate safety and isolated fault matrix | 20, 38 | Long-duration real recovery qualification | Real fault matrix plus agreed soak |
| DVR session recovery | IMPLEMENTED — NEEDS REAL PROOF | PUSH 18B recovered current Gateway | 20, 23, 38 | Automated repeatable qualification | Induced session failure and recovery |
| Relay recovery | IMPLEMENTED — NEEDS REAL PROOF | PUSH 20 bounded relay replacement/backoff and isolated relay-kill recovery QA | 20, 23, 38 | Controlled real fault qualification | Real relay-loss recovery proof |
| Stale-frame detection | IMPLEMENTED — NEEDS REAL PROOF | PUSH 20 detects non-progress despite live process and recovers in isolated QA | 20, 23, 27, 38 | Product SLO and controlled real frozen-stream proof | Frozen-stream fault test |
| Offline buffering | IMPLEMENTED — NEEDS REAL PROOF | PUSH 21 encrypted SQLite/WAL queue survives restart and retains Events, evidence/media work and operational state in isolated outage QA | 21, 38 | Natural real-camera outage Event and longer disk/retention qualification | Real offline interval proof |
| Resync | IMPLEMENTED — NEEDS REAL PROOF | PUSH 21 bounded per-ordering-key resync, ACK retry, idempotency, tenant/rebind/revocation and backfill-safety QA | 21, 38 | Natural real-camera Event/UI resync proof | Disconnect/reconnect no-duplicate proof |
| Camera Health reliability | PARTIAL | Source/processing/playback dimensions now distinct | 23, 27 | Full engine and alert SLO | Real disconnect/freeze/recovery proof |
| Component health | IMPLEMENTED — NEEDS REAL PROOF | Observability model and current edge health | 22, 23, 27 | Fleet coverage and alerting | Multi-component fault exercise |
| 24/7 stability | NOT STARTED | No qualifying long-duration run | 38 | Soak plan and execution | Agreed-duration real soak |
| Real fault injection | NOT STARTED | No canonical fault campaign | 20, 21, 37, 38 | Build safe fault harness | Published recovery results |
| Long-duration stability tests | NOT STARTED | No canonical long soak | 38 | Execute staged soak | Sustained SLO evidence |

## AI INFRASTRUCTURE / ECONOMICS

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Preprocessing | IMPLEMENTED — NEEDS REAL PROOF | PUSH 29 local frame difference precedes ONNX; candidate-only native contract, dedupe/coalescing, safe fallback and 11/22 real-input jobs avoided | 29 | Representative FN Ground Truth and verified native vendor adapters | Real quality-preserving workload reduction |
| Sampling | IMPLEMENTED — NEEDS REAL PROOF | PUSH 30 canonical purpose/priority scheduler, explainable decisions, never-blind floor, fairness and bounded 11-camera real-input comparison | 29, 30 | Representative FN Ground Truth, long-duration and multi-Site evaluation | Recall/latency comparison on representative real data |
| AI job queue | IMPLEMENTED — NEEDS REAL PROOF | PUSH 31 canonical job/result/worker contracts, restart durability, worker-loss recovery, idempotency, priority/fairness/backpressure and real Tapo sample | 31 | Production multi-worker operation and representative load | Real deployed worker-loss/backpressure proof |
| Hybrid routing | IMPLEMENTED — NEEDS REAL PROOF | PUSH 32 eligibility-first router, policy audit, bounded failover and real EDGE_LOCAL camera job | 32 | Authorized Cloud adapter and real multi-provider operation | Real failover with provenance across deployed providers |
| Model routing | IMPLEMENTED — NEEDS REAL PROOF | PUSH 32 capability/model matching plus measured-quality sample gate | 32 | Representative multi-model quality evidence | Measured route selection proof |
| Cost-aware optimization | FOUNDATION | PUSH 33 normalized usage/rates, execution provenance and fail-closed quality/privacy cost guard; PUSH 32 routing remains unchanged | 33 | Approved reconciled rates and controlled routing experiment | Quality-constrained real savings proof |
| Edge/cloud allocation | PARTIAL | PUSH 32 real EDGE_LOCAL plus isolated LOCAL_DEDICATED routing; Cloud target classes remain unconfigured | 17, 31, 32 | Authorized Cloud provider and real workload split | Real workload split proof |
| Per-camera economics | IMPLEMENTED — NEEDS REAL PROOF | PUSH 33 AI job/target/camera/Site/tenant attribution, explicit confidence and 11-camera empty-slot-safe allocation QA | 33, 49 | Authorized provider rates, sustained duration and bill reconciliation | Provider-bill reconciliation |
| Scale economics | FOUNDATION | PUSH 33 assumption-labeled 10/100/1,000-camera resource projections from bounded real workload; no monetary extrapolation | 33, 38, 49 | Pilot/scale cost data | Sustained auditable cohort economics |

## QUALITY

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Feedback | DONE + REAL PROOF | Authorized user feedback path | 11 | External review coverage | Real pilot feedback cohort |
| Reviewed Ground Truth | DONE + REAL PROOF | Review lifecycle and calibration sample | 11 | Representative volume | Blinded reviewed dataset |
| Calibration | IMPLEMENTED — NEEDS REAL PROOF | Human-gated calibration metrics | 11, 28 | Statistical sample size and drift | Reproducible real calibration report |
| Precision | IMPLEMENTED — NEEDS REAL PROOF | Reproducible PUSH 28 metric with denominator/Wilson interval; first reviewed real result is 1/1 only | 28, 49 | Representative labels | Confidence-bounded benchmark |
| Recall | IMPLEMENTED — NEEDS REAL PROOF | FN opportunity contract and truthful `NOT MEASURABLE` result | 28, 49 | Representative missed-event labels | Confidence-bounded benchmark |
| False-positive rate | IMPLEMENTED — NEEDS REAL PROOF | Categorized FP metric with dataset/model scope | 11, 28, 49 | Sufficient reviewed sample | Cohort rate with denominator and interval |
| False-negative analysis | FOUNDATION | Expected-but-missing records are representable; no systematic missed-event capture yet | 28, 46, 47, 49 | Sampling/review design | Representative blind-review study |
| Latency quality | PARTIAL | Event/decision/playback timestamps and telemetry | 27, 28, 38, 49 | End-to-end real cohorts | Percentile latency under target load |
| Confidence calibration | IMPLEMENTED — NEEDS REAL PROOF | Confidence bins/ECE, sample gate and semantic separation implemented | 9, 10, 11, 28 | Representative reliability diagrams and cohorts | Versioned representative calibration |
| Real pilot datasets | NOT STARTED | Current home is reference, not external pilot dataset | 28, 46, 47, 48 | Consent and data collection | Approved versioned pilot datasets |
| No misleading metrics | IMPLEMENTED — NEEDS REAL PROOF | Sample-size/status rules in quality and telemetry docs | 11, 27, 28, 49 | Independent reporting audit | Published metrics trace to denominators/evidence |

## SECURITY / PRIVACY / DD

| Capability | Current Status | Existing Proof | Owning Canonical PUSH | Remaining Work | Final Proof Required |
|---|---|---|---|---|---|
| Tenant isolation | IMPLEMENTED — NEEDS REAL PROOF | RLS/API negative suites and scoped playback | 25, 41 | Independent external penetration test | Two-tenant independent authorization assessment |
| Managed-device identity | IMPLEMENTED — NEEDS REAL PROOF | Ed25519 isolated lifecycle; live devices remain legacy | 18 | Controlled live migration | Real Connector/Gateway hardened credential proof |
| Zero-install security | FOUNDATION | Deterministic hard gates and no public RTSP | 17, 25, 42 | Real vendor integrations | Security review of real direct/account path |
| Biometrics governance | PARTIAL | Restrictive privacy boundary and non-claim | 25, 45 | Formal jurisdiction/consent program | External legal/privacy approval |
| Encryption | IMPLEMENTED — NEEDS REAL PROOF | Dedicated field key and encrypted credential path | 2, 25 | Rotation exercise and independent review | Production-like rotation/recovery proof |
| Audit | PARTIAL | Security-sensitive audit coverage | 18, 25, 41, 42, 45 | Complete enterprise/action/export coverage | Independent traceability exercise |
| Retention | IMPLEMENTED — NEEDS REAL PROOF | PUSH 34 provider-independent retention, legal hold, delete-before-tombstone and backend-failure retry QA | 7, 25, 34, 45 | Approved legal periods, all-domain enforcement and Production deletion evidence | Policy-approved real deletion/retention test |
| Evidence authorization | DONE + REAL PROOF | Real private signed playback with tenant scope | 7, 25 | External API consumer coverage | Wrong-tenant/expired/deleted real-object proof |
| Enterprise access control | FOUNDATION | Tenant RBAC baseline | 25, 41 | SSO, service accounts and multi-site roles | External enterprise negative test |
| Privacy | PARTIAL | Sensitive-data register and minimization controls | 25, 45 | Formal notices, consent, deletion/export | External privacy/legal review |
| Compliance readiness | FOUNDATION | Control matrices and roadmap ownership | 25, 45, 50 | Jurisdictional decisions and evidence | Independent compliance readiness review |
| Dependency/license inventory | PARTIAL | Dependency/security scans and CI foundations | 24, 25, 50 | SBOM, licenses and remediation evidence | Reproducible clean inventory review |
| Acquisition-grade documentation | FOUNDATION | Canonical reports, matrices and runbooks | 50 | Reconcile all final evidence | Independent DD reader can reproduce claims |
| IP/ownership | NOT STARTED | No complete chain-of-title proof | 50, 51, 52 | Contributor/vendor/license ownership file | Legal DD sign-off |
| Clean release process | IMPLEMENTED — NEEDS REAL PROOF | Canonical release preflight and scoped commits | 24, 25, 50 | Sustained release history and rollback evidence | Independent clean release/rollback exercise |

## CURRENT COMPLETION COUNTS

The counts below are generated from the rows above during closure QA. They describe evidence state, not roadmap progress or a percentage-complete claim.

| Status | Count |
|---|---:|
| `DONE + REAL PROOF` | 24 |
| `IMPLEMENTED — NEEDS REAL PROOF` | 33 |
| `FOUNDATION` | 64 |
| `PARTIAL` | 17 |
| `NOT STARTED` | 51 |
| `EXTERNAL COVERAGE GAP` | 1 |
| **TOTAL** | **190** |

Canonical owner coverage: **190/190**; capabilities without an owning canonical PUSH: **0**.
