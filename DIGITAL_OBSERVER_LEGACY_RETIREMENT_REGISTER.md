# DIGITAL OBSERVER — LEGACY RETIREMENT REGISTER

Date: 2026-09-10

Deletion is allowed only after dependency evidence, consumer migration, rollback availability and regression proof. PUSH 26 does not delete uncertain historical Product data.

| Path | Class | Current use | Canonical replacement / boundary | Retirement gate | PUSH 26 disposition |
|---|---|---|---|---|---|
| duplicate `do-track-v1` literals in Product TypeScript | DUPLICATE | Incident API, verification and Investigation filtering | `DIGITAL_OBSERVER_INCIDENT_VERSION` in canonical domain manifest | typecheck plus Incident/Investigation QA | RETIRED: consumers now import one constant |
| `/api/observer-correlated-events` mock POST | COMPATIBILITY | kindergarten/admin mock correlation | Product uses DB correlation trigger and `/api/digital-observer/incidents` | kindergarten consumer migration or product retirement | RETAINED, explicitly marked `SIMULATION` + `legacy-kindergarten-mock-v1` |
| `ai_events` | COMPATIBILITY | kindergarten product | DO Event is `observer_intelligence_signals` | all kindergarten consumers have an approved replacement | RETAINED outside DO Product |
| `ai_camera_events` | DEVELOPMENT_ONLY | admin/mock/shadow fixtures | authenticated Gateway Event ingestion | fixture consumers removed or replaced | QUARANTINED; never Product truth |
| `incident_reports` | COMPATIBILITY | kindergarten operations | DO Incident is canonical `observer_correlated_events` discriminator | kindergarten lifecycle migration with data proof | RETAINED outside DO Product |
| non-`do-track-v1` rows in `observer_correlated_events` | LEGACY | historical/shared-product compatibility | canonical DO Incident discriminator | row provenance/classification migration with before/after counts | RETAINED, excluded from Product APIs |
| uncompiled `observer_watch_requests` risk policy | COMPATIBILITY | older saved monitoring requests | versioned Watch Rule Compiler | every active rule compiles and deterministic outcome parity passes | RETAINED inside canonical Risk service only |

## Counts

- Retired duplicate paths/contracts: **1**.
- Explicit compatibility/development/legacy paths retained: **6**.
- Unresolved HIGH/CRITICAL Digital Observer ownership conflicts: **0**.
- Destructive data/table removals in PUSH 26: **0**.

## Non-retirement decisions

The kindergarten stores are a separate product compatibility boundary, not proof of a second Digital Observer source of truth. Removing them without migration evidence would risk unrelated data and is therefore prohibited. Git history remains the rollback source for the retired TypeScript literal duplication.
