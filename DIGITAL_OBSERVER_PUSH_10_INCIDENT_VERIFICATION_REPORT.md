# DIGITAL OBSERVER — PUSH 10 INCIDENT VERIFICATION REPORT

## FINAL STATUS

PASS

PUSH 10 established one canonical, deterministic Incident Verification layer between canonical Risk and the final product Decision. It was deployed to Production, applied to existing REAL_CAMERA_AI Incidents, verified through the authorized Production UI/API, and regression-tested without enabling external escalation or starting PUSH 11.

Production artifact:

- Git base revision: `22f3a53a8f4b782b750f3951f7b70fb1a15fa22b`
- Deployment ID: `dpl_FtYZfaCFDJ6h3xNrJY2VbyjaUN5J`
- Production deployment URL: `https://gan-batuach-1s9unv69f-gan-batuach-s-projects.vercel.app`
- Canonical aliases: `https://ganbatuach.com`, `https://gan-batuach.vercel.app`
- Production health: application and Supabase healthy
- Deployment note: the deployed artifact contains the full approved dirty worktree. There is no fabricated Git revision representing that artifact.

## EXISTING VERIFICATION INVENTORY

| Foundation | Before PUSH 10 | Decision |
|---|---|---|
| Gateway multi-frame confirmation | Active and useful | Keep as low-level factual evidence |
| Distinct source-sequence protection | Active | Keep; duplicate/replayed frames cannot add confidence |
| Journal track and directional confirmation | Active | Keep; expose bounded verification metadata |
| Incident correlation | Active canonical system | Keep; Verification updates the same Incident |
| Risk and Decision | Active canonical PUSH 9 services | Keep Risk; move final action intent after Verification |
| Source-anchor/evidence compatibility | Active | Keep as a trusted Verification input |
| Camera health/status | Active but historical health was not always attributable | Use only near event time; otherwise report `unknown` |
| Human review fields | Partial | Adapt as `required_followup`, without building a new review product |
| Mock/local_shadow/simulation | Test/shadow only | Reject from Production Verification |
| Canonical Incident Verification history | Missing | Added in PUSH 10 |

No second Incident, Risk, detector, tracker, or Evidence architecture was introduced.

## CANONICAL VERIFICATION MODEL

Canonical engine: `do-verification-v2`
Final Decision policy: `do-final-decision-v1`

Statuses:

- `UNVERIFIED`
- `LIKELY`
- `CONFIRMED`
- `UNCERTAIN`
- `REJECTED_FALSE_POSITIVE`
- `RESOLVED`

Classifications:

- `TRUE_SECURITY_EVENT`
- `TRUE_EXPECTED_ACTIVITY`
- `FALSE_DETECTION`
- `FALSE_CORRELATION`
- `OTHER_UNKNOWN`

Each immutable Verification evaluation preserves the Incident and Risk references, status, classification, confidence, confirmed and contradictory signals, reasons, follow-up, final Decision, metrics, input fingerprint, engine versions, prior Verification reference, and evaluation timestamp.

The latest result is projected onto the existing canonical Incident. Historical Verification rows remain immutable and auditable.

## INPUT SIGNALS

The canonical verifier consumes only validated `REAL_CAMERA_AI` Events tied to the same tenant/site, Incident, camera, stream, and Track scope. Its inputs are:

- unique source-frame confirmation and replay detection;
- Track continuity or fragmentation;
- directional geometry and Event sequence;
- event-time camera health where attributable;
- Evidence source/time compatibility;
- canonical Incident status and timeline;
- Risk score, Risk confidence, matched structured rules, and Risk version;
- expected-hours context and baseline maturity/version;
- recording, in-app notification, and external-action policy.

Mock, local_shadow, simulation, foreign-site, foreign-camera, invalid geometry, and mismatched Evidence inputs are rejected or explicitly contradicted. They cannot increase Production Verification confidence.

## CONFIDENCE SEPARATION

The three confidence concepts are separate in implementation, persistence, API, QA, and UI:

| Measure | Real Production example | Meaning |
|---|---:|---|
| Detector confidence | `0.759` | Confidence that the observed object is a person |
| Risk score | `15 / LOW` | Concern level for the Incident |
| Risk evaluation confidence | `0.5357` | Confidence in the available Risk/context inputs |
| Verification confidence | `0.84` | Corroboration that the factual Incident occurred |
| Final Decision confidence | `0.7183` | Confidence in the post-Verification Decision |

No code maps detector confidence directly to Risk or Verification.

## MULTI-FRAME / TRACK VERIFICATION

The Gateway Journal now supplies safe, factual Verification metadata:

- distinct source-frame lower bound;
- directional confirmation count;
- unique source sequence;
- verified source-anchor status;
- tracked duration.

For older Events without the new metadata, the verifier uses only lower bounds guaranteed by versioned Journal contracts: two distinct frames for `person_detected` and three confirmations for directional line crossing. It does not invent unobserved cloud frames.

Automated QA proved that:

- multiple distinct frames strengthen Verification;
- a duplicate/replayed frame does not;
- one stable Track strengthens Verification;
- Track fragmentation lowers confidence but does not automatically erase a real Event;
- a detection without crossing cannot become a confirmed entry;
- entry plus exit on the same Track can resolve the Verification.

## CAMERA HEALTH

Camera health affects certainty without turning a real Event into a false positive:

- healthy increases corroboration;
- degraded lowers Verification confidence;
- offline lowers confidence and prevents any implication that active monitoring continues;
- unknown remains an explicit contradiction.

Historical Incident re-evaluation does not apply today's camera health retroactively. For the historical real Incident verified in this PUSH, event-time health is therefore truthfully `unknown`.

Final local runtime check:

- Gateway status: healthy
- Active/progressing relays: `10 / 10`
- Channel 11 relay: active and progressing
- Recorder heartbeat: `25 / 25` successful, zero authentication rejection
- ONNX object detector: loaded and self-test passed
- Configured DVR channels: 16; 10 connected and 6 unavailable

Known non-blocking runtime issue: initial cloud-learning/discovery refresh logs contain authenticated `401` failures, while live relays and channel 11 remain active. Journal coverage is truthfully marked degraded for unavailable channels. This was not hidden or treated as proof of complete-site monitoring.

## FALSE-DETECTION VS EXPECTED-ACTIVITY

PUSH 10 enforces the required semantic distinction:

- a technically valid ordinary entry is a true Event, not a false detection;
- `TRUE_EXPECTED_ACTIVITY` requires configured expected-hours context and bounded Risk;
- an unavailable schedule produces `OTHER_UNKNOWN`, not an invented claim that activity is expected or threatening;
- `FALSE_DETECTION` is reserved for strict technical failure such as replayed, uncorroborated detector output;
- `FALSE_CORRELATION` is reserved for impossible source/geometry/Evidence relationships.

The v2 correction was deployed after a v1 real-data check showed that missing schedule context must not be interpreted as a security classification. The v1 row remains in immutable history; v2 is the canonical current projection.

## VERIFICATION HISTORY

Migration `20260906020000_digital_observer_incident_verification.sql` was applied additively to the intended Production Supabase project. It added:

- immutable `digital_observer_incident_verifications` history;
- unique same-version idempotency over Incident, Risk evaluation, and Verification version;
- latest Verification projection on `observer_correlated_events`;
- site-member/admin-scoped read policy with RLS enabled;
- prior-Verification linkage for audit evolution.

Re-running the same v2 evaluation returned the same Verification ID and did not create a duplicate history row or final Decision intent.

## RISK + VERIFICATION → FINAL DECISION

The canonical flow is now:

`Risk Evaluation → Incident Verification → Final Decision intent`

Pre-Verification Risk recommendations no longer create a competing final action-intent path.

Behavior verified:

- high Risk with uncertain Verification becomes `VERIFY`, not a noisy direct interruption;
- a confirmed, explicit high-priority rule can use the fast path;
- confirmed low-risk expected activity remains bounded;
- recording/privacy policy remains authoritative and cannot be overridden by Risk;
- external action execution remains disabled;
- one deterministic dedupe key prevents repeated final action intent for the same evaluation/version.

## REAL HOME SCENARIOS

### Scenario A — real normal/low-concern entry

- Event: `b7062b4d-dd11-43dd-8160-ff41a3431a89`
- Incident: `41e0286b-d3a2-42cb-a25a-273578d60976`
- Track: `7bea3075-f74f-49b6-bd07-802814fbfee8`
- Risk evaluation: `7d3b6f0e-664e-4008-b677-b0e55e249205`
- Verification: `be0f28f5-cc31-42aa-93de-1a7897689c89`
- Real provenance: `REAL_CAMERA_AI`
- Result: `CONFIRMED`, classification `OTHER_UNKNOWN`, Verification confidence `0.84`
- Risk: `15 / LOW`
- Final Decision: `LOG_ONLY`, confidence `0.7183`
- Baseline: `LEARNING`

This is a confirmed real Event with a bounded Decision. It is not labeled a false positive, expected activity, or threat when schedule context is unavailable.

### Scenario B — real person detected without crossing

- Event: `51f44586-8cd0-4911-81aa-e2f4b8cbe250`
- Type: `person_detected`
- Detector confidence: `0.803`
- Provenance: `REAL_CAMERA_AI`
- Canonical Incident links: `0`

The system did not invent `person_entered`, an Incident, Risk, Verification, or user interruption. The engine's equivalent contract test also keeps detection-without-crossing below confirmed-entry status.

### Scenario C — complete real entry/exit

- Incident: `8b7fe035-8011-4550-ba9f-26a4e6ab03d4`
- Entry Event: `f24f7f2f-f282-48ae-977b-339e305f3fb4`
- Exit Event: `76f5489e-a28d-4096-b6df-aecd7d7df140`
- Duration: `42 seconds`
- Verification: `e5394223-60e8-4930-990f-e3cb0b9a635b`
- Result: `RESOLVED`, classification `OTHER_UNKNOWN`, confidence `0.76`
- Risk: `7 / LOW`
- Final Decision: `LOG_ONLY`, confidence `0.7175`

The original Event facts and Incident were preserved; Verification updated the existing Incident instead of creating a duplicate.

## PRODUCT UI/API

Authorized Production verification was completed in the user's already authenticated Chrome session.

The Incident UI displayed:

- the correct real Incident, camera, local time, and entry Event;
- `Risk 15/100 — LOW` and `LOG_ONLY`;
- Risk confidence and baseline `LEARNING`;
- `CONFIRMED` factual Verification with `84%` confidence;
- classification `OTHER_UNKNOWN`;
- final Decision `LOG_ONLY` with `72%` confidence;
- six confirmed reasons and the explicit historical camera-health contradiction;
- `do-verification-v2` and `do-final-decision-v1` versions.

Authorization behavior:

- authenticated authorized admin/product view: PASS;
- unauthenticated Incident API: `401`;
- authenticated user without pilot-site membership: `403`;
- no authentication bypass was used.

## ADMIN/DEBUG VIEW

The authorized Incident API exposes:

- Risk evaluation history and factor explanations;
- Verification history;
- confirmed and contradictory signals;
- status, classification, confidence, and required follow-up;
- Verification and final Decision versions;
- final Decision intents and external-execution state;
- baseline maturity/version and associated Event/Incident IDs.

The RLS policy and site-scoped application queries preserve tenant/site isolation.

## METRICS FOUNDATION

The authorized API now reports a bounded metrics foundation:

- total Verification evaluations;
- confirmed/resolved real Incidents;
- uncertain/likely/unverified Incidents;
- rejected false detections;
- true expected activity;
- time to Verification.

These counts are not presented as a Production false-positive rate. Versioned v1/v2 history is intentionally retained. Historical backfill time-to-Verification measures audit delay, not live operational latency, and must not be treated as an SLA.

## REAL INCIDENT E2E

Verified Production chain:

`REAL person → REAL camera/channel 11 → ONNX → Journal person_entered → canonical Incident → Risk 15/LOW → Verification CONFIRMED/0.84 → final LOG_ONLY/0.7183 → authorized Product UI`

Evidence supporting the result:

- real Event/Incident/Risk/Verification IDs persisted in Production;
- trusted `REAL_CAMERA_AI` provenance and correct site/camera/stream/Track binding;
- multi-frame and directional geometry confirmation;
- no mock/local_shadow contribution;
- no duplicate Incident or same-version Verification/Decision intent;
- real Product UI rendering through an authorized session.

No external notification or escalation provider was enabled.

## TEST MATRIX

| Test | Result | Evidence/notes |
|---|---|---|
| TypeScript typecheck | PASS | `npm run typecheck` |
| Focused lint for PUSH 10 files | PASS | ESLint completed with no finding |
| Local Production build | PASS | Next.js 16.3.4 build completed, 481 pages |
| Vercel Preview build/health | PASS | `dpl_Dy8MSqw8nuvi4mQsGWL4TSwSH8Ue` |
| Production promotion/health | PASS | `dpl_FtYZfaCFDJ6h3xNrJY2VbyjaUN5J` |
| Incident Verification A–L QA | PASS | Confidence separation, multi-frame, replay, Track, degraded camera, detection-only, expected activity, provenance, idempotency, privacy, scope |
| Risk/Decision QA | PASS | Canonical Risk remains separate and feeds Verification |
| Incident correlation/state QA | PASS | Existing canonical Incident behavior preserved |
| Event Journal / ingest / outbox / inference / media QA | PASS | Existing real Event contract preserved |
| Real detection → Event bridge QA | PASS | Journal Event bridge remains green |
| Product Observer real source/mock isolation QA | PASS | Production truth remains real-only |
| Evidence compatibility / clip-window / storage policy QA | PASS | Source/time/privacy boundaries preserved |
| Tracker / temporal / spatial geometry QA | PASS | Directional semantics and duplicate-source protection preserved |
| Context/baseline QA | PASS | Baseline maturity and provenance guards preserved |
| Gateway safety / owner lock / persistent installer QA | PASS | Session and process ownership protections preserved |
| Production migration/RLS inspection | PASS | Table, Incident projection, unique key and one scoped read policy verified |
| Real Production Verification v2 | PASS | Verification `be0f28f5-cc31-42aa-93de-1a7897689c89` |
| Same-version idempotent rerun | PASS | Same Verification ID returned; no duplicate final intent |
| Complete entry/exit Verification | PASS | `RESOLVED`, one Incident, same Track |
| Authorized Production API/UI | PASS | Correct Incident, Risk, Verification, final Decision and reasons rendered |
| Unauthorized/wrong-scope API | PASS | `401` / `403` |
| Live Gateway final health | PASS WITH DEGRADED COVERAGE | Channel 11 and 10 relays progressing; 6 of 16 configured channels unavailable and reported truthfully |

## PUSH 11 READINESS

ARE WE READY FOR PUSH 11 — FEEDBACK + LEARNING LOOP / FALSE-ALARM CALIBRATION?

YES

The canonical deterministic Verification layer, immutable history, user-facing explanation, metrics foundation, real Incident proof, idempotency, privacy authority, and mock isolation are in place.

PUSH 11 should preserve two explicit constraints:

1. collect actual user labels before claiming a Production false-positive rate;
2. resolve the non-blocking Gateway cloud-learning/discovery `401` and unavailable-channel coverage separately, without weakening the proven channel 11 real Event path.

PUSH 10 stops here. No PUSH 11 feedback loop, Natural Language rule compiler, external escalation, face recognition, cross-camera Re-ID, SDK/OEM work, or model replacement was started.
