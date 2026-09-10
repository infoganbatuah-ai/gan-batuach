# DIGITAL OBSERVER — CANONICAL DOMAIN MAP

Date: 2026-09-10
Contract: `digital-observer-domain-v1`

## Runtime ownership

| Domain | Classification | Authoritative store / projection | Runtime owner | Primary consumer |
|---|---|---|---|---|
| Camera Source | CANONICAL | `digital_observer_camera_sources` | camera connection layer | Product camera inventory and Gateway/Connector binding |
| Observation / Detection | CANONICAL INPUT | validated edge observation | event validation pipeline | canonical Event ingestion |
| Event | CANONICAL | `observer_intelligence_signals` | authenticated `/api/video-gateway/cloud-events` | journal, Incident correlation, rules, Investigation |
| Incident | CANONICAL WITH DISCRIMINATOR | `observer_correlated_events` where `correlation_version = do-track-v1` and provenance is `REAL_CAMERA_AI` | `correlate_digital_observer_signal` | Product Incident API, Risk, Verification, Investigation |
| Evidence | CANONICAL | `digital_observer_event_clips` | cloud event-media ingestion and signed media route | Event review and Investigation |
| Tracking | CANONICAL EVENT CONTEXT | Event `track_id` plus canonical Incident timeline | event validation/correlation | Incident and Investigation |
| Context / Baseline | CANONICAL | `site_behavior_baselines` and Observer learning projections | home learning sampler | Risk evaluation |
| Risk | CANONICAL | `digital_observer_risk_evaluations` | risk decision service | Verification |
| Verification | CANONICAL | `digital_observer_incident_verifications` | incident verification service | final Decision |
| Decision | CANONICAL | `digital_observer_decision_intents` plus Incident projection | incident verification service | bounded notification/action policy |
| Watch Rules | CANONICAL | versioned `observer_watch_requests` / compiled rule projection | watch rule service/compiler | canonical Risk evaluation |
| Investigation | CANONICAL READ MODEL | authorized Event + Incident + Evidence projections | investigation search service | Product Investigation API/UI |
| Feedback / Ground Truth | CANONICAL | versioned feedback/review/calibration records | feedback calibration service | human-gated quality loop |
| Camera/component health | CANONICAL READ MODEL | PUSH 23 health projection | camera health model | Product and Fleet health APIs/UI |

## End-to-end authoritative path

```text
REAL CAMERA
→ Gateway or Software Connector
→ authenticated, source-scoped observation
→ observer_intelligence_signals (REAL_CAMERA_AI Event)
→ correlate_digital_observer_signal (do-track-v1 Incident)
→ digital_observer_risk_evaluations
→ digital_observer_incident_verifications
→ digital_observer_decision_intents
→ policy-selected Evidence / authorized UI
```

The Event write uses a stable tenant-namespaced source ID. The unique constraint and retry lookup provide one Product Event effect for repeated delivery. Incident membership is idempotent. Notifications and actions execute only after canonical Risk and Verification processing.

## Product boundaries

- `REAL_CAMERA_AI` is the Production camera-AI provenance. `SIMULATION`, `SHADOW_AI`, mock and `local_shadow` remain excluded.
- Event, Evidence, source recording, identity and Investigation source are separate concepts. No rule requires media for every Event.
- Investigation reads canonical Event/Incident/Evidence projections. It retains a future contract for authorized source recordings without pretending that an Event clip is the whole source archive.
- Product Incident reads require the canonical Incident discriminator; historical or kindergarten rows are not a fallback.
- A legacy watch-request policy adapter remains inside the canonical Risk service. It cannot independently write Risk, Decision or actions and has a documented retirement gate.

## Runtime consumers verified

| Consumer | Canonical dependency |
|---|---|
| Physical Gateway / Software Connector | authenticated cloud Event route and canonical Camera Source binding |
| Product journal | `observer_intelligence_signals` with provenance isolation |
| Product Incidents | canonical `do-track-v1` rows only |
| Risk / Verification / Decision | one service chain after canonical Incident correlation |
| Event Evidence | `digital_observer_event_clips` and signed media indirection |
| Investigation | canonical Event, Incident and Evidence projections |
| Feedback / Ground Truth | canonical Incident only, real provenance required for Production feedback |
| Observability | existing canonical event/incident/health signals; no new duplicate metric writer |

## Database decision

No PUSH 26 schema migration is required. Existing tables are shared for deliberate compatibility, and the Product boundary is enforced by provenance and `correlation_version`. Existing historical rows remain intact. New kindergarten/mock correlation writes are explicitly stamped `SIMULATION` and `legacy-kindergarten-mock-v1`.
