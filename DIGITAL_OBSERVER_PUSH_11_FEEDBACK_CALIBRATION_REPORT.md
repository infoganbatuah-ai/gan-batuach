# DIGITAL OBSERVER — PUSH 11 FEEDBACK + LEARNING LOOP / FALSE-ALARM CALIBRATION

## FINAL STATUS

`PASS`

PUSH 11 establishes one canonical, authorized and reversible feedback-to-calibration path. A real `REAL_CAMERA_AI` Production Incident completed the full path:

`REAL INCIDENT → RAW FEEDBACK → REVIEWED GROUND TRUTH → CALIBRATION SAMPLE → VERSION-AWARE METRIC → HUMAN-GATED RECOMMENDATION`

No model, detector threshold, Risk weight, structured rule, behavioral baseline or historical evaluation was changed automatically.

Production deployment: `dpl_3Pkso3oZpzVaQvYBpbrRFGPBjjEy`
Production host: `https://ganbatuach.com`
Repository base revision: `22f3a53a8f4b782b750f3951f7b70fb1a15fa22b` plus the explicitly approved current working tree.

## EXISTING FEEDBACK INVENTORY

| Foundation | Previous role | PUSH 11 classification / treatment |
|---|---|---|
| `observer_ground_truth_reviews` | Legacy admin/shadow review records | Reused and extended as the canonical reviewed Ground Truth history. Legacy columns remain for compatibility. |
| `learning_feedback_signals` | Legacy learning confidence signals | Preserved as legacy. It is no longer written implicitly by the normal Event review route and is not the canonical Production quality dataset. |
| Event `review_status` and Incident status | Operational acknowledgement/resolution | Kept separate from factual feedback and Ground Truth. |
| Admin observer calibration/test-center pages | Mostly shadow/synthetic calibration | Preserved as legacy/test tooling; excluded from canonical Production metrics. |
| `digital_observer_feedback_revisions` | Missing | Added as immutable raw user/operator feedback history. |
| `digital_observer_calibration_samples` | Missing | Added as reviewed, structured, versioned calibration data. |
| `digital_observer_calibration_recommendations` | Missing | Added as deterministic, human-gated recommendations. |

This avoids creating another competing Incident/Event system and prevents operational dismissal from being misread as `FALSE_DETECTION`.

## CANONICAL LABEL TAXONOMY

The canonical labels are:

- `TRUE_SECURITY_EVENT` — real and security-relevant.
- `TRUE_EXPECTED_ACTIVITY` — real, expected or harmless activity.
- `FALSE_DETECTION` — the underlying perception result was wrong.
- `FALSE_CORRELATION` — factual Events existed, but the Incident grouping was wrong.
- `FALSE_SPATIAL_EVENT` — the object was real, but the spatial entry/exit/zone conclusion was wrong.
- `UNCERTAIN` — evidence is insufficient.
- `OTHER` — bounded reason/note required as appropriate.

`TRUE_EXPECTED_ACTIVITY` and `FALSE_DETECTION` remain distinct in storage, UI, metrics and calibration signals.

## FEEDBACK MODEL

`digital_observer_feedback_revisions` records:

- Incident/Event/Verification/Decision/Evidence target and ID;
- tenant/site/camera scope;
- actor ID and profile role;
- canonical label, reason code and note (maximum 500 characters);
- previous revision and revision number;
- source UI/API, environment and Incident provenance;
- feedback contract version and idempotency key.

The current label is projected onto the canonical Incident for efficient product reads, while the immutable revision table remains the audit source.

Production feedback is accepted only for canonical `do-track-v1` Incidents with `REAL_CAMERA_AI` provenance.

## AUTHORIZATION

- Site owners and authorized owner/admin/operator members may submit feedback for their own site.
- Authorized reviewer/admin roles may promote feedback to Ground Truth.
- The Digital Observer admin claim is supported through a server-side scoped read path; the write still runs under the authenticated actor and the security-definer RPC performs the authorization check again.
- An unscoped QA user was denied access to the real pilot Incident.
- Target IDs are checked against the same Incident, site and camera context. Cross-tenant targets cannot be attached.
- Direct table mutation by authenticated clients is revoked; writes use the canonical RPCs.

During Production verification, an initial admin-read gap was found: the API and linked Incident review page attempted to pre-read the Incident through normal-user RLS. The minimum fix uses the protected server data client only for an authenticated Digital Observer admin; ordinary users remain under RLS.

## REVISION / AUDIT HISTORY

- A correction appends a new raw feedback revision and references the previous revision.
- A corrected Ground Truth review appends a new review and marks the previous review `SUPERSEDED`; history is retained.
- Actor/reviewer IDs, role, timestamps, reason codes, versions and source are retained.
- Stable actor-scoped idempotency keys prevent repeated clicks/retries from creating duplicates.
- The real Production submit and review were both replayed and returned the same canonical IDs.

## GROUND TRUTH WORKFLOW

The workflow is explicitly separated:

1. Product feedback creates `USER_LABEL`-equivalent raw feedback only.
2. Authorized review confirms, corrects or marks the sample uncertain.
3. The reviewed label becomes canonical Ground Truth.
4. A structured calibration sample and recommendation are created.
5. No Production configuration is changed.

Legacy compatibility maps canonical labels to the old `outcome` field, but the canonical label remains authoritative and preserves the expected-activity/false-detection distinction.

## QUALITY DATASET

Reviewed samples preserve:

- site/camera and Incident/Event IDs;
- Event types and Track IDs;
- detector model/provider/version and detector confidence;
- spatial, Risk, Verification and Decision snapshots;
- evidence references;
- baseline, rule and engine versions;
- final Ground Truth and categorical decision-quality result.

Dataset version: `do-feedback-dataset-v1`.

The real sample contains one real `person_entered` Event, one real Track ID and an existing Evidence reference. It is classified as `CONTEXT_BASELINE_REVIEW` and `ALIGNED`.

## PRIVACY / DATASET BOUNDARY

- Raw media is not copied into the calibration dataset.
- Evidence is referenced under existing tenant access and retention policy.
- `raw_media_copied = false` and `training_eligible = false` are database constraints, not UI promises.
- No dataset export or automatic training job was introduced.
- Production metrics require `PRODUCTION + REAL_CAMERA_AI + REVIEWED/CORRECTED`.

## QUALITY METRICS

Current real reviewed sample size: **1**.

| Metric | Result | Denominator / qualification |
|---|---:|---|
| Reviewed Incidents | 1 | Reviewed real Production samples only |
| True security Events | 0 | n=1 |
| True expected activity | 1 | n=1 |
| False detections | 0 | n=1 |
| False correlations | 0 | n=1 |
| Uncertain | 0 | n=1 |
| False Detection Rate | 0% | 0/1 reviewed Incidents |
| Expected Activity Rate | 100% | 1/1 reviewed Incidents |
| Reviewed detection precision | 100% | 1/1 reviewed detected Incidents; not a global accuracy claim |
| Recall | Unavailable | Missed real-world Events / false negatives are not yet captured |

The product explicitly displays the sample size and warns against global accuracy claims from this dataset.

## PRECISION / RECALL READINESS

Precision can be estimated only over reviewed detected Incidents and is always reported with its denominator and version scope.

Recall cannot be calculated from detected Events alone. The data contract is ready for future known-missed-event / false-negative records, but PUSH 11 does not invent recall.

## CALIBRATION SIGNALS

Canonical mapping:

- `FALSE_DETECTION` → detector review.
- `FALSE_SPATIAL_EVENT` → camera geometry/tracking review.
- `FALSE_CORRELATION` → Incident correlation review.
- `TRUE_EXPECTED_ACTIVITY` → context/baseline and decision-alignment review.
- `TRUE_SECURITY_EVENT` → Risk/Verification validation.
- `UNCERTAIN` → evidence coverage review.

These are offline review signals, not live mutations.

## CALIBRATION RECOMMENDATIONS

The real sample produced:

- recommendation: `REVIEW_EXPECTED_ACTIVITY_DECISION_ALIGNMENT`;
- scope: camera-local;
- sample size: 1;
- confidence: 0.05;
- status: `INSUFFICIENT_SAMPLE`;
- human approval required: YES;
- Production change applied: NO.

Recommendations remain version-aware and can be scoped to global/model, tenant, site, camera or rule contexts without allowing one home's result to alter another site automatically.

## BASELINE INTERACTION

`TRUE_EXPECTED_ACTIVITY` is recorded as a bounded context/baseline review signal. A single label does not redefine normal behavior, change baseline maturity or rewrite a baseline version. Any later baseline promotion requires aggregation, validation and a versioned release.

## RISK / VERIFICATION / DECISION EVALUATION

The real reviewed Incident retained:

- Risk evaluation: `15 / LOW`;
- Risk version: `do-risk-v1`, factors `do-risk-factors-v1`;
- Verification: `CONFIRMED`, confidence `0.84`, version `do-verification-v2`;
- final Decision: `LOG_ONLY`, version `do-final-decision-v1`;
- feedback/decision quality: `ALIGNED`.

The Production E2E compared the latest Risk and Verification IDs/values before and after feedback. They were unchanged. Historical Risk was not rewritten.

## VERSIONING

Every reviewed sample stores a version snapshot for:

- detector model and runtime;
- Risk engine and factor set;
- Verification engine;
- Decision engine;
- behavioral baseline;
- matched structured rules;
- feedback and Ground Truth contracts.

The real sample references `ssd_mobilenet_v1_10` on `onnxruntime-node`, `do-risk-v1`, `do-verification-v2`, `do-final-decision-v1` and baseline `v1_real_camera_event_context`.

## PRODUCT UX

Incident detail now provides ordinary-language actions:

- אמיתי ודורש תשומת לב
- אמיתי אבל צפוי
- זיהוי שגוי
- קיבוץ תקרית שגוי
- מעבר או אזור שגוי
- לא בטוח

The confirmation text states that feedback was saved for controlled improvement and does not imply instant learning.

An authorized server-rendered Production verification passed for both:

- the Incident feedback panel, including current feedback and reviewed Ground Truth;
- the Admin Quality view, including reviewed count, label distribution, sample size, version-aware calibration, unavailable Recall and the blocked automatic Production-change gate.

Native Chrome automation could not attach because the Mac was locked; the existing authenticated Product login and server-rendered routes were used instead. Authorization was not bypassed.

## ADMIN QUALITY VIEW

The minimal internal view exposes:

- reviewed count and canonical label distribution;
- false-detection and expected-activity rates with denominators;
- reviewed-only precision and truthful Recall availability;
- verification alignment and decision mismatch categories;
- pending raw feedback;
- calibration samples and human-gated recommendations;
- version groups and the safe learning gate.

The admin navigation links to this view, and review links can open the exact real Incident.

## SAFE LEARNING GATE

The enforced path is:

`FEEDBACK → REVIEWED GROUND TRUTH → CALIBRATION SAMPLE → RECOMMENDATION → HUMAN/RELEASE APPROVAL → VERSIONED CHANGE`

The following are explicitly blocked:

- automatic model or detector-threshold mutation;
- automatic Risk-weight mutation;
- automatic structured-rule mutation;
- automatic baseline mutation from one label;
- historical Risk/Verification rewriting;
- automatic copying of raw media into a training dataset.

## REAL PRODUCTION FEEDBACK E2E

| Item | Evidence |
|---|---|
| Incident | `41e0286b-d3a2-42cb-a25a-273578d60976` |
| Site | `cc1673b8-3eb0-4785-a12c-1fb88f425a41` |
| Camera/source | `e9f8abf3-5895-494e-b1cf-ea8818602851` |
| Incident provenance | `REAL_CAMERA_AI` |
| Raw feedback | `54dca36e-716a-4292-b11b-0df96b9b3b4e` |
| Label | `TRUE_EXPECTED_ACTIVITY` |
| Ground Truth review | `b7ef1cde-727c-4299-8c49-f1f4002bd84e` |
| Calibration sample | `28fab124-6222-459e-94d1-cb5f1f7ef255` |
| Recommendation | `478354c6-ef0e-4781-b682-fd0642e4a1ee` |
| Source Event | `b7062b4d-dd11-43dd-8160-ff41a3431a89` (`person_entered`) |
| Evidence reference | `76f48b53-746e-46de-ab1a-8be28e906dae` (reference only; no media copy) |
| Idempotent submit/review | PASS |
| Unscoped user denied | PASS |
| Historical Risk/Verification unchanged | PASS |
| Automatic Production mutation | NO |
| Admin metric/UI update | PASS |

## TEST MATRIX

| Test | Result | Evidence / notes |
|---|---|---|
| Production build | PASS | Next.js build completed; 482 static pages generated; feedback API/admin routes present. |
| `npm run typecheck` | PASS | No TypeScript errors after final changes. |
| Focused ESLint | PASS | PUSH 11 API, UI, domain and QA files clean. |
| `qa:digital-observer-feedback` | PASS | Labels, RBAC, revisions, GT separation, metrics isolation, versioning, idempotency and safe gate. |
| Production feedback E2E | PASS | Real Incident completed submit → review → sample → recommendation → metrics. |
| Production authenticated UI render | PASS | Incident feedback and Admin Quality views rendered with real reviewed state. |
| Duplicate submit/review | PASS | Same IDs returned; one raw revision, one review, one sample and one recommendation. |
| Tenant boundary | PASS | Unscoped user denied; dedicated tenant-boundary suite 15/15 passed. |
| `qa:digital-observer-verification` | PASS | Verification confidence and provenance boundaries unchanged. |
| `qa:digital-observer-risk` | PASS | Risk/Decision separation, maturity, privacy and idempotency unchanged. |
| `qa:digital-observer-incidents` | PASS | Incident correlation, timeline and tenant/camera boundaries unchanged. |
| `qa:event-journal` | PASS | Journal, ingest, outbox, inference and event-media checks passed. |
| `qa:real-detection-event-bridge` | PASS | Real detection qualification and mock rejection passed. |
| `qa:product-observer-real-source` | PASS | Production truth remains real-camera only. |
| Context/baseline QA | PASS | Timezone, maturity, isolation and configuration invalidation passed. |
| Evidence compatibility QA | PASS | Source/event/media compatibility protections passed. |
| Storage policy safety | PASS | 6/6 checks passed. |
| Environment safety | PASS | Configuration safety validation passed. |
| Production health | PASS | App and Supabase both reported healthy after final deployment. |

## PUSH 12 READINESS

**ARE WE READY FOR PUSH 12 — NATURAL-LANGUAGE WATCH RULE COMPILER? YES**

The canonical feedback, reviewed Ground Truth, version-aware calibration dataset, truthful quality metrics and human-gated learning boundary are now in Production. PUSH 12 may proceed without using feedback to mutate rules automatically. The current sample is intentionally too small for accuracy or global calibration claims, and Recall remains unavailable until missed-event ground truth is introduced.

STOP: PUSH 12 was not started.
