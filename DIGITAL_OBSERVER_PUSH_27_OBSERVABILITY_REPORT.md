# DIGITAL OBSERVER — PUSH 27 OBSERVABILITY REPORT

## FINAL STATUS

PASS — DONE EARLY

## ROADMAP STATE

- PUSH 1–15: done.
- PUSH 16: `BLOCKED — INDEPENDENT REAL SOURCE REQUIRED`.
- PUSH 24 and PUSH 25: done early.
- PUSH 27: executed early with no Production deployment.
- The PUSH 25 security/privacy migration remains unapplied to Production and this work does not depend on it.

## OBSERVABILITY INVENTORY

Existing foundations include bounded health endpoints, camera/source health data, Event/Journal and outbox records, canonical Incident/Evidence/Risk/Verification/Decision tables, provider delivery records, Sentry configuration, admin authorization, and release metadata. They were fragmented across domain screens and logs. PUSH 27 adds one read-only operational projection over these stable interfaces.

## CANONICAL TELEMETRY MODEL

`lib/domain/digital-observer/operational-telemetry.ts` defines a normalized health, metric, bounded error/issue, operational-alert, and snapshot contract. Health supports `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, and `UNKNOWN`. A failed or unavailable query produces `UNKNOWN`; it never produces a false healthy claim.

## OPERATIONAL DOMAINS

The snapshot covers Camera/Connection, Event/Journal, Incident, Evidence/Storage, Context/Baseline, Risk/Verification/Decision, Rules/Search/Feedback, Providers, and API/Database. Each records a safe last-activity marker, aggregate metrics, data availability, and bounded issues where current data supports them.

## CAMERA / STREAM READ MODEL

The read model consumes existing camera-source status, health status, and last-seen fields only. It does not open streams, change sampling, modify relays, or change the Gateway/Connector. Stream-specific `NO_FRAMES` and `STREAM_STALE` remain documented taxonomy categories until an existing stable non-frozen source exposes them.

## AI / EVENT / INCIDENT

Existing real Event/Journal and canonical Incident projections supply observed-event, pending-review, Incident-total, and open-Incident counts. The model is operational only: it does not use detection volume as a quality/risk score and does not tune AI, Risk, or Decision logic.

## EVIDENCE

Existing Evidence metadata supplies record and unavailable/expired counts. The snapshot excludes media bytes, object paths, signed URLs, and credentials. The dashboard distinguishes unavailable Evidence from a healthy state without exposing private media.

## CONTEXT / BASELINE

Existing learning-profile status supplies profile and stale counts. The model does not inflate baseline maturity or infer anomaly quality from activity volume.

## RISK / VERIFICATION / DECISION

The model presents separate counts for Risk evaluations, Verification records, and suppressed Decision intents. It preserves the separation between operational health, detection confidence, Verification confidence, Risk, and customer security severity.

## RULES / INVESTIGATION / FEEDBACK

Rule evaluation/match and feedback-revision aggregates are visible without raw natural-language input, feedback notes, or investigation query text. This maintains privacy and avoids unbounded telemetry cardinality.

## API / DATABASE

API/Database health is derived only from successful bounded read-model dependencies. If those reads cannot be completed, the state is `UNKNOWN`, not healthy. The projection does not expose SQL, row contents, or raw database errors.

## PROVIDERS

Provider delivery totals and bounded failure counts are displayed only from existing delivery records. Provider mode remains truthful; this work does not enable a provider or send a message.

## VERSION / RELEASE

The admin view includes bounded app revision, environment, deployment identifier when present, and an explicit `PUSH_25_MIGRATION_PENDING` schema state. It does not expose private environment values.

## SLI / SLO CATALOG

`DIGITAL_OBSERVER_SLI_SLO_CATALOG.md` records measurable operational indicators, timing markers T0–T9, explicit low-sample safeguards, and internal/non-contractual status. No invented enterprise SLA is claimed.

## END-TO-END LATENCY

Existing source, Event, Incident, Risk, Verification, Decision, and Evidence timestamps are mapped to T0–T9. Missing timestamps remain unavailable rather than becoming fabricated latency measurements. Percentile targets are deferred until retained samples exist.

## ERROR TAXONOMY

The operational taxonomy defines bounded categories including Camera/Auth/No Frames, Inference, Event Validation/Outbox, Incident Correlation, Evidence/Storage, Authorization/Rate Limit, DB, Provider, and Unknown. Raw provider/credential errors remain out of the dashboard and diagnostic API.

## STRUCTURED LOGGING

The new read model logs only read availability and bounded error type/category. The diagnostic snapshot contains only aggregates and safe state. It excludes credentials, signed media URLs, RTSP URLs, raw request bodies, PII, and media.

## DASHBOARDS

An authorized internal admin can open `/digital-observer/admin/observability`. The screen shows aggregate system/domain health, metrics, derived operational alerts, version/schema state, and clear boundary notices. The safe API endpoint is `/api/digital-observer/admin/observability`, requires authenticated server-side admin claims, and uses `private, no-store` caching.

## OPERATIONAL ALERTS

Alerts are derived read-only from bounded issues and deduplicated by `domain:category`; they show count, first/last seen, retryability, and operational severity. They are explicitly not customer security alerts, do not alter Risk/Decision, and do not send providers.

## TENANT / PRIVACY

The admin page and API are server-authorized. Tenant users do not receive aggregate cross-tenant telemetry. Metric labels do not include high-cardinality Event IDs, raw queries, URLs, or secret values. No personal names, email, phone, feedback notes, media, or camera credentials are selected.

## PERFORMANCE OVERHEAD

The snapshot makes bounded, parallel, read-only queries with explicit column lists and a 1,000-row maximum per current projection. It runs only when the authorized dashboard/API is requested. It is outside Event, Incident, Evidence, and Gateway processing paths; no recurring telemetry job or per-frame instrumentation was added.

## TELEMETRY FAILURE BEHAVIOR

Read failures are contained per domain and produce `UNKNOWN`. They are caught and logged with a bounded label/error type. Core Product processing does not await this dashboard projection, so a telemetry/database-view failure cannot block Event, Incident, Evidence, Risk, Verification, or Decision work.

## RUNBOOKS

`DIGITAL_OBSERVER_OBSERVABILITY_MATRIX.md` links Camera Offline, Evidence Unavailable, Event/Journal uncertainty, Database uncertainty, and Provider failures to safe diagnostics. It explicitly forbids treating the dashboard as a mechanism to restart/modify frozen Gateway behavior.

## CURRENT HOME PIPELINE READ-ONLY RESULT

The public Production health endpoint returned HTTP 200 with `app: ok` and `supabase: ok` on a single read-only request. The new projection is designed to surface existing camera-source association, current source health/last-seen, and downstream Event state without opening a DVR session. No real Gateway connection, relay, Journal owner, source configuration, or camera session was touched in this PUSH. A production-mutating assessment script was intentionally not used because it persists assessment state and this PUSH permits read-only verification only. The new admin view itself is not deployed in this early push.

## PUSH 25 DEFERRED FINDING PRESERVED

The HIGH billing-role RLS finding remains explicitly visible only to authorized operational/admin context as `DEFERRED — FROZEN AREA`. It is not marked resolved. API-layer mitigation remains the current boundary; the durable RLS policy split is scheduled after PUSH 16 closes.

## TEST MATRIX

| Check | Result |
|---|---|
| Observability contract (21 assertions) | PASS |
| Typecheck | PASS |
| Canonical lint | PASS — 0 canonical errors/warnings; repository baseline unchanged at 5,355 errors / 213 warnings |
| Production build | PASS — optimized Production build completed; no deployment |
| Domain regression gate | PASS — 18/18 |
| Security gate | PASS — 9/9, including observability authorization/scrubbing contract |
| Migration health | PASS — 191 migrations; 0 duplicate timestamps; one pre-existing allowed duplicate-name warning |
| Release contract | PASS — clean/dirty/secret/wrong-project contract cases |
| Release preflight for this worktree | correctly rejected the deliberately dirty worktree; no release attempted |
| Dependency audit | no high/critical findings; 6 moderate findings remain in Firebase Admin transitive dependency chain |
| Frozen Camera/Connector/Gateway material diff | 0 for PUSH 27 implementation |
| Production deployment | not performed |

## FROZEN AREA DIFF

`FROZEN AREA DIFF = 0` for PUSH 27. Changes are Product-side telemetry, authorized admin read views, CI manifest coverage, and documentation only. There is no material Camera/Connector/Gateway runtime change.

## PUSH 27 REVALIDATION RULE

When sequential execution reaches PUSH 27 after PUSH 17–23, revalidate the deterministic contract and extend the model only for newly stable Connector/Fleet/Camera health interfaces. Do not claim a rebuilt or changed Gateway path from this early completion.

## NEXT ROADMAP STATE

PUSH 16 remains blocked pending an independent safe real RTSP/ONVIF source. PUSH 27 is complete early; no deployment occurred.

PUSH 27 CANONICAL STATUS:

DONE EARLY

WHILE PUSH 16 REMAINS BLOCKED, IS THERE ANY OTHER FULL CANONICAL PUSH RECOMMENDED FOR EARLY EXECUTION?

NO
