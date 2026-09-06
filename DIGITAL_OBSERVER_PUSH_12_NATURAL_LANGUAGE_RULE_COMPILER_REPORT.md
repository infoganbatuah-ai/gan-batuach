# DIGITAL OBSERVER — PUSH 12 NATURAL-LANGUAGE WATCH RULE COMPILER

## FINAL STATUS

`PASS`

PUSH 12 established one bounded, canonical and auditable path:

`NATURAL LANGUAGE → STRUCTURED RULE → INDEPENDENT VALIDATION → PREVIEW → EXPLICIT CONFIRMATION → VERSIONED ACTIVE RULE → REAL_CAMERA_AI EVENT → INCIDENT → RISK/DECISION → PRODUCT UI`

The real Production acceptance test succeeded with a Hebrew rule, an explicitly selected authorized camera, a fresh real `person_entered` Event, one rule match, an Incident Risk evaluation and an in-app Decision. No manual Event, seeded Event, mock/local-shadow input, arbitrary action or external provider execution was used.

Final Production revision: `0ab63107aa7d7ca02bc1ae8e4386921f88e10578`

Final Vercel deployment: `dpl_9b89bscADvBVwr7mnr7HoT2zmur9`

Canonical Production host: `https://ganbatuach.com`

Production health after deployment: application `ok`, Supabase `ok`.

## EXISTING RULE/NLP INVENTORY

| System | Previous role | Classification / PUSH 12 treatment |
|---|---|---|
| `observer_watch_requests` | Watch-request and legacy rule records | Adapted as the canonical current-rule projection, with compiler, version, validation, confirmation and match state. |
| Existing structured Risk rule input | Deterministic Risk/Decision influence | Reused. A compiled Rule contributes through the existing Risk service rather than bypassing it. |
| `/api/digital-observer/conversation` | Keyword-oriented conversational request path | Kept as a preview-only compatibility path. It does not silently activate a Production rule. |
| Legacy Product watch-request routes | Direct rule/request creation | Production-site direct creation is rejected; legacy records remain readable and explicitly labeled non-canonical. |
| Existing rules page | Structured controls and legacy watch requests | Extended with the bounded natural-language preview/confirm workflow; no broad redesign. |
| `digital_observer_watch_rule_versions` | Missing | Added as immutable version/audit history. |
| `digital_observer_watch_rule_evaluations` | Missing | Added as the rule-match/non-match audit trail tied to real Events and Incidents. |
| Mock/scenario rule fixtures | QA and demonstrations | Retained for tests only and excluded from Production real-event acceptance. |

No parallel live Rule Engine was introduced. Natural language is an input method for the existing canonical Event → Incident → Risk/Decision path.

## CANONICAL RULE MODEL

Schema version: `do-watch-rule-v1`.

The structured contract preserves:

- tenant and site scope;
- authorized camera/source and optional authorized zone;
- canonical Event type;
- site-local timezone, time windows and days;
- bounded duration where the live capability supports it;
- policy intent: `LOG_ONLY`, `PRESERVE_EVIDENCE`, `VERIFY` or `NOTIFY_IN_APP`;
- bounded priority and Risk contribution;
- original natural-language text;
- compiler version, rule version, validation and confirmation state;
- environment and safety flags;
- match count, last-match time and immutable evaluations.

The normalized rule is validated independently with a strict typed schema. Its canonical SHA-256 fingerprint binds the exact preview to the exact confirmation request.

## SUPPORTED INTENTS

Current Production compilation is intentionally bounded to capabilities backed by canonical Events:

- person entry: `person_entered`;
- person exit: `person_exited`;
- person detection is understood, but a presence-only request is not activated as a Production watch rule because `person_detected` is not currently an Incident-triggering live rule fact;
- time windows, including overnight windows;
- days of week / weekends;
- authorized camera and zone names;
- bounded policy intents through Risk/Decision.

Dwell text and durations are parsed, but live dwell activation is rejected until a canonical real-time dwell Event exists. Vehicle, face, license-plate, weapon, audio-semantic and emotional-state requests are rejected as unsupported instead of being simulated.

## COMPILER ARCHITECTURE

The compiler is deterministic and bounded for the currently supported vocabulary:

1. Normalize the untrusted Hebrew/English input.
2. Detect an allowed Event intent and bounded conditions.
3. Resolve entities only from the caller's authorized site resources.
4. Return ambiguity or unsupported capability/action when appropriate.
5. Construct a typed candidate Rule.
6. Validate it independently.
7. Produce a human preview and canonical fingerprint.
8. Require an authenticated confirmation containing that exact fingerprint.
9. Persist an active version through the protected database contract.
10. Evaluate only compatible canonical real Events.

No LLM is required at runtime for these supported intents. No generated code, SQL, URL or action is executed from user text.

## ENTITY RESOLUTION

Entity resolution is limited to cameras and zones that belong to the authenticated user's authorized site. Cross-tenant resources are never included in the compiler resource set.

The Production rule text was intentionally ambiguous against two camera labels. The compiler did not guess; the UI required explicit selection. The authorized site owner selected:

- camera: `כניסה לבית — ערוץ 11`;
- camera/source ID: `e9f8abf3-5895-494e-b1cf-ea8818602851`;
- site ID: `cc1673b8-3eb0-4785-a12c-1fb88f425a41`.

Only after that resolution did the compiler return `READY_FOR_CONFIRMATION`.

## TIME / DURATION PARSING

- Times are stored and evaluated in the site's timezone, not server UTC.
- Single-sided, bounded and overnight ranges are supported.
- Day aliases are normalized into canonical day identifiers.
- Seconds and minutes are converted to bounded numeric duration values.
- Invalid or contradictory values fail validation.
- A parsed duration does not imply live capability: dwell requests remain capability-gated until the canonical Event path supports them.

Automated QA covers Hebrew time and duration forms and site-timezone evaluation.

## VALIDATION

Validation occurs after parsing and again at persistence/evaluation boundaries. It verifies:

- authenticated actor and site access;
- tenant/site/camera/zone binding;
- canonical Event type;
- valid timezone, day/time and duration values;
- bounded consequence and priority;
- Production provenance policy;
- exact preview fingerprint at confirmation;
- state and version transitions;
- Event/site/camera compatibility at match time.

Direct legacy Product-site creation is not treated as a valid canonical compiled Rule.

## CAPABILITY GUARDS

The compiler returns explicit `UNSUPPORTED_CAPABILITY` or `UNSUPPORTED_ACTION` results instead of inventing behavior.

Rejected categories include unsupported perception, physical control, emergency calling, arbitrary webhooks/URLs and command/prompt-injection attempts. The structured contract has no field capable of carrying executable code or arbitrary destinations.

Privacy and recording policy remain authoritative. A Rule or Risk result cannot independently grant recording permission or external execution.

## AMBIGUITY HANDLING

Ambiguous camera/zone references return `NEEDS_CLARIFICATION` with authorized choices. No resource is selected merely because it is the first textual match.

This behavior was verified in the real Production UX: the initial Hebrew request produced two possible camera choices, required a user selection, and only then produced a preview.

## RULE PREVIEW / CONFIRMATION

Production preview showed:

| Field | Interpreted value |
|---|---|
| Camera | `כניסה לבית — ערוץ 11` |
| Event | אדם נכנס |
| Time | every hour |
| Days | every day |
| Duration | none |
| Policy intent | אימות ועדכון באפליקציה |

Preview fingerprint:

`17b3ed8b8cc8bf5313009e42e8672af95289939fb0e9317cacfa019ba138234e`

Preview did not activate the Rule. Activation occurred only after the authorized site owner explicitly confirmed the exact preview in the Product UI.

Active Rule ID:

`ec046821-4e53-4e53-855c-7078b31998c7`

## VERSIONING / AUDIT

- Rule state: `ACTIVE`.
- Rule version: `1`.
- Compiler: `do-watch-compiler-v1`.
- Evaluator: `do-watch-evaluator-v1`.
- Version records: `1`.
- Evaluation records after the controlled real test: `1`.
- Match count: `1`.
- Last matched at: `2026-09-06T15:43:27.186+00:00`.

Edits create a new preview and version; disable/re-enable and archive are explicit states. Historical evaluations retain their version references. Repeated confirmation/evaluation is protected by stable idempotency and uniqueness rules.

## HISTORICAL SIMULATION

Before activation, the Product calculated a read-only historical simulation over canonical real Events:

- evaluation window: previous 7 days;
- real Events evaluated: `382`;
- would-have-matched Events: `12`;
- no fixture or generated Event was included;
- no Decision/action was executed by the simulation.

The UI labels this as historical simulation rather than live execution.

## REAL RULE MATCH

A fresh real Production Event matched the active compiled Rule automatically:

| Field | Value |
|---|---|
| Rule evaluation ID | `2b2f11e6-612b-4d17-a657-2030a16874fa` |
| Event ID | `7b7d90ce-cf49-4a57-9a67-953c0f25240c` |
| Incident ID | `bdf84923-cc3b-4f31-a8ea-57de8b9edcb5` |
| Risk evaluation ID | `24c194fb-84fa-4a77-89ba-3e3e8ff694c1` |
| Event provenance | `REAL_CAMERA_AI` |
| Event time | `2026-09-06T15:43:27.186+00:00` (`18:43` site-local) |
| Matched facts | real provenance, site, camera and Event type |
| Mock/manual/seeded input | NO |
| External action | NO |

The post-deployment inspection still showed exactly one match and one evaluation, confirming that the controlled Event was not duplicated.

## RISK / DECISION RESULT

The matched Rule entered the existing Risk/Decision architecture rather than executing an action directly:

- Risk score: `23`;
- Risk band: `GUARDED`;
- Decision: `NOTIFY_IN_APP`;
- real-entry factor: `+10`;
- matched explicit watch-rule factor: `+8`;
- baseline maturity: `LEARNING`;
- verification confidence shown by Product: `86%`;
- final Decision confidence shown by Product: `74%`.

Detector confidence remained a separate perception value (`82%` in the Product Event detail). It was not copied into the Risk score.

## SECURITY / PROMPT INJECTION

- User input can populate only the bounded typed schema.
- Prompt/command-injection language, arbitrary URLs and unsafe physical/external actions are rejected.
- Resource discovery is tenant/site scoped.
- Production matching requires validated `REAL_CAMERA_AI` provenance.
- Mock, local-shadow, simulation and invalid provenance cannot satisfy Production evaluation.
- The Rule feeds Risk/Decision only; it cannot directly invoke a provider or bypass authorization.
- Exact preview fingerprints prevent confirming a changed interpretation.
- Database writes use protected RPCs and preserve fail-closed authorization.

One useful fail-closed boundary was observed: the scoped QA admin can perform safe read/preview diagnostics but cannot activate a real-site Rule unless it also has the database's required site/profile ownership or membership. Production activation succeeded through the actual authorized site owner; database authorization was not broadened to make QA pass.

## PRODUCT UX

The Production rules page now provides:

- natural-language input;
- focused camera/zone clarification when needed;
- a plain-language interpretation preview;
- explicit confirmation before activation;
- active/disabled/archived state controls;
- original text, version, compiler and match count;
- last-match time;
- truthful unsupported-capability messages;
- a separate legacy section for requests that were never compiled and confirmed.

The real matched Incident was verified in the authorized Product UI with the correct camera, local timestamp, real provenance, Risk, Decision and explanation.

## ADMIN / DEBUG VIEW

The protected admin view exposes bounded operational data:

- original text and structured JSON;
- entity resolution and validation state;
- compiler/version information;
- current state and historical versions;
- evaluations, matched conditions and non-match reasons;
- historical simulation and latest match metadata.

It does not expose credentials, raw camera URLs or arbitrary cross-tenant resources.

## REAL PRODUCTION E2E

The verified chain was:

`Hebrew request → ambiguity detected → authorized camera selected → structured preview → explicit owner confirmation → ACTIVE v1 Rule → REAL person_entered Event → Rule evaluation → canonical Incident → Risk 23/GUARDED → NOTIFY_IN_APP → authorized Product UI`

Final Production verification after the last deployment confirmed:

- deployment state `READY`;
- alias `https://ganbatuach.com` active;
- application health `ok`;
- Supabase health `ok`;
- Rule still `ACTIVE`;
- match count `1`;
- evaluation count `1`;
- no external action and no mock contribution.

## DEPLOYMENT SAFETY CLOSURE

The recurring dirty-tree deployment risk is now replaced by a durable release contract:

1. Production deploys must originate from a complete, committed, clean Git snapshot.
2. `npm run release:production:preflight` verifies the exact Vercel project binding, clean worktree, release revision/branch and rollback metadata.
3. The preflight rejects tracked secrets, local environment files, Gateway Keychain material, Supabase temporary state and private diagnostic media.
4. Database migrations are applied separately and verified before the application snapshot is deployed.
5. The exact deployment ID, Git revision and canonical alias are recorded.
6. Authenticated Production smoke and real feature verification follow each release.

This permits full releases without repeatedly accepting an unknown dirty-worktree bundle. The first complete snapshot contained the previously approved working tree and established commit `ead0dca315b192dfd7ccac0f54a9ab339b3fe2ef`; subsequent fixes were isolated in commits `40fac172a297c58b7fd96f2e78ef761c91ffa3b7` and `0ab63107aa7d7ca02bc1ae8e4386921f88e10578`. The final preflight passed with zero forbidden artifacts and zero secret-shaped tracked values.

## TEST MATRIX

| Test | Result |
|---|---|
| Supported Hebrew entry Rule compiles | PASS |
| Site-timezone time parsing | PASS |
| Duration parsing and bounds | PASS |
| Unknown/ambiguous zone or camera requires clarification | PASS |
| Unauthorized camera cannot be resolved | PASS |
| Unsupported perception/action rejected | PASS |
| Prompt injection cannot escape schema | PASS |
| Preview does not activate | PASS |
| Exact confirmation fingerprint required | PASS |
| Rule edit/version history contract | PASS |
| Disabled Rule cannot match | PASS |
| Duplicate Event/evaluation is idempotent | PASS |
| Real Event matches Production Rule | PASS — real Production E2E |
| Mock Event cannot satisfy Production path | PASS |
| Rule match feeds Risk/Decision without bypass | PASS — `23/GUARDED → NOTIFY_IN_APP` |
| Historical references remain resolvable | PASS |
| TypeScript typecheck | PASS |
| Focused ESLint | PASS |
| Watch Rule compiler QA | PASS |
| Event/Incident QA | PASS |
| Evidence/media compatibility QA | PASS |
| Context/baseline QA | PASS |
| Risk/Decision QA | PASS |
| Verification QA | PASS |
| Feedback/calibration QA | PASS |
| Journal/ingest/outbox/inference QA | PASS |
| Real detection/Event bridge QA | PASS |
| Product Observer provenance/mock isolation QA | PASS |
| Tenant/site and Observer-site selection QA | PASS |
| Environment/encryption/storage safety QA | PASS |
| Production release preflight | PASS |
| Final Production health and rule-state inspection | PASS |

## PUSH 13 READINESS

`YES`

The Product now has a bounded, independently validated and user-confirmed natural-language input path that operates only on canonical real Events and integrates with existing Incident, Risk and Decision semantics. Unsupported capabilities fail visibly, ambiguity is not guessed, and Production actions remain constrained.

PUSH 13 must remain a separate phase: natural-language search/investigation should query authorized historical Events, Incidents and Evidence without expanding this compiler into an arbitrary execution agent.

**ARE WE READY FOR PUSH 13 — NATURAL-LANGUAGE VIDEO SEARCH & INVESTIGATION? YES**
