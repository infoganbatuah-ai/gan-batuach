# DIGITAL OBSERVER OBSERVABILITY MATRIX

## Scope

PUSH 27 provides a read-only, admin-authorized operational view of the current canonical Product stack. It deliberately consumes existing stable data contracts; it does not alter Camera, Connector, Gateway, relay, stream, enrollment, or device-identity behavior.

| Domain | Signals/read model | Metrics | Bounded errors / alerts | Dashboard | SLO catalog | Regression gate |
|---|---|---|---|---|---|---|
| Camera / connection | `digital_observer_camera_sources` | sources; degraded/offline | `CAMERA_OFFLINE_OR_DEGRADED` | Admin observability | Camera availability | observability contract; existing camera QA |
| Stream | existing camera last-seen/health data only | last activity | `NO_FRAMES`, `STREAM_STALE` are reserved until a stable non-frozen source exposes them | Camera / connection panel | Camera availability | existing Gateway/hardware registry |
| AI / inference | Event/Journals projection | observed events; pending review | `INFERENCE_FAILURE` taxonomy | Event / Journal panel | Event delivery latency | Event + inference QA |
| Event / Journal | `observer_intelligence_signals` | events observed; pending review | `EVENT_VALIDATION`, `OUTBOX_DELIVERY` taxonomy | Event / Journal panel | Event delivery latency | event journal / ingest / outbox |
| Incident | `observer_correlated_events` | total; open | `INCIDENT_CORRELATION` taxonomy | Incident panel | Incident processing | incident QA |
| Evidence / storage | `digital_observer_event_clips` | records; failed/expired | `EVIDENCE_UNAVAILABLE` | Evidence panel | Evidence availability | media + compatibility QA |
| Context / baseline | `observer_site_learning_profiles` | profiles; stale | `BASELINE_STALE` | Context / Baseline panel | Baseline refresh | baseline QA |
| Risk / verification / decision | canonical evaluation tables | evaluations; verifications; suppressions | `AUTHORIZATION`, `DB` taxonomy where surfaced | Risk / Verification / Decision panel | Decision latency | risk + verification QA |
| Rules / investigation / feedback | canonical rule and feedback tables | evaluations; matches; feedback revisions | `RATE_LIMIT`, `AUTHORIZATION` taxonomy | Rules / Search / Feedback panel | API availability | watch-rule, investigation, feedback QA |
| API / database | bounded successful read-model dependency status; service readiness | configured modes; dependency availability | `DB`, `UNKNOWN` | API / Database panel | API availability | API/security QA |
| Providers | `digital_observer_notification_deliveries` | deliveries; failures | `PROVIDER_DELIVERY_FAILURE` | Providers panel | Provider delivery (internal) | provider-specific QA when enabled |
| Release / version | environment revision/deployment metadata | version/context only | schema state is explicit | Version card | Release reproducibility | CI release contract |

## Model and boundaries

- Health is one of `HEALTHY`, `DEGRADED`, `UNAVAILABLE`, or `UNKNOWN`. Missing telemetry is `UNKNOWN`, never `HEALTHY`.
- Metrics are bounded aggregates with a collection timestamp. Event IDs, raw URLs, search text, credentials, and media are excluded from metric labels and the diagnostic snapshot.
- Operational alerts are derived from bounded error categories and deduplicated by `domain:category`. They are separate from customer-facing security Incidents and do not send customer notifications.
- The admin page and `/api/digital-observer/admin/observability` require server-side Digital Observer admin authorization. Tenant users do not receive cross-tenant aggregates.
- The snapshot is read-only and has no dependency on a telemetry sink. If a source query fails, the affected domain is `UNKNOWN` while Event, Incident, Evidence, and Decision processing continue independently.

## Canonical error taxonomy

| Category | Component | Meaning | Typical safe next action |
|---|---|---|---|
| `CAMERA_AUTH` | Camera / connection | camera credential/authorization failure | verify configured credential through approved onboarding flow |
| `CAMERA_OFFLINE` / `NO_FRAMES` / `STREAM_STALE` | Camera / stream | no progressing source data | inspect source health; do not restart a frozen runtime from this dashboard |
| `INFERENCE_FAILURE` | AI | inference dependency failed | inspect bounded AI/runtime error and readiness |
| `EVENT_VALIDATION` / `OUTBOX_DELIVERY` | Event / Journal | Event rejected or delivery delayed | inspect validation/queue status and retry policy |
| `INCIDENT_CORRELATION` | Incident | correlation processing failed | inspect canonical incident correlation logs/tests |
| `EVIDENCE_CAPTURE` / `EVIDENCE_UPLOAD` / `STORAGE` | Evidence | capture, upload, or persistence problem | inspect evidence state; never expose media URL/credentials |
| `AUTHORIZATION` / `RATE_LIMIT` | API | access or request protection denied | verify role/scope and bounded endpoint policy |
| `DB` | API / database | database/read-model dependency unavailable | verify database health and retryability |
| `PROVIDER` | Providers | configured provider delivery degraded | verify provider mode and safe credentials |
| `UNKNOWN` | Any | insufficient safe telemetry | do not assert a healthy state; investigate data availability |

## Operational alert policy

Alerts are internal operational records/views, not security risk decisions. They carry first/last seen, count, severity, and retryability. Repeated instances are represented by one stable dedupe key and updated count. Resolution is inferred when the next snapshot no longer emits that category; no periodic customer messaging is performed.

## Runbook linkage

| Symptom | Dashboard signal | Safe diagnostic | Next action |
|---|---|---|---|
| Camera appears offline | Camera health degraded | check latest existing health/last-seen | use approved reconnect/onboarding action; do not alter Gateway during PUSH 16 freeze |
| Evidence unavailable | `EVIDENCE_UNAVAILABLE` | inspect clip state and retention | use normal evidence retry/retention workflow |
| No new events | Event / Journal has stale/unknown activity | inspect canonical Event/Journal health | validate ingestion/outbox contract before remediation |
| Database uncertainty | API / Database is unknown | inspect safe API health and database error category | recover dependency; telemetry itself must not block processing |
| Provider failures | `PROVIDER_DELIVERY_FAILURE` | inspect provider mode/status only | keep provider disabled/sandboxed until safely fixed |

## Current roadmap constraints

- PUSH 16 remains `BLOCKED — INDEPENDENT REAL SOURCE REQUIRED`; it is a hardware-verification roadmap state, not an operational-health fault.
- The PUSH 25 billing-role RLS finding remains `DEFERRED — FROZEN AREA`. API-layer mitigation remains in effect. The permanent policy split is deferred until PUSH 16 closes.
- The PUSH 25 security/privacy migration is pending and has not been applied to Production. This observability work does not require it and is not deployed.
