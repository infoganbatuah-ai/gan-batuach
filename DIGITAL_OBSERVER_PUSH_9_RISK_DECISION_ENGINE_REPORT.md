# DIGITAL OBSERVER — PUSH 9 RISK + DECISION ENGINE REPORT

## FINAL STATUS

`FAIL — REAL INCIDENT VERIFICATION`

The canonical deterministic Risk and Decision architecture is implemented, migrated, deployed, regression-tested, and verified against persisted `REAL_CAMERA_AI` incidents in Production. A controlled Production rule also affected a real incident exactly as configured, with no external action.

The mandatory fresh physical scenario did not produce a new `person_entered`/Incident during the active verification window. It produced one genuine `person_detected` only. Existing safety semantics correctly refused to turn that low-level detection into a spatial Incident. Because PUSH 9 explicitly requires a fresh real Incident to travel through the newly deployed ingest path, PASS is not claimed.

## EXISTING RISK INVENTORY

| Existing concept | Previous role | Classification after PUSH 9 |
| --- | --- | --- |
| Event `confidence` | Detector certainty | ACTIVE FACT; never a Risk score |
| Event/Incident `severity` | Factual/event presentation priority | ACTIVE but separate from canonical Risk |
| Schedule/off-hours context | Factual local-time context | ACTIVE/PARTIAL; pilot schedule remains draft |
| Watch-request `priority` | Structured policy priority | ADAPTED as an explicit deterministic input only |
| Push 8 deviation signals | Baseline context | ACTIVE with maturity guardrails |
| `observer_intelligence_signals.risk_score` and legacy intelligence fields | Older event-level scoring | LEGACY/PARTIAL; not canonical Incident Risk |
| Kindergarten predictive-risk profiles/signals | Separate Gan Batuach domain | ACTIVE IN ITS DOMAIN; not reused for the standalone Observer |
| Notification priority/severity | Delivery concern | DOWNSTREAM; not canonical Risk |

There is one new canonical Digital Observer engine. Legacy fields were not destructively migrated or silently treated as equivalent.

## CANONICAL RISK MODEL

The new contract is Incident-level and deterministic:

`Canonical Event + Incident + Context + Baseline + Explicit Structured Rules → Risk Evaluation → Decision Intent`

Output includes:

- `risk_score` from 0–100;
- `risk_band`: `LOW`, `GUARDED`, `ELEVATED`, `HIGH`, or `CRITICAL`;
- evaluation confidence, separate from detector confidence;
- contributing and mitigating factors with factual evidence;
- matched rule IDs and versions;
- baseline maturity/version;
- engine/factor/decision versions;
- current and historical peak Risk;
- deterministic explanation and recommended decision;
- stable input fingerprint and decision dedupe key.

Versions deployed:

- Risk engine: `do-risk-v1`
- Factor set: `do-risk-factors-v1`
- Decision model: `do-decision-v1`

Risk bands:

| Score | Band |
| --- | --- |
| 0–19 | LOW |
| 20–49 | GUARDED |
| 50–74 | ELEVATED |
| 75–89 | HIGH |
| 90–100 | CRITICAL |

## FACTORS + MITIGATORS

Initial auditable factors include meaningful entry, configured off-hours, restricted-zone entry, long dwell, mature-baseline deviations, and explicit structured rules. Initial mitigators include configured expected hours, a brief ordinary passage, verified exit, and common patterns from an `ESTABLISHED` baseline.

No identity, threat, burglary, or suspicious-person assertion is made. Missing context lowers evaluation confidence rather than creating a high or low certainty claim.

Detector confidence is used only to calibrate `evaluation_confidence`. Automated QA proves that changing detector confidence from `0.98` to `0.61` does not change the Risk score.

## RISK VERSIONING

Production rows preserve:

- Incident and triggering Event IDs;
- Risk, factor, and Decision versions;
- baseline version and maturity;
- rule versions;
- evaluation timestamp;
- immutable factors, mitigators, explanation, and input fingerprint;
- previous evaluation reference where applicable.

The unique Production constraint `(incident_id, triggering_event_id, risk_engine_version)` prevents duplicate evaluations of the same Event under the same engine version.

## DECISION MODEL

The downstream canonical decisions are:

- `IGNORE`
- `LOG_ONLY`
- `PRESERVE_EVIDENCE`
- `VERIFY`
- `NOTIFY_IN_APP`
- `ESCALATION_CANDIDATE`

Risk evaluation, Decision intent, and future Action execution remain separate. `external_execution_enabled` is constrained to `false` in this PUSH. No SMS, WhatsApp, phone call, email, push, or other external escalation was activated.

`PRESERVE_EVIDENCE` is emitted only when the Event was already recording-authorized. Risk cannot grant recording permission.

## REAL HOME SCENARIOS

### Normal real entry

Persisted real Event `e1e5c435-a94a-4660-98aa-dc63c94fde6e`, Incident `33f58fa1-11c8-4b46-81c6-31c904eee844`:

- provenance: `REAL_CAMERA_AI`;
- detector confidence: `0.929`;
- Risk: `15 / LOW`;
- evaluation confidence: `0.6752`;
- Decision: `LOG_ONLY`;
- no matched rule;
- baseline: `LEARNING`;
- explanation: ordinary entry preserved without dramatic security language.

### Closed real entry/exit passage

Real Incident `8b7fe035-8011-4550-ba9f-26a4e6ab03d4` contains:

- entry Event `f24f7f2f-f282-48ae-977b-339e305f3fb4`;
- exit Event `76f5489e-a28d-4096-b6df-aecd7d7df140`;
- same Track ID, camera, site, and real provenance;
- duration: 42 seconds;
- mitigating factor: `brief_resolved_passage -8`;
- final Risk: `7 / LOW`;
- Decision: `LOG_ONLY`.

The historical pair was evaluated after it was already closed, so it proves real-input mitigation but is not represented as a live chronological Risk history. Automated tests separately prove current Risk can decrease while historical peak Risk is retained.

### Fresh physical regression window

Active window: `2026-09-06T00:00:06.594Z` to `2026-09-06T00:03:11.592Z`.

Fresh real Event:

- Event ID: `baa5bd3a-26c9-4282-be66-15227d4d4bd8`;
- type: `person_detected`;
- confidence: `0.833`;
- provenance: `REAL_CAMERA_AI`;
- source: channel 11 / `e9f8abf3-5895-494e-b1cf-ea8818602851`;
- stream: `dvr_84e4cdf200faab18d9_11`;
- Track ID: `7d6ab55c-e56d-4ef4-9d26-d3590650e563`.

No spatial crossing was qualified, so no new Incident or Risk was created. This is correct safety behavior but does not satisfy the fresh Incident acceptance criterion.

## BASELINE MATURITY TEST

Production pilot baseline:

- version: `v1_real_camera_event_context`;
- maturity: `LEARNING`;
- confidence: `0.34`;
- real Event count after the fresh check: `318`.

Result: PASS. Baseline deviation contributed zero Risk. The explanation explicitly states that baseline influence was limited because maturity is `LEARNING`. The draft schedule also caused expected-hours context to be reported as incomplete and lowered evaluation confidence.

## STRUCTURED RULE TEST

A temporary, camera-bound, deterministic rule was created solely for this controlled test, applied to persisted real Event `2bd87866-4148-45bb-b432-283db291e6d0`, and immediately disabled.

Resulting Production evaluation:

- Incident: `541a641d-edeb-40c9-a9cf-f594f47ddf18`;
- evaluation: `2355ce59-4f49-49e2-b5f6-45fbf54ccf75`;
- Risk: `27 / GUARDED`;
- evaluation confidence: `0.5763`;
- Decision: `VERIFY`;
- rule contribution: `+12`;
- explicit minimum Risk: `25`;
- external action executed: NO.

The persisted explanation states both the factual entry and the exact matched structured rule. Existing free-text watch requests were intentionally not interpreted as Risk rules.

## RISK EVOLUTION

The engine supports multiple immutable evaluations for one evolving Incident, current Risk, peak Risk, and previous-evaluation linkage. Event-level idempotency prevents duplicate replay history.

The fresh physical run did not create a new Incident sequence, so live Production evolution from open entry to closed exit was not re-demonstrated in this PUSH. The existing real closed Incident and automated state-transition tests cover the deterministic logic without fabricating Production Events.

## DE-ESCALATION

PASS in deterministic QA and real persisted closed-Incident evaluation:

- verified normal exit can lower current Risk;
- a 42-second closed passage received `brief_resolved_passage -8`;
- historical peak is retained in chronological engine tests;
- previous evaluations are never rewritten.

## EXPLAINABILITY

Every Production evaluation includes Hebrew user-facing language, factual reasons, mitigations, uncertainty, factor arithmetic, matched rules, baseline state, and engine versions.

Examples verified:

- `15 / LOW`: “האירוע נראה שגרתי לפי המידע הזמין ונשמר ביומן.”
- `27 / GUARDED`: “מומלץ לבדוק את האירוע והראיות.”
- uncertainty explicitly reports `LEARNING`, incomplete expected-hours context, and unavailable evidence where relevant.

No LLM generates the score or final Decision.

## EVIDENCE/POLICY INTERACTION

PASS. Risk can propose evidence preservation only when the triggering Event already carries recording authorization. With authorization false, automated QA proves `PRESERVE_EVIDENCE` is absent regardless of Risk. Existing no-recording, retention, source-anchor, and tenant controls remain authoritative.

## REAL INCIDENT E2E

Production verification achieved on existing real Incidents:

`REAL_CAMERA_AI Event → Canonical Incident → Context/Baseline → Risk Evaluation → Decision Intent → Production DB → Authorized Product API`

The fresh physical regression achieved only:

`REAL PERSON → REAL_CAMERA_AI person_detected`

It did not achieve a fresh `person_entered → Incident`, which is the sole reason for the final FAIL classification.

## PRODUCT UI

The deployed Incident page now renders:

- Risk score and band;
- current Decision;
- evaluation confidence;
- baseline maturity;
- peak Risk;
- factors, mitigators, uncertainty, and versions;
- explicit wording that detector confidence is not Risk.

Authorized Production API verification using the signed Digital Observer admin role returned the real Incident `541a641d-edeb-40c9-a9cf-f594f47ddf18`, `27 / GUARDED`, `VERIFY`, `LEARNING`, and a complete explanation. The dedicated admin read path excludes kindergarten sites and does not select media credentials, stream URLs, camera secrets, or raw media.

The user's previous browser session had expired at visual-verification time, so no authenticated owner-page screenshot is claimed. This did not prevent normal authorization and product-rendering contract verification.

## ADMIN/AUDIT VIEW

PASS through the bounded Production incident API. A signed `digital_observer_admin` can inspect safe Risk inputs and outputs across standalone Observer sites. The endpoint exposes no external execution control and no secret/media fields. Ordinary unrelated QA users remained denied with HTTP 403, proving the boundary was not opened broadly.

## TEST MATRIX

| Test | Result | Evidence |
| --- | --- | --- |
| TypeScript typecheck | PASS | `tsc --noEmit` |
| Focused lint | PASS | all PUSH 9 production/QA files |
| Risk/Decision QA A–M | PASS | confidence separation, factors, maturity, rules, de-escalation, dedupe, provenance, privacy |
| Incident QA | PASS | correlation, timeline, idempotency, boundaries |
| Event Journal/Ingest/Outbox/Inference/Media | PASS | complete `qa:event-journal` suite |
| Product Observer real-source isolation | PASS | mock/shadow rejected |
| Context/baseline QA | PASS | timezone, maturity, isolation, invalidation |
| Real detection/Event bridge | PASS | two-frame qualification and mock rejection |
| Tracker/temporal configuration | PASS | remapping, directional evidence, no duplicate crossings |
| Storage policy safety | PASS | 6 PASS, 0 FAIL; remote storage verification remains inherited from PUSH 7 |
| Observer engine separation | PASS | 15/15 privacy routing tests |
| Tenant boundary | PASS | 15/15 |
| Persistent Gateway safety | PASS | installer/runtime safety |
| Production build | PASS | Next.js 16.3.2, 481 routes/pages, Production environment safety |
| Production health | PASS | HTTP 200 |
| Production DB migrations | PASS | Risk schema and Event-level idempotency index applied to project `kuaywzvucllxjsxarogb` |
| Production idempotency retry | PASS | one evaluation and two distinct intended intents; no duplicates |
| Structured rule on real Event | PASS | `27 / GUARDED → VERIFY`, rule disabled after test |
| Authorized Production Risk read | PASS | signed Observer admin; unrelated user denied |
| Fresh real Incident | FAIL | fresh run produced `person_detected`, not `person_entered` |

Production deployment:

- Deployment ID: `dpl_FWsbAkytgRQKgsKPCrFtxRLyLLzW`
- Deployment URL: `https://gan-batuach-2wnf6ytjj-gan-batuach-s-projects.vercel.app`
- Canonical alias: `https://ganbatuach.com`
- State: `READY`
- Repository base HEAD: `22f3a53a8f4b782b750f3951f7b70fb1a15fa22b`
- Deployment included the explicitly approved current dirty working tree; it is not represented by a new Git commit.

## PUSH 10 READINESS

**ARE WE READY FOR PUSH 10 — INCIDENT VERIFICATION + FALSE-ALARM REDUCTION?**

**NO.**

The architecture, database, deterministic logic, rule integration, Product API, UI implementation, security boundaries, and Production deployment are ready. Before PUSH 10, perform one focused closure verification in which a fresh real `person_entered` Event creates/updates an Incident and automatically invokes the deployed Risk service through normal Gateway ingest. No code or threshold change is indicated; the failed fresh run contained only one low-level detection and therefore did not exercise that trigger.

Known non-blocking carry-forward items:

- Pilot expected-hours schedule remains `draft`, so off-hours is not asserted in Production.
- Baseline remains `LEARNING`; this is truthful and intentionally limits anomaly influence.
- The local Gateway's legacy cloud-learning poll logs HTTP 401, while canonical real Event ingest, persisted baseline, and Risk delivery remain operational. This should be aligned in a dedicated follow-up rather than weakening authentication.
- Broad external notification delivery remains out of scope and disabled.
