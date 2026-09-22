# DIGITAL OBSERVER SLI / SLO CATALOG

## Status and usage

These are internal operational objectives, not customer-facing or contractual SLAs. Current telemetry exposes bounded counts and timestamps from stable interfaces; latency percentiles and long-term availability trends remain provisional until enough retained operational data exists.

| Service objective | SLI | Measurement | Current baseline | Internal target | Contractual? |
|---|---|---|---|---|---|
| Camera availability | progressing monitored sources / expected monitored sources | existing source health and last seen | measured per snapshot; history foundation only | establish after retained coverage | No |
| Event delivery latency | `T3 - T0` | source/event timestamps when both are safely available | partial; source timing varies by adapter | observe before setting a threshold | No |
| Incident processing | `T4 - T3` | canonical Event and Incident timestamps | available for records with both timestamps | observe before setting a threshold | No |
| Decision latency | `T7 - T4` | Incident, Risk, Verification, Decision timestamps | partial canonical history | observe before setting a threshold | No |
| Evidence availability | available evidence / eligible evidence | clip/media status | current snapshot count, not a percentage claim | establish only after enough eligible samples | No |
| API availability | successful bounded API responses / total | API status/error telemetry when retained | read-model availability only | establish with retained request samples | No |
| Provider delivery | successful delivery / attempted delivery | notification delivery records | provider-mode dependent | only for enabled providers | No |
| Baseline freshness | current learning profiles / monitored profiles | learning profile status/update time | count of stale profiles | no stale profile should be silently healthy | No |

## End-to-end timing markers

| Marker | Meaning | Current source |
|---|---|---|
| `T0` | source observation | existing Gateway/Connector/source timestamp where exposed; no frozen runtime change |
| `T1` | inference | existing AI observation timing where available |
| `T2` | normalized event | Event/Journal observation time |
| `T3` | backend persistence | canonical Event persistence timestamp |
| `T4` | Incident update | Incident opened/last-activity timestamp |
| `T5` | Risk evaluation | risk evaluation timestamp |
| `T6` | Verification | verification timestamp |
| `T7` | Decision | decision timestamp |
| `T8` | Product availability | bounded API/UI retrieval time when instrumented |
| `T9` | Evidence availability | media/clip captured and available state |

## SLO rules

- A missing marker yields an unavailable measurement, not a fabricated zero-latency result.
- A low sample count must always be displayed with its denominator; it cannot support an accuracy or contractual availability claim.
- Operational severity is independent from Incident Risk/security severity.
- PUSH 16 hardware E2E, physical stream availability, and future fleet metrics belong to the hardware registry and are excluded from deterministic CI targets.

## Revalidation

When retained telemetry and new Connector/Fleet capabilities become available after PUSH 16–23, add observed percentiles, error budgets, and explicit internal thresholds without rewriting historical measurements.
