# Coverage Matrix — Digital Observer — 29.10.2026

זוהי תמונת הכיסוי מחלון האבחון הראשוני. תיקון תעודות והרשאת HOME_QA שאושר לאחר מכן מתועד ב־[RECOVERY_RESULT_HE.md](RECOVERY_RESULT_HE.md); הוא אינו מקדם את יכולות North-Star להוכחה מלאה או משחזר כשלעצמו צפייה ב־Production.

בדיקה מול החזון הקנוני: 197/197 יכולות ו־52/52 פושים. זו התאמה למסמכים ולמקורות קוד, ולא הצהרת מוצר שלם או אימות מחודש של כל בדיקה היסטורית. לא נקרא מחדש כל תוכן שיחות האפיון; 129 פריטי המקור והחומרים שאינם נגישים לא הוכחו כאן. מפת הבעלות אינה הוכחת מימוש בפני עצמה.

מקורות נעולים ו־Git blobs: [canonical-sources.json](canonical-sources.json). פירוט מלא של קוד, מסד, API, UI, בדיקות, בעלים, תלות, מגבלות ודרישת השלמה לכל יכולת: [coverage-matrix.json](coverage-matrix.json).

VERIFIED = קיימת ראיה היסטורית מפורשת במקור הקנוני; אין פירושו PASS חי היום. PARTIAL = מימוש/בסיס/ראיה חלקית. PLANNED = לא התחיל אך מתוכנן. MISSING = אין מימוש/הוכחה מספקים לדרישה מסוימת. BLOCKED = חסם מפורש מונע אימות או הפעלה. סטטוס המקור נשמר לצד המיפוי; לא שינינו את החזון.

## תחומי החזון

| תחום | מצב | ראיה וגבול |
|---|---|---|
| ניתוח וידאו / זיהוי אובייקטים | PARTIAL | ONNX object_detection נטען בשני הרכיבים; אין הוכחת Event→AI→Product חדשה באירוע; North-Star OBSERVER INTELLIGENCE ו־PUSH 3–6,28–32 |
| ביומטריה וזיהוי פנים | MISSING | health חי: face_detection=false, face_recognition=false, biometric_matching=false, consent_verified=false. בחירת engine_mode אינה מימוש. DO-NS-191 מתוכנן; פירוט יתר יכולות הזהות למטה |
| מורשי כניסה / זהות / Watch | PARTIAL | חוזי אנשים, הרשאות וכללים קיימים; זיהוי ביומטרי ומניעת false match אינם מוכחים. PUSH 10,12,41,45,48; ראה שורות הזהות וה־Watch למטה |
| ביתי | BLOCKED | הפיילוט הנוכחי: UI ללא וידאו; HOME_QA TLS פג; אין Product playback חדש. PUSH46 פיילוט חיצוני טרם התחיל |
| עסקי / ארגוני | PARTIAL | RBAC, ארגונים ואתרים בפיתוח; אין פיילוט עסקי חיצוני/IdP אמיתי מוכחים. PUSH41,47 |
| Onboarding לכל סוגי המצלמות | PARTIAL | DVR ו־Tapo הוכחו בעבר; Zero-Install ו־universal coverage אינם מוכחים. ספקי ענן BLOCKED; NVR/VMS ויצרנים נוספים חלקיים. PUSH14–18,42,46–48 |
| חקירות וידאו ברמת ראיות | PARTIAL | חוזי Evidence, integrity, timeline, storage והרשאות קיימים; גישה להקלטות מקור DVR/NVR/VMS וחקירה חיצונית מלאה אינן מוכחות. PUSH7,34,42,45 |
| API / אינטגרציה לחברות | PARTIAL | חוזי API ושירותי מכונה ובדיקות consumer מקומיות; אין אינטגרציה חיה עצמאית/ספק/VMS מוכחת. PUSH41–42 |
| SDK / OEM / White-label | PARTIAL | SDK, embedded sessions, branding והיררכיית שותף בפיתוח; לקוח OEM אמיתי והסדר מסחרי אינם מוכחים. PUSH43; DO-NS-194–195 |
| אמינות 24/7 | BLOCKED | PUSH38 Development נסגר בחריגת בעלים, לא 24h PASS. rollback חי ל־101/40, TLS פג ו־DVR stalls בהווה |
| פרטיות / משפטי / retention | BLOCKED | PUSH45 פיתוח בלבד; אישורים חיצוניים ויישום אמיתי פתוחים. אין הפעלת ביומטריה מכוח מסמך זה |
| מובייל | PARTIAL | ראיות iPhone Development היסטוריות; remote camera/APNs/Android/store פתוחים. PUSH44 |
| כלכלה וצמיחה | PLANNED | אין reconciliation חשבוניות/משתמשים משלמים או פיילוטי 46–49; 51–52 שלב מאוחר. אין טענת עמידה בתקרת ₪15 |

## כל 52 הפושים

סטטוס PARTIAL בפוש עם DONE היסטורי משקף היעדר revalidation מלא והוכחת North-Star סופית; אינו מבטל את עבודת הפיתוח ההיסטורית. לכל שורה מקור מפורש ב־canonical-sources.json, נתיב DIGITAL_OBSERVER_CANONICAL_MASTER_ROADMAP.md.

| PUSH | כותרת | מצב בדוח | סטטוס קנוני | תלות | תנאי קבלה / פער ראיה |
|---:|---|---|---|---|---|
| 1 | Existing System Audit | PARTIAL | DONE | None | Complete repository/runtime matrix with evidence and no roadmap implementation. |
| 2 | Runtime and Baseline Closure | PARTIAL | DONE | PUSH 1 | Web, Gateway and DB baseline verified; critical security/runtime diagnostics pass or are explicitly external. |
| 3 | Real Camera and Real-Person E2E | PARTIAL | DONE | PUSH 2; authorized physical source | Fresh physical person produces a canonical real Event with source provenance; no mock/manual substitute. |
| 4 | Product Observer Real-AI Integration | PARTIAL | DONE | PUSH 3 | Production Product UI/API displays real provenance and excludes mock/shadow from real claims. |
| 5 | Real Tracking and Zones | PARTIAL | DONE | PUSH 4 | Fresh real entry and exit preserve one Track and produce exactly the allowed normalized events. |
| 6 | Unified Incident Architecture | PARTIAL | DONE | PUSH 5 | Real entry/exit form one idempotent Incident timeline and close automatically. |
| 7 | Evidence Production | PARTIAL | DONE | PUSH 6 | Fresh real eligible Event captures bounded clip, persists privately and plays through signed authorized access. |
| 8 | Context and Behavioral Baseline | PARTIAL | DONE | PUSH 7 | REAL_CAMERA_AI contributes; mock/shadow/manual inputs are excluded; maturity state is visible. |
| 9 | Explainable Risk and Decision | PARTIAL | DONE | PUSH 8 | Fresh real Incident automatically receives auditable Risk and Decision without threshold weakening. |
| 10 | Incident Verification and False-Alarm Reduction | PARTIAL | DONE | PUSH 9 | Real Incident runs through canonical Verification; detector confidence, risk and verification remain distinct. |
| 11 | Feedback, Ground Truth and Calibration | PARTIAL | DONE | PUSH 10 | Real feedback → reviewed ground truth → calibration sample/metric; no automatic model/risk mutation. |
| 12 | Natural-Language Watch Rule Compiler | PARTIAL | DONE | PUSH 11 | Confirmed NL rule matches a fresh real Event and influences Risk/Decision through canonical flow. |
| 13 | Natural-Language Investigation | PARTIAL | DONE | PUSH 12 | Bounded query returns tenant-safe real records and authorized evidence playback; unsupported identity refused. |
| 14 | Digital-First Universal Camera Layer | PARTIAL | DONE | PUSH 13 | Existing real source maps to canonical model and resolver selects the safest viable path with evidence. |
| 15 | Zero-Touch Camera Onboarding | PARTIAL | DONE | PUSH 14 | Existing/new systems can be assessed, recommended and activated only after verified readiness. |
| 16 | Software Observer Connector | PARTIAL | DONE | PUSH 15; independent physical source | Independent physical camera through separate SOFTWARE_CONNECTOR identity produces real frame, canonical Event, backend persistence and authorized UI evidence. |
| 17 | Universal Zero-Install Connectivity + Unified Connector/Gateway Provisioning | PARTIAL | DONE | PUSH 16 PASS | Both physical Gateway and Software Connector install from shared versioned package; provisioning/reprovisioning and customer self-service QA pass on supported hosts; expanded PUSH 17 acceptance applies. OTA/rollback remains PUSH 19. |
| 18 | Device Identity, Certificates and Rotation | PARTIAL | DONE | PUSH 17 | Ed25519 lifecycle, tenant/security negatives, live Physical Gateway recovery, 10/10 DVR + 1/1 Tapo progression, six empty-slot semantics, and authorized real Product Live View for both connection strategies pass; live legacy credential conversion remains controlled rollout work. |
| 19 | OTA Update and Atomic Rollback | PARTIAL | DONE | PUSH 17–18; connector/Gateway hardening | Shared Ed25519 release verification; isolated Connector/Gateway-profile updates; controlled bad release automatically restores known-good runtime while preserving identity/configuration; canary failure pauses propagation. |
| 20 | Watchdog and Self-Healing Runtime | PARTIAL | DONE | PUSH 17–19; connector/Gateway hardening | Shared progress-aware supervision, bounded recovery/backoff, crash-loop and empty-slot QA pass; real 10-DVR + Tapo observation remains truthful and long-duration soak stays PUSH 38. |
| 21 | Offline Buffering and Resynchronization | PARTIAL | DONE | PUSH 17–20; connector/Gateway hardening | Encrypted restart-safe store-and-forward, bounded authenticated resync, idempotency/order/backfill/media/disk/tenant/update QA pass; natural real Event outage proof remains explicitly pending. |
| 22 | Fleet Management and Remote Diagnostics | PARTIAL | DONE | PUSH 18–21; connector/Gateway hardening | Shared inventory/UI/API, scoped short-lived commands, support audit, common-cause health and 10,000-component synthetic QA pass; real multi-site fleet proof remains future evidence. |
| 23 | Camera Health Engine and SLOs | PARTIAL | DONE | PUSH 17,20–22; connector/Gateway hardening | Canonical dimensions, stale expiry, expected-camera SLO denominator, common-cause/flapping, API/UI and deterministic failure matrix pass; destructive real fault/soak remains PUSH 38. |
| 24 | Repository and CI Quality Gate | PARTIAL | DONE EARLY | None; frozen-area exclusion | Clean CI from fresh checkout runs required checks; zero unexplained failures; no frozen camera runtime changes. |
| 25 | Security, RLS and Privacy Hardening | PARTIAL | DONE EARLY | None; do not modify frozen connector contracts | Independent tenant/RLS/storage/secret tests pass; critical/high findings closed or formally accepted; frozen areas untouched. |
| 26 | Canonical Domain Consolidation and Legacy Retirement | PARTIAL | DONE | PUSH 16,24–25 | One source of truth remains per domain; compatibility paths are explicit and bounded; deterministic domain/security QA and the 11-camera live runtime regression pass. |
| 27 | Product Observability and Operational Telemetry | PARTIAL | DONE EARLY | Existing metrics; frozen-area adapters only via stable interfaces | Dashboards/alerts show defined SLOs from current services; telemetry failures do not affect processing; no frozen runtime semantics changed. |
| 28 | Quality Measurement and Benchmark Program | PARTIAL | DONE | PUSH 11; representative labeled product/pilot data | Versioned representative dataset and ground truth produce reproducible metrics with confidence intervals and drift gates. |
| 29 | Native Events and Cheap Preprocessing | PARTIAL | DONE | PUSH 23; connector/Gateway hardening; adapter evidence | Candidate-only native contract, local frame-difference before ONNX, safe fallback/priority gates, zero empty-slot work, deterministic QA and bounded 22-sample real-input workload comparison. Representative FN/recall proof remains a North-Star obligation. |
| 30 | Adaptive Sampling and Candidate Events | PARTIAL | DONE | PUSH 23,28–29; product/pilot metrics | Shared purpose/priority scheduler, never-blind floor, Watch/Incident/Track protection, fairness/pressure/expiry QA and bounded 11-camera workload pass; recall remains truthfully unmeasurable. |
| 31 | Durable AI Job Queue and Portable Workers | PARTIAL | DONE | PUSH 24,29–30; scale foundation | Versioned WAL queue survives restart/worker loss; lease/ACK/retry/dead-letter, expiry, scope, priority/fairness/backpressure and two-environment worker QA pass; a real Tapo sample traverses queue→ONNX→Tracker without fabricated Event. |
| 32 | Hybrid AI Routing | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 28,31; scale foundation | Eligibility-first versioned policy enforces privacy, tenant, capability, input, health and capacity; bounded failover preserves identity/provenance; EDGE_LOCAL real-camera and ISOLATED_PROCESS QA pass. The scoped closure PR merge is the authoritative completion event. Real Cloud remains unconfigured. |
| 33 | AI and Infrastructure Cost Engine | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 27,31–32; scale foundation | Versioned operational usage/rate/attribution engine, admin API/UI/export, empty-slot-safe allocation and real bounded resource baseline pass; provider-bill reconciliation remains required before unit-economics proof. |
| 34 | Storage Abstraction, NAS and Retention Portability | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 7,25 | Supabase and scoped local/NAS backends pass the same retention, authorization, deletion, integrity and migration contract; real network NAS remains future proof. |
| 35 | Portable Deployment and No-Office Dependency | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 17,24,34; connector/Gateway hardening | Clean tracked environment installs, builds, restores representative canonical state, verifies the model artifact, starts Web health and contains no critical office/developer-machine runtime dependency. |
| 36 | Horizontal Queue and Worker Scale Foundation | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 31,35; scale foundation | Four local processes share one durable queue without duplicate effects; 4 workers improve identical-workload throughput 3.19× with queue-age/fairness/worker-loss evidence. SQLite is explicitly single-host; Production multi-host proof remains PUSH 37–38. |
| 37 | High Availability, Load Balancing and Failover | PARTIAL | DONE ON VERIFIED PR MERGE | PUSH 35–36; scale foundation | Health-aware local multi-node routing, worker/queue recovery, bounded DB/storage failure behavior and fenced device ownership pass with zero acknowledged loss/duplicate effects. Postgres shared-queue contract exists; multi-host/zone/provider evidence remains explicit. |
| 38 | Reliability, Load, Soak and Chaos Qualification | BLOCKED | DEVELOPMENT COMPLETE — ACCEPTED WITH EXCEPTIONS | PUSH 23,31,36–37; scale foundation | The owner accepted the Development closure without an uninterrupted 24-hour PASS. Failed V7/pre-soak evidence, 0.2.100/0.2.101 `NOT_DONE`, 0.2.102 limitations and all assigned future proof obligations remain immutable and are not upgraded to real proof. |
| 39 | External Notifications, Actions and Escalation | PARTIAL | DEVELOPMENT MIGRATIONS APPLIED — NOT DONE | PUSH 10,25,27; provider sandboxes | Provider-neutral orchestration, durable delivery/retry/ack/escalation, recipient revalidation, human action gates, signed-webhook contracts and Product UI passed deterministic and 9/9 exact-head gates; isolated Development migration/drift passed. Cumulative full-stack and real provider sandbox receipts remain open; Production modes remain disabled. |
| 40 | Billing, Subscription and Entitlement Production | PARTIAL | DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING — NOT DONE | PUSH 25,39; provider/legal approval | Provider-neutral billing, subscription, entitlement, checkout, invoice, refund, partner attribution and self-service contracts passed deterministic QA, isolated Development migration/RLS/drift verification, exact-head CI and cumulative local full-stack verification. Payment-provider sandbox receipts, approved prices/legal process and real commercial activation remain open; Production mode stays disabled. |
| 41 | Enterprise Tenancy, RBAC, SSO and Service Accounts | PARTIAL | DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING — NOT DONE | PUSH 25–26,36; scale foundation | Organization/Site membership, nine-role RBAC, delegated administration, invitations, DISABLED/SANDBOX OIDC/SAML/SCIM, scoped service accounts, sessions, audit and bounded-scale foundations passed exact-head CI, isolated Development migration/RLS/drift and cumulative local full-stack verification. External IdP/SCIM, independent service-account, MFA/recovery, real multi-site, penetration and Production-scale proof remain open; SMS authentication is disabled. |
| 42 | External API and Webhook Platform | PARTIAL | DEVELOPMENT COMPLETE — EXTERNAL PROOF PENDING — NOT DONE | PUSH 25,26,41 | Versioned API, signed scoped Service Accounts, tenant/Site/resource isolation, bounded limits/usage, Evidence links, Watch/Investigation contracts, signed webhook lifecycle and independent local conformance pass. External partner, webhook receiver, VMS/vendor, Gan Batuach runtime, penetration, scale/SLA and real-traffic cost proof remain open. |
| 43 | SDK, OEM and White-Label Proof | PARTIAL | DEVELOPMENT IMPLEMENTATION IN VALIDATION — NOT DONE | PUSH 42 | Public SDK/API-only sample, partner/customer/Site isolation, canonical entitlement and usage linkage, short-lived embedded authorization, branding/legal-notice contract and upgrade-safe additive schema pass exact-head Development gates. A real partner remains mandatory external proof. |
| 44 | Native Mobile Production Readiness | PARTIAL | PARTIAL — INTERNAL IMPLEMENTATION PRESENT; NATIVE BUILD/REAL-DEVICE/STORE PROOF OPEN; NOT DONE | PUSH 25,39 | Signed real-device builds pass supported matrix, permissions/background/resume/push tests and store policy review. |
| 45 | Legal, Privacy and Compliance Closure | PARTIAL | DEVELOPMENT COMPLETE — EXTERNAL LEGAL APPROVAL PENDING — NOT DONE | PUSH 25; defined pilot scope | Versioned context/jurisdiction profiles, fail-closed written-approval gates, notice evidence, rights/deletion/export disposition, legal hold, privacy incident and append-only audit controls pass internal Development QA. Qualified written scoped approvals, final notices/retention/DPA/transfer decisions and real governed proof remain mandatory. |
| 46 | Real External Home Pilot | PLANNED | NOT STARTED | PUSH 16,23,25,28,38–39,45; product/pilot metrics | Non-team external site runs agreed period with real cameras, support log, quality/SLO and privacy sign-off. |
| 47 | Real External Business Pilot | PLANNED | NOT STARTED | PUSH 41,45–46; product/pilot metrics | Paying or contractually committed external business completes pilot exit criteria and referenceable outcome. |
| 48 | 100+ Camera / Monitoring-Center Pilot | PLANNED | NOT STARTED | PUSH 37–43,47; scale foundation | Real 100+ camera deployment meets SLOs, alert-load targets, operator acknowledgement and failover criteria. |
| 49 | Production Economics and KPI Proof | PLANNED | NOT STARTED | PUSH 28,33,38,46–48; product/pilot metrics | Auditable cohort metrics and unit economics are sustained across defined period and reconciled to bills/revenue. |
| 50 | Acquisition Technical DD and Data Room | PLANNED | READY NOW | Documentation can start now; final closure needs 24–49 | Early PASS is not allowed; final PASS only when data room is complete, internally reconciled and independently reviewable. |
| 51 | Paying Customers, Growth, Funding and Strategic Partnerships | PLANNED | LATE STAGE | PUSH 46–49 | Multiple paying customers, measured retention/unit economics and documented partner/funding pipeline exist. |
| 52 | Acquisition Process and Exit Readiness | PLANNED | LATE STAGE | PUSH 43,49–51 | Complete DD, IP/financial/contract readiness, board/owner mandate and multiple qualified buyer paths exist. |

## כל 197 יכולות North-Star

מקור כל שורה: DIGITAL_OBSERVER_CAPABILITY_PUSH_OWNERSHIP_MAP.json לפי Stable ID, עם הראיה המקבילה ב־DIGITAL_OBSERVER_NORTH_STAR_COMPLETION_MATRIX.md; שני ה־blobs נעולים ב־canonical-sources.json. VERIFIED בשורות מדיה אינו תקינות נוכחית: בדיקת האירוע הנוכחי גוברת לצורך זמינות היום.


### CAMERA PLATFORM

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-001 Universal Camera Platform | PARTIAL | FOUNDATION | PUSH 46 / PUSH 46 | Canonical source, adapter, registry and orchestrator contracts | Expand verified vendor and deployment coverage; Real mixed-vendor pilots without architecture changes |
| DO-NS-002 Zero-Install connection | PARTIAL | FOUNDATION | PUSH 46 / PUSH 46 | Resolver and wizard rank secure persistent zero-install first | Implement and validate vendor/direct integrations; Real camera persists without phone, Connector or DO hardware |
| DO-NS-003 Mobile-assisted onboarding | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 44 / PUSH 44 | Native lifecycle/network/session/deep-link/resync implementation plus mobile discovery and cross-device contracts; no native build or real-device proof | Native compilation, OS camera discovery integration, signed real-device onboarding and external Push/remote-media proof; Signed iOS/Android real-device onboarding proof |
| DO-NS-004 Software Connector exception | VERIFIED | DONE + REAL PROOF | PUSH 16 / RELEASE_GATE CONTINUOUS_REGRESSION | Real Tapo C211, frames, AI, Event and Product UI | Distribution signing and broader host coverage; Existing proof plus signed installer matrix |
| DO-NS-005 Physical Gateway last resort | VERIFIED | DONE + REAL PROOF | PUSH 17 / RELEASE_GATE CONTINUOUS_REGRESSION | Real home DVR with ten populated channels | Preserve resolver policy across future routes; Real policy-selection test and continuing DVR proof |
| DO-NS-006 Mixed vendors in one Site | VERIFIED | DONE + REAL PROOF | PUSH 16 / RELEASE_GATE CONTINUOUS_REGRESSION | One Home contains DVR cameras and Tapo | Add further vendor combinations; Real mixed-site inventory and isolation proof |
| DO-NS-007 DVR/NVR/VMS integrations | PARTIAL | PARTIAL | PUSH 42 / PUSH 47 | Real DVR through Physical Gateway | Add NVR/VMS connectors and partner contracts; Independent customer VMS/NVR pilot |
| DO-NS-008 Vendor Cloud/API integrations | BLOCKED | EXTERNAL COVERAGE GAP | PUSH 42 / PUSH 42 | Registry can describe cloud/account paths | Vendor authorization and adapters; Supported vendor account link on real hardware |
| DO-NS-009 Live View | VERIFIED | DONE + REAL PROOF | PUSH 7 / RELEASE_GATE CONTINUOUS_REGRESSION | Real DVR and Tapo moved in authorized Product player | Keep playback regression in release gates; Fresh moving Product video for every supported path |
| DO-NS-010 Recordings/playback | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | Private evidence playback and live HLS contracts | Broader recording-provider and retention coverage; Real retained recording playback across supported storage |
| DO-NS-011 Evidence | VERIFIED | DONE + REAL PROOF | PUSH 7 / RELEASE_GATE CONTINUOUS_REGRESSION | Real bounded private evidence and authorized playback | Extend providers and deletion evidence; Real event-to-evidence integrity and policy proof |
| DO-NS-012 Camera Health | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 23 canonical source/frame/relay/playback/AI/component/auth/cloud/recording model, tenant-scoped API, customer UI and deterministic fault matrix | Controlled real source/playback/AI/common-cause fault proof and long-duration qualification; Fault injection on real cameras with truthful recovery |
| DO-NS-013 Universal Camera Controls | PARTIAL | FOUNDATION | PUSH 39 / PUSH 46 | Capability and command allow-list foundations | Vendor-agnostic control execution and policy; Real authorized controls across two vendors |
| DO-NS-014 PTZ | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Capability representation only | Implement supported adapter controls; Real pan, tilt and stop with authorization/audit |
| DO-NS-015 Zoom | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Capability representation only | Implement optical/digital capability mapping; Real supported zoom action and fallback proof |
| DO-NS-016 Presets | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | No real preset execution proof | Preset discovery, validation and execution; Real preset recall with tenant/action policy |
| DO-NS-017 Speaker | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | No real two-way audio proof | Audio capability, consent and transport; Authorized real-device audio proof |
| DO-NS-018 Siren | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | No real siren action proof | Safety policy, consent and adapter; Real bounded action with audit and cancellation |
| DO-NS-019 Spotlight/light | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | No real light action proof | Capability mapping and adapter execution; Real bounded action with failure recovery |
| DO-NS-020 Vendor-agnostic action capability mapping | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | Registry and strategy capability model | Add action schema and vendor implementations; Conformance tests plus two real vendors |

### OBSERVER INTELLIGENCE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-021 Broad perception | PARTIAL | PARTIAL | PUSH 49 / PUSH 49 | Real person pipeline and canonical Event domains | Expand representative object/event classes; Versioned real benchmark across approved classes |
| DO-NS-022 Person detection | VERIFIED | DONE + REAL PROOF | PUSH 3 / RELEASE_GATE CONTINUOUS_REGRESSION | Real physical person processed by ONNX | Ongoing benchmark and drift gates; Reproducible real dataset precision/recall |
| DO-NS-023 Vehicle detection | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Detector/event schema support exists | Representative real vehicle validation; Fresh real-camera vehicle benchmark |
| DO-NS-024 Smoke/fire detection | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Event taxonomy supports safety classes | Approved models, datasets and escalation policy; Realistic controlled benchmark and safety review |
| DO-NS-025 Intrusion detection | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Zones, crossings, incidents and rules exist | External-site scenario evidence; Real zone intrusion end-to-end proof |
| DO-NS-026 Violence/fight/distress | PLANNED | NOT STARTED | PUSH 39 / PUSH 39 | No supported quality claim | Define lawful scope, models and human verification; Approved benchmark and human-gated pilot |
| DO-NS-027 Object/event detection | PARTIAL | PARTIAL | PUSH 49 / PUSH 49 | Canonical Event pipeline and bounded detections | Broader classes and quality evidence; Representative labeled real data |
| DO-NS-028 Tracking | VERIFIED | DONE + REAL PROOF | PUSH 5 / RELEASE_GATE CONTINUOUS_REGRESSION | Real Track ID, entry/exit and dedupe proof | Broader conditions and occlusion QA; Real multi-condition tracking benchmark |
| DO-NS-029 Multi-Camera Tracking | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | Single-camera tracking only | Cross-stream association architecture and quality; Real multi-camera sequence with measured errors |
| DO-NS-030 Cross-Camera Correlation | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Incident correlation model exists | Spatial/temporal cross-camera identity logic; Real site timeline across multiple cameras |
| DO-NS-031 Identity Continuity | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No production biometric/ReID claim | Policy-approved ReID and uncertainty handling; Legal approval plus real benchmark |
| DO-NS-032 Scene/Space Understanding | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Zones, Site, camera and context models | Semantic spatial model and evidence; Real site map and grounded scene queries |
| DO-NS-033 Room/area understanding | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Site and zone context exists | Add area relationships and validation; Real-site semantic topology proof |
| DO-NS-034 Semantic camera naming suggestions | PARTIAL | FOUNDATION | PUSH 49 / PUSH 46 | Friendly-name onboarding and registry metadata | Suggestion model and confirmation UX; Real onboarding usability proof |
| DO-NS-035 Zones | VERIFIED | DONE + REAL PROOF | PUSH 5 / RELEASE_GATE CONTINUOUS_REGRESSION | Real zone/line crossing and safe normalization | Multi-layout QA; Real entry/exit regression across layouts |
| DO-NS-036 Site topology | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 41 | Organization/Site membership, delegated scope and bounded 1/10/100/1,000-Site synthetic isolation are implemented; no external multi-site deployment is claimed | External multi-site organization topology and sustained operational scale remain unproven; Real multi-site topology and access proof |
| DO-NS-037 Context/Baseline | VERIFIED | DONE + REAL PROOF | PUSH 8 / RELEASE_GATE CONTINUOUS_REGRESSION | Real-only baseline input and maturity state | Longer external-site learning; Real pilot stability and drift proof |
| DO-NS-038 Site learning | PARTIAL | PARTIAL | PUSH 46 / PUSH 46 | Site/camera baseline aggregation exists | External cohort and seasonality; Long-running real-site evaluation |
| DO-NS-039 User-specific learning | PARTIAL | FOUNDATION | PUSH 45 / PUSH 46 | Feedback and reviewed ground truth are scoped | Consent, controls and personalization proof; User-controlled pilot with deletion/export |
| DO-NS-040 Global Observer Intelligence | PARTIAL | FOUNDATION | PUSH 45 / PUSH 45 | Sanitized calibration architecture | Privacy-preserving aggregation and quality gates; Independent privacy review and multi-tenant benchmark |
| DO-NS-041 Connection Intelligence | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | Registry, observations, maturity and safety gates | More vendor/stability samples; Multi-vendor real outcomes with no sensitive data |

### DECISION / AUTONOMY

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-042 Events | VERIFIED | DONE + REAL PROOF | PUSH 3 / RELEASE_GATE CONTINUOUS_REGRESSION | REAL_CAMERA_AI Event reached Production UI | Broader classes and scale; Fresh real events under load |
| DO-NS-043 Incidents | VERIFIED | DONE + REAL PROOF | PUSH 6 / RELEASE_GATE CONTINUOUS_REGRESSION | Real event correlation and lifecycle | External scenarios and scale; Real multi-event incident pilot |
| DO-NS-044 Risk | VERIFIED | DONE + REAL PROOF | PUSH 9 / RELEASE_GATE CONTINUOUS_REGRESSION | Deterministic explainable evaluation | Calibration with reviewed outcomes; Real calibrated cohort evidence |
| DO-NS-045 Verification | VERIFIED | DONE + REAL PROOF | PUSH 10 / RELEASE_GATE CONTINUOUS_REGRESSION | Independent verification state in decision flow | More signals and time-to-verification data; Real representative false-alarm reduction |
| DO-NS-046 Decision | VERIFIED | DONE + REAL PROOF | PUSH 9 / RELEASE_GATE CONTINUOUS_REGRESSION | Canonical auditable decision persisted | Action policies and external outcomes; Real decision-to-action pilot |
| DO-NS-047 Predictive risk | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Baseline and risk primitives exist | Prospective models and guardrails; Time-separated validated real dataset |
| DO-NS-048 Recommended actions | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | Decision/rule output can represent guidance | Action catalog and policy; Real operator acceptance/effectiveness proof |
| DO-NS-049 Autonomous camera actions | PLANNED | NOT STARTED | PUSH 39 / PUSH 46 | No autonomous physical action claim | Authorization, safeguards and adapters; Real reversible action with audit and fail-safe |
| DO-NS-050 Escalation | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | Decision and provider boundaries exist | Production provider workflows; Real acknowledged escalation pilot |
| DO-NS-051 Emergency workflows | PARTIAL | PARTIAL | PUSH 39 / PUSH 39 | No production emergency integration | Legal, provider and human-response design; Approved real drill with failure handling |
| DO-NS-052 Human verification boundaries | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | Feedback/review and verification separation | Define mandatory human gates by action; Policy audit plus real workflow proof |
| DO-NS-053 Action authorization/policy | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | RBAC and command allow-list controls | Fine-grained action policy engine; Cross-role negative tests and real action audit |

### NATURAL LANGUAGE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-054 Watch Rule Compiler | VERIFIED | DONE + REAL PROOF | PUSH 12 / RELEASE_GATE CONTINUOUS_REGRESSION | Hebrew intent compiled, confirmed and matched real Event | Expand language and ambiguity evidence; Real tenant-safe rule suite |
| DO-NS-055 Personalized monitoring instructions | PARTIAL | PARTIAL | PUSH 39 / PUSH 39 | Structured rules and scoped feedback | Preference model and consent; Real user-controlled longitudinal pilot |
| DO-NS-056 Investigation | VERIFIED | DONE + REAL PROOF | PUSH 13 / RELEASE_GATE CONTINUOUS_REGRESSION | Tenant-safe real Event/Incident/Evidence search | Broader enterprise data and latency; External user investigation benchmark |
| DO-NS-057 Conversational control | PARTIAL | PARTIAL | PUSH 39 / PUSH 39 | NL compiler/search boundaries exist | Session, authorization and confirmation UX; Real bounded conversation with negative tests |
| DO-NS-058 Natural-language camera/action commands | PARTIAL | PARTIAL | PUSH 39 / PUSH 46 | No physical command execution proof | Intent-to-policy/action pipeline; Authorized real-device command with confirmation/audit |

### IDENTITY / BIOMETRICS

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-059 Known People | PARTIAL | FOUNDATION | PUSH 45 / PUSH 45 | Privacy boundary and unsupported-query refusal | Consent, lifecycle and quality implementation; Legal approval plus real consented pilot |
| DO-NS-060 Face Recognition | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | Explicitly not claimed | Jurisdiction policy, model and consent; Approved legal scope and representative benchmark |
| DO-NS-061 Biometric matching | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No production biometric matcher | Template security and quality; Independent biometric/privacy assessment |
| DO-NS-062 Identity Continuity for biometrics | PLANNED | NOT STARTED | PUSH 48 / PUSH 49 | No production identity continuity | Uncertainty and cross-camera ReID; Consented real multi-camera benchmark |
| DO-NS-063 Unknown-person handling | PARTIAL | FOUNDATION | PUSH 45 / PUSH 45 | Events can remain unidentified; unsupported identity refused | Policy and UX; Real non-identification and escalation proof |
| DO-NS-064 Watchlists | PLANNED | NOT STARTED | PUSH 39 / PUSH 39 | No lawful production watchlist | Governance, audit and matching; Jurisdiction-approved pilot |
| DO-NS-065 LPR/vehicle identity | PLANNED | NOT STARTED | PUSH 45 / PUSH 45 | No verified plate recognition | Model, jurisdiction and retention; Real approved plate benchmark |
| DO-NS-066 Consent/policy/jurisdiction controls | PARTIAL | PARTIAL | PUSH 45 / PUSH 45 | PUSH 45 implements scoped policy profiles and a fail-closed written-approval gate; external approval remains pending | Qualified external legal decisions and approved real-use profiles; External legal review plus approved-profile and negative-path evidence |

### GUARDIAN / PERSONAL SAFETY

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-067 Personal/Mobile Observer | PARTIAL | FOUNDATION | PUSH 44 / PUSH 44 | Mobile and notification architecture | Native sensors, background and pilot; Signed real-device home pilot |
| DO-NS-068 Child safety | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Restrictive privacy mode boundaries | Legal/guardian policy and scenarios; Consented family pilot and safety review |
| DO-NS-069 Guardian mode | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | No complete guardian workflow | Product state and escalation; Real controlled end-to-end drill |
| DO-NS-070 Safe Journey | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | No journey state machine | Location, check-in and privacy design; Real journey test with recovery |
| DO-NS-071 SOS | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | No production SOS | Mobile trigger and response integration; Real drill and provider acknowledgement |
| DO-NS-072 Silent SOS | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | No production silent SOS | Covert UX, abuse safeguards and response; Approved real-device drill |
| DO-NS-073 Safety check-ins | PLANNED | NOT STARTED | PUSH 39 / PUSH 39 | No check-in workflow | Scheduling and escalation; Real missed-check-in drill |
| DO-NS-074 Safety Circle | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | No trusted-contact graph | Consent, invitations and revocation; Multi-user privacy/notification test |
| DO-NS-075 Location/context signals | PARTIAL | FOUNDATION | PUSH 44 / PUSH 44 | Context model and future mobile hooks | Mobile permissions and fusion; Real-device privacy-controlled evidence |
| DO-NS-076 Phone + camera sensor fusion | PLANNED | NOT STARTED | PUSH 44 / PUSH 46 | No fused inference proof | Time alignment and uncertainty; Real synchronized scenario benchmark |
| DO-NS-077 Missing Person Response | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No response workflow | Legal policy, search and escalation; Authorized controlled exercise |
| DO-NS-078 Last Known State | PARTIAL | FOUNDATION | PUSH 44 / PUSH 44 | Incident timelines and evidence references | Identity/location linkage; Authorized real scenario proof |
| DO-NS-079 Visual location without child phone | PLANNED | NOT STARTED | PUSH 45 / PUSH 45 | No identity/search implementation | Consent, ReID and strict policy; Legally approved real multi-camera exercise |
| DO-NS-080 Cross-camera missing-person search | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No cross-camera identity search | ReID/search and human verification; Approved real benchmark |
| DO-NS-081 Guardian escalation workflows | PLANNED | NOT STARTED | PUSH 44 / PUSH 44 | Provider escalation not active | Safe contacts/providers and dedupe; Real drill with recovery and audit |

### ENTERPRISE INVESTIGATION & INTELLIGENCE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-082 Existing VMS/NVR/camera estate integration | PARTIAL | PARTIAL | PUSH 42 / PUSH 47 | Real DVR retained and integrated | VMS APIs and recording access; External enterprise integration pilot |
| DO-NS-083 Integration without replacing VMS | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 47 | Intelligence-layer architecture preserves current DVR | Deep links, APIs and customer-hosted access; Customer VMS remains primary viewer in real pilot |
| DO-NS-084 Enterprise Edge | PARTIAL | FOUNDATION | PUSH 41 / PUSH 48 | Shared edge profile contract | Packaging, policy and scale; Customer-hosted real deployment |
| DO-NS-085 Customer-hosted video access | PARTIAL | FOUNDATION | PUSH 42 / PUSH 42 | Source/storage abstraction direction | Connectors and policy; Real customer-hosted stream authorization proof |
| DO-NS-086 Customer-hosted recording access | PARTIAL | FOUNDATION | PUSH 42 / PUSH 42 | observer-source-recording-reference-v1 safely binds customer-owned archive media without credentials or forced copying | Implement authorized DVR/NVR/VMS retrieval adapters and retention mapping; Real customer-hosted recording retrieval |
| DO-NS-087 Metadata-first processing | PARTIAL | PARTIAL | PUSH 47 / PUSH 47 | PUSH 29 vendor-agnostic candidate contract and real local-frame-difference path; native DVR/Tapo metadata unverified | Verified native vendor/VMS adapters and representative quality QA; Real reduced-video workload with quality proof |
| DO-NS-088 Federated investigation | PARTIAL | FOUNDATION | PUSH 42 / PUSH 42 | Investigation is current-platform scoped | Federated query and authorization; Cross-system external pilot |
| DO-NS-089 Image upload search | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No production image-reference search | Privacy and matching pipeline; Authorized real benchmark |
| DO-NS-090 Video-reference search | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No production video-reference search | Feature extraction and policy; Authorized real benchmark |
| DO-NS-091 Person search | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | NL investigation exists; identity is refused | Lawful appearance/ReID search; Approved representative pilot |
| DO-NS-092 Vehicle search | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Event investigation primitives exist | Vehicle attributes and quality; Real multi-camera vehicle search |
| DO-NS-093 Object search | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Event/evidence investigation primitives | Object embeddings/taxonomy; Real labeled search benchmark |
| DO-NS-094 Appearance/ReID | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No production ReID claim | Model, policy and benchmark; Consented independent evaluation |
| DO-NS-095 Cross-camera investigation | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Incident/evidence timeline primitives | Cross-camera correlation and UI; Real multi-camera case reconstruction |
| DO-NS-096 Timeline reconstruction | PARTIAL | PARTIAL | PUSH 48 / PUSH 48 | Incident timeline and grounded evidence search | Cross-system/camera ordering; External operator case proof |
| DO-NS-097 Historical investigation | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | Search over retained Events/Incidents/Evidence | Scale, retention and enterprise UX; Large retained dataset investigation |
| DO-NS-098 Current/live investigation | PARTIAL | FOUNDATION | PUSH 42 / PUSH 42 | Recent event search and live view exist | Live query subscription and scale; Real ongoing incident operator test |
| DO-NS-099 Continuous Watch | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Watch rules exist | Persistent cross-camera targets and alerts; Real long-running watch pilot |
| DO-NS-100 Watch Targets | PARTIAL | FOUNDATION | PUSH 39 / PUSH 39 | Rule model can target scoped resources | Identity/vehicle/object target governance; Authorized real target workflow |
| DO-NS-101 Alert when person/vehicle appears | PARTIAL | PARTIAL | PUSH 39 / PUSH 39 | No lawful identity/vehicle watch proof | Matching, consent and escalation; Approved real alert proof |
| DO-NS-102 Behavioral Watch Targets | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Rules, context and risk primitives | Behavior models and quality; Real representative behavior pilot |
| DO-NS-103 Investigation Reports | PARTIAL | FOUNDATION | PUSH 42 / PUSH 42 | Grounded result and evidence references | Export, provenance and review; External operator-generated report |
| DO-NS-104 Evidence references | VERIFIED | DONE + REAL PROOF | PUSH 7 / RELEASE_GATE CONTINUOUS_REGRESSION | Signed private evidence links in Product | External API references; Independent API consumer proof |
| DO-NS-105 Confidence/explanation | VERIFIED | DONE + REAL PROOF | PUSH 9 / RELEASE_GATE CONTINUOUS_REGRESSION | Detection, risk and verification remain distinct/explained | Broader model calibration; External user comprehension and calibration test |
| DO-NS-106 Quantitative analysis | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Observability/calibration aggregates | Product-safe analytical queries; Auditable real cohort analysis |
| DO-NS-107 Big-Data analysis | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No warehouse-scale proof | Scalable analytical architecture; Real large-volume performance and correctness test |
| DO-NS-108 Trends | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Bounded observability trends | Product analytics separation and cohorts; Real longitudinal tenant-safe dashboard |
| DO-NS-109 Risk concentrations | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Risk bands and aggregates exist | Spatial/temporal concentration analysis; Real cohort with statistical bounds |
| DO-NS-110 Recommendations | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Explainable decision primitives | Evidence-based recommendation policy; Measured operator/customer usefulness |
| DO-NS-111 Customer-data-derived operational recommendations | PLANNED | NOT STARTED | PUSH 49 / PUSH 49 | No validated recommendation engine | Privacy, causality and feedback; External customer validation without leakage |

### ENTERPRISE INTEGRATION OUTPUT

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-112 API | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 versioned Service-Account API, signed request contract, replay/idempotency/rate controls, OpenAPI and independent HTTP-only client | Exact merged Development consumer and external adopter proof; Independent consumer conformance proof |
| DO-NS-113 SDK | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 43 / PUSH 43 | Published Development SDK and independent synthetic conformance sample; no external consumer proof | External publication/support lifecycle and real partner adoption; Independent integration from docs |
| DO-NS-114 Webhooks | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 allowlisted DISABLED/SANDBOX subscriptions and versioned HMAC reference-only payload contract over PUSH 39 delivery semantics | Real external receiver retry, idempotency and acknowledgement receipts; External receiver retry/idempotency proof |
| DO-NS-115 Event callbacks | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 stable signed Event/Incident/Evidence/health callback types over the durable PUSH 39 outbox foundation | Real sandbox callback delivery and acknowledgement; Real external consumer delivery proof |
| DO-NS-116 Investigation API | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 exposes the existing grounded Investigation compiler and retained canonical search through scoped Service-Account authorization | Exact merged independent consumer and representative retained-data proof; Independent consumer query proof |
| DO-NS-117 Watch API | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 bounded Watch Rule read, compile-preview and state controls; external compilation cannot activate rules or actions | Independent consumer and human-confirmed lifecycle proof; Independent consumer conformance proof |
| DO-NS-118 Result delivery | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 39 / PUSH 39 | Notifications/outbox architecture | Public delivery providers and audit; External end-to-end receipt proof |
| DO-NS-119 Evidence references for integrations | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 42 | PUSH 42 minimized Evidence metadata and a reauthorized 60-second private media redirect without embedded media | Exact merged consumer and real-object wrong-tenant/expiry proof; Independent consumer opens authorized evidence |
| DO-NS-120 Deep-link/open-camera in customer VMS | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 47 | PUSH 42 configured HTTPS deep-link expansion tied to an authorized connected source without exposing credentials | Vendor-specific configuration and real VMS exercise; Real VMS integration proof |
| DO-NS-121 Embedded Intelligence | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 43 / PUSH 43 | Short-lived audience/Origin/Site-scoped embedding passes synthetic QA; no external host proof | External-host session, revocation, accessibility and upgrade proof; External-host sample app |
| DO-NS-122 OEM | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 43 / PUSH 43 | OEM contracts and synthetic independent-app proof exist; no real OEM partner proof | Approved partner agreement, vendor integration, support and settlement proof; Signed partner integration |
| DO-NS-123 White-label | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 43 / PUSH 43 | Configurable branding and brand-neutral embedded components pass deterministic QA; no external domain deployment | Legal approval, verified custom domain and real branded deployment; External branded deployment |
| DO-NS-124 Service accounts | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 41 | Scoped expiring credentials, one-time issuance, HMAC storage, rotation, revocation and audit are implemented with deterministic negative tests | PUSH 42 public API rate limits and independent external consumer proof remain; Cross-tenant negative and rotation tests |
| DO-NS-125 Enterprise auth | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 48 | Canonical RBAC, invitations, sessions and DISABLED/SANDBOX OIDC/SAML/SCIM contracts are implemented; SMS authentication is disabled by policy | No approved external IdP, SCIM directory, passkey/TOTP integration or Production activation proof; External organization SSO proof |
| DO-NS-126 Enterprise audit | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 48 | Append-only enterprise audit records cover actor, organization, tenant, Site, resource, action, authorization decision, result and correlation metadata | Public API/action/export coverage and independent trace exercise remain; Independent audit trace exercise |

### SCALE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-127 Home | VERIFIED | DONE + REAL PROOF | PUSH 16 / RELEASE_GATE CONTINUOUS_REGRESSION | One real home with 11 physical cameras | External non-team pilot; Sustained consented external home proof |
| DO-NS-128 SMB | PARTIAL | FOUNDATION | PUSH 41 / PUSH 47 | Site/tenant/product architecture | Real business workflows; External business pilot |
| DO-NS-129 Multi-site business | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 47 | Organization membership, delegated Site scope and bounded 1/10/100/1,000-Site synthetic isolation profiles are implemented | Real multi-site customer operations, support and sustained scale remain unproven; Real multi-site customer proof |
| DO-NS-130 Mall | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No mall-scale deployment | Scale/operator workflows; Real or representative 100+ camera proof |
| DO-NS-131 Campus | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No campus deployment | Distributed topology and policy; Representative campus-scale pilot |
| DO-NS-132 Hospital/industrial | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No regulated industrial pilot | Domain safety/compliance; Approved sector pilot |
| DO-NS-133 Large security operation | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | No monitoring-center proof | Operator load and escalation; Real monitoring-center pilot |
| DO-NS-134 City-scale architecture | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Horizontal/distributed roadmap ownership | Architecture, privacy and scale proof; Staged city-scale benchmark and governance |
| DO-NS-135 Thousands of streams | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | PUSH 36 generated a synthetic 1,000-camera/2,000-job, ten-tenant/fifty-Site queue profile and processed a bounded sample | Real stream execution, multi-host queue and sustained qualification; Measured 1,000-stream qualification |
| DO-NS-136 Distributed processing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | PUSH 31/32 contracts, PUSH 35 portability and PUSH 36 four-process shared-queue/load/worker-loss proof | Multi-host Production queue/deployment and sustained operation; Independent multi-host failover/load proof |
| DO-NS-137 Enterprise Edge scale | PARTIAL | FOUNDATION | PUSH 48 / PUSH 48 | Shared edge profile contract | Production packaging and fleet; Multi-edge enterprise pilot |
| DO-NS-138 Queues | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | PUSH 31 durable WAL semantics plus PUSH 36 four-process lease/fairness/worker-loss and queue-age QA | Multi-host backend and sustained Production load; Real multi-host worker-loss and tenant-fairness proof |
| DO-NS-139 Load balancing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | PUSH 36 authenticated worker pool plus PUSH 37 three-node health-aware request distribution, failed-instance removal and gated rejoin | Multi-host/zone deployment and sustained load; Measured independent-host scale/failover test |
| DO-NS-140 Failover | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | PUSH 37 local API/worker/queue/dependency/storage fault campaign, fenced ownership and zero acknowledged loss/duplicate effects | Deploy shared Postgres backend and prove independent-host/zone/provider recovery; External multi-host RTO/RPO fault injection |
| DO-NS-141 Fleet management | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | Canonical inventory/API/UI, bounded commands and 10,000-component synthetic QA | Real multi-tenant/multi-site operational deployment; Real multi-device fleet proof |

### RELIABILITY

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-142 OTA | VERIFIED | DONE + REAL PROOF | PUSH 19 / RELEASE_GATE CONTINUOUS_REGRESSION | Shared Ed25519-signed manifest, verified artifact, atomic isolated update on Connector and Gateway profiles | Production key custody and staged customer rollout operations; Signed isolated update plus future bounded real canary evidence |
| DO-NS-143 Rollback | VERIFIED | DONE + REAL PROOF | PUSH 19 / RELEASE_GATE CONTINUOUS_REGRESSION | Controlled bad 1.2.0 release automatically restored healthy known-good 1.1.0 and quarantined failure | Continue platform/customer canary evidence; Induced bad update automatically recovers identity/config/health |
| DO-NS-144 Watchdog | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 20 shared progress-aware supervisor, bounded backoff and isolated process/stream fault matrix | Long-duration real fault qualification; Real fault recovery within target |
| DO-NS-145 Self-healing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 20 bounded recovery ladder, audit, duplicate safety and isolated fault matrix | Long-duration real recovery qualification; Real fault matrix plus agreed soak |
| DO-NS-146 DVR session recovery | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 18B recovered current Gateway | Automated repeatable qualification; Induced session failure and recovery |
| DO-NS-147 Relay recovery | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 20 bounded relay replacement/backoff and isolated relay-kill recovery QA | Controlled real fault qualification; Real relay-loss recovery proof |
| DO-NS-148 Stale-frame detection | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 20 detects non-progress despite live process and recovers in isolated QA | Product SLO and controlled real frozen-stream proof; Frozen-stream fault test |
| DO-NS-149 Offline buffering | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 21 encrypted SQLite/WAL queue survives restart and retains Events, evidence/media work and operational state in isolated outage QA | Natural real-camera outage Event and longer disk/retention qualification; Real offline interval proof |
| DO-NS-150 Resync | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 46 / PUSH 46 | PUSH 21 bounded per-ordering-key resync, ACK retry, idempotency, tenant/rebind/revocation and backfill-safety QA | Natural real-camera Event/UI resync proof; Disconnect/reconnect no-duplicate proof |
| DO-NS-151 Camera Health reliability | PARTIAL | PARTIAL | PUSH 46 / PUSH 46 | Source/processing/playback dimensions now distinct | Full engine and alert SLO; Real disconnect/freeze/recovery proof |
| DO-NS-152 Component health | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | Observability model and current edge health | Fleet coverage and alerting; Multi-component fault exercise |
| DO-NS-153 24/7 stability | PLANNED | NOT STARTED | PUSH 46 / PUSH 46 | No qualifying long-duration run | Soak plan and execution; Agreed-duration real soak |
| DO-NS-154 Real fault injection | PARTIAL | PARTIAL | PUSH 46 / PUSH 46 | PUSH 37 deterministic isolated API/worker/queue/DB/storage/capacity/split-brain campaign | Real multi-host, provider and long-duration campaign; Published independent-environment recovery results |
| DO-NS-155 Long-duration stability tests | PLANNED | NOT STARTED | PUSH 46 / PUSH 46 | No canonical long soak | Execute staged soak; Sustained SLO evidence |

### AI INFRASTRUCTURE / ECONOMICS

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-156 Preprocessing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | PUSH 29 local frame difference precedes ONNX; candidate-only native contract, dedupe/coalescing, safe fallback and 11/22 real-input jobs avoided | Representative FN Ground Truth and verified native vendor adapters; Real quality-preserving workload reduction |
| DO-NS-157 Sampling | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | PUSH 30 canonical purpose/priority scheduler, explainable decisions, never-blind floor, fairness and bounded 11-camera real-input comparison | Representative FN Ground Truth, long-duration and multi-Site evaluation; Recall/latency comparison on representative real data |
| DO-NS-158 AI job queue | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 48 / PUSH 48 | PUSH 31 contracts/real Tapo sample plus PUSH 36 local four-process scale, idempotency, worker-loss and backpressure evidence | Multi-host Production operation and representative sustained load; Real deployed multi-host worker-loss/backpressure proof |
| DO-NS-159 Hybrid routing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | PUSH 32 eligibility-first router, policy audit, bounded failover and real EDGE_LOCAL camera job | Authorized Cloud adapter and real multi-provider operation; Real failover with provenance across deployed providers |
| DO-NS-160 Model routing | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | PUSH 32 capability/model matching plus measured-quality sample gate | Representative multi-model quality evidence; Measured route selection proof |
| DO-NS-161 Cost-aware optimization | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | PUSH 33 normalized usage/rates, execution provenance and fail-closed quality/privacy cost guard; PUSH 32 routing remains unchanged | Approved reconciled rates and controlled routing experiment; Quality-constrained real savings proof |
| DO-NS-162 Edge/cloud allocation | PARTIAL | PARTIAL | PUSH 49 / PUSH 49 | PUSH 32 real EDGE_LOCAL plus isolated LOCAL_DEDICATED routing; Cloud target classes remain unconfigured | Authorized Cloud provider and real workload split; Real workload split proof |
| DO-NS-163 Per-camera economics | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | PUSH 33 AI job/target/camera/Site/tenant attribution, explicit confidence and 11-camera empty-slot-safe allocation QA | Authorized provider rates, sustained duration and bill reconciliation; Provider-bill reconciliation |
| DO-NS-164 Scale economics | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | PUSH 33 assumption-labeled 10/100/1,000-camera resource projections from bounded real workload; no monetary extrapolation | Pilot/scale cost data; Sustained auditable cohort economics |

### QUALITY

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-165 Feedback | VERIFIED | DONE + REAL PROOF | PUSH 11 / RELEASE_GATE CONTINUOUS_REGRESSION | Authorized user feedback path | External review coverage; Real pilot feedback cohort |
| DO-NS-166 Reviewed Ground Truth | VERIFIED | DONE + REAL PROOF | PUSH 11 / RELEASE_GATE CONTINUOUS_REGRESSION | Review lifecycle and calibration sample | Representative volume; Blinded reviewed dataset |
| DO-NS-167 Calibration | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Human-gated calibration metrics | Statistical sample size and drift; Reproducible real calibration report |
| DO-NS-168 Precision | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Reproducible PUSH 28 metric with denominator/Wilson interval; first reviewed real result is 1/1 only | Representative labels; Confidence-bounded benchmark |
| DO-NS-169 Recall | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | FN opportunity contract and truthful NOT MEASURABLE result | Representative missed-event labels; Confidence-bounded benchmark |
| DO-NS-170 False-positive rate | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Categorized FP metric with dataset/model scope | Sufficient reviewed sample; Cohort rate with denominator and interval |
| DO-NS-171 False-negative analysis | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Expected-but-missing records are representable; no systematic missed-event capture yet | Sampling/review design; Representative blind-review study |
| DO-NS-172 Latency quality | PARTIAL | PARTIAL | PUSH 49 / PUSH 49 | Event/decision/playback timestamps and telemetry | End-to-end real cohorts; Percentile latency under target load |
| DO-NS-173 Confidence calibration | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Confidence bins/ECE, sample gate and semantic separation implemented | Representative reliability diagrams and cohorts; Versioned representative calibration |
| DO-NS-174 Real pilot datasets | PLANNED | NOT STARTED | PUSH 46 / PUSH 46 | Current home is reference, not external pilot dataset | Consent and data collection; Approved versioned pilot datasets |
| DO-NS-175 No misleading metrics | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 49 / PUSH 49 | Sample-size/status rules in quality and telemetry docs | Independent reporting audit; Published metrics trace to denominators/evidence |

### SECURITY / PRIVACY / DD

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-176 Tenant isolation | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 41 | RLS/API negative suites and scoped playback | Independent external penetration test; Two-tenant independent authorization assessment |
| DO-NS-177 Managed-device identity | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 45 / PUSH 45 | Ed25519 isolated lifecycle; live devices remain legacy | Controlled live migration; Real Connector/Gateway hardened credential proof |
| DO-NS-178 Zero-install security | PARTIAL | FOUNDATION | PUSH 46 / PUSH 46 | Deterministic hard gates and no public RTSP | Real vendor integrations; Security review of real direct/account path |
| DO-NS-179 Biometrics governance | PARTIAL | PARTIAL | PUSH 49 / PUSH 49 | Restrictive privacy boundary and non-claim | Formal jurisdiction/consent program; External legal/privacy approval |
| DO-NS-180 Encryption | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 45 / PUSH 45 | Dedicated field key and encrypted credential path | Rotation exercise and independent review; Production-like rotation/recovery proof |
| DO-NS-181 Audit | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 41 | Enterprise invitation, SSO/SCIM, session and service-account lifecycle decisions are append-only and tenant/organization scoped | Complete public API/action/export coverage and independent traceability review remain; Independent traceability exercise |
| DO-NS-182 Retention | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 45 / PUSH 45 | PUSH 34 provider-independent retention, legal hold, delete-before-tombstone and backend-failure retry QA | Approved legal periods, all-domain enforcement and Production deletion evidence; Policy-approved real deletion/retention test |
| DO-NS-183 Evidence authorization | VERIFIED | DONE + REAL PROOF | PUSH 7 / RELEASE_GATE CONTINUOUS_REGRESSION | Real private signed playback with tenant scope | External API consumer coverage; Wrong-tenant/expired/deleted real-object proof |
| DO-NS-184 Enterprise access control | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 41 / PUSH 48 | Canonical organization/Site roles, granular server permissions, delegated-grant ceilings, invitations, session revalidation and billing/operational separation are implemented | External IdP/customer deployment and independent enterprise penetration proof remain; External enterprise negative test |
| DO-NS-185 Privacy | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 45 / PUSH 45 | PUSH 45 implements Site-scoped policy, notice, rights, legal-hold, incident and audit controls with truthful external-system outcomes | Counsel-approved notices and authorized real deletion/export/incident exercises; External privacy/legal review and authorized lifecycle proof |
| DO-NS-186 Compliance readiness | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 45 / PUSH 45 | PUSH 45 adds the legal matrix, data inventory, supplier governance, counsel handoff and internal technical evidence while preserving pending approvals | Written jurisdictional decisions, processor contracts and independent assessment; Independent compliance readiness review |
| DO-NS-187 Dependency/license inventory | PARTIAL | PARTIAL | PUSH 50 / PUSH 49 | Dependency/security scans and CI foundations | SBOM, licenses and remediation evidence; Reproducible clean inventory review |
| DO-NS-188 Acquisition-grade documentation | PARTIAL | FOUNDATION | PUSH 50 / PUSH 49 | Canonical reports, matrices and runbooks | Reconcile all final evidence; Independent DD reader can reproduce claims |
| DO-NS-189 IP/ownership | PLANNED | NOT STARTED | PUSH 50 / PUSH 49 | No complete chain-of-title proof | Contributor/vendor/license ownership file; Legal DD sign-off |
| DO-NS-190 Clean release process | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 50 / PUSH 49 | Canonical release preflight and scoped commits | Sustained release history and rollback evidence; Independent clean release/rollback exercise |

### IDENTITY / BIOMETRICS

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-191 Face detection | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | Person detection does not prove a face detector; no supported face-detection benchmark exists | Implement a purpose-limited detector separately from recognition, matching and identity; Approved representative benchmark with false-positive/false-negative and human-review evidence |

### ENTERPRISE INVESTIGATION & INTELLIGENCE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-192 Vehicle re-identification | PLANNED | NOT STARTED | PUSH 48 / PUSH 48 | Vehicle detection, LPR and vehicle search do not prove cross-camera vehicle Re-ID | Implement uncertainty-aware cross-camera vehicle similarity and correlation; Authorized multi-camera benchmark with false-match handling |

### ENTERPRISE INTEGRATION OUTPUT

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-193 Gan Batuach Management integration contract | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 42 / PUSH 47 | PUSH 42 publishes the separate-domain role/capability contract and preserves the dedicated disabled-by-default Site-status adapter | Exercise isolated Garden/Site role matrix and authorized Evidence/Investigation path after PUSH 45 approval; Garden/Site role matrix, negative tests, reviewed Event and authorized playback/investigation E2E |
| DO-NS-194 OEM partner and end-customer hierarchy/provisioning | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 43 / PUSH 51 | Canonical partner/customer/Site hierarchy and synthetic idempotent provisioning proof; no real customer | Real partner provisioning, support ownership, contract and operational proof; Independent partner provisions isolated customers through supported contracts |

### AI INFRASTRUCTURE / ECONOMICS

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-195 Partner usage metering and commercial settlement | PARTIAL | PARTIAL | PUSH 40 / PUSH 49 | Partner account, usage-classification and reconciliation foundations are implemented; partner hierarchy, contractual settlement and external proof remain | Complete PUSH 42 API identity, PUSH 43 partner hierarchy/provisioning and contract-backed settlement without controlling partner retail pricing; Sandbox reconciliation followed by limited authorized partner billing proof |
| DO-NS-196 Monthly cost ceiling compliance | PARTIAL | FOUNDATION | PUSH 49 / PUSH 49 | Resource attribution exists; invoices, shared allocation, taxes, FX, registered-user denominator and active-paying-user denominator are not reconciled | Calculate separately the historical infrastructure-cost/registered-user target and current all-in/active-paying-user ceiling; neither may substitute for the other, and their final relationship requires owner decision; Invoice-backed results for both ₪15 ratios, explicit numerator/denominator definitions, peak forecasts, caps/alerts and break-even evidence |

### SCALE

| ID / יכולת | מצב | סטטוס מקור | בעל מימוש / בעל הוכחה | ראיה קיימת | חסר / תנאי הוכחה סופית |
|---|---|---|---|---|---|
| DO-NS-197 Consumer and SMB self-service commercial activation | PARTIAL | IMPLEMENTED — NEEDS REAL PROOF | PUSH 40 / PUSH 47 | Self-service trial, approved-plan checkout intent, provider callback, entitlement, cancellation/refund and billing-history contracts are implemented; external provider and customer proof are absent | Approved provider/prices/legal process, sandbox receipts, support operations and real least-intrusive external activation remain; Authorized limited production customer completes signup-to-monitored-site journey with support and billing reconciliation |

## ספירה וגבולות

{"PARTIAL": 137, "VERIFIED": 24, "BLOCKED": 1, "PLANNED": 35}

24 VERIFIED היסטוריים בלבד; 137 PARTIAL; 35 PLANNED; 1 BLOCKED במיפוי המילולי. MISSING ברמת תחום הביומטריה מציין יכולת נדרשת שאינה פעילה/מוכחת, ואינו משנה Stable IDs או מצב PLANNED הקנוני. אין אחוז השלמה כולל, ואין קביעה שכל 52 הפושים הושלמו.
