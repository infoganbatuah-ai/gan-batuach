# DIGITAL OBSERVER CI TEST MANIFEST

Generated from tracked repository state by `scripts/qa/build-ci-test-manifest.mjs`. CI contract: `digital-observer-ci-v1`.

## CI TEST TIERS

- **TIER 1 — CI DETERMINISTIC:** no Production secrets, provider sends, deployment, database mutation or physical hardware.
- **TIER 2 — INTEGRATION:** may require a local/test Supabase instance, authenticated QA users, browser tooling or controlled fixture mutation.
- **TIER 3 — HARDWARE E2E:** requires a real camera/DVR/NVR, Connector/Gateway or physical input.
- **TIER 4 — PRODUCTION SMOKE:** bounded read-only or explicitly controlled post-deploy verification; never normal PR CI.

## CANONICAL CI GATES

| Gate | Command | Required result |
|---|---|---|
| Gate 1 — Static quality | `npm run typecheck`; `npm run lint:ci` | Typecheck PASS; no lint regression; canonical scope has zero errors |
| Gate 2 — Build | `npm run build` | Production build PASS with live activation disabled |
| Gate 3 — Domain regression | `npm run qa:ci:domain` | All configured deterministic domain suites PASS |
| Gate 4 — Security | `npm run qa:ci:security`; `npm audit --audit-level=high` | Isolation suites PASS; no high/critical vulnerability |
| Gate 5 — Database | `npm run qa:migrations` | Unique timestamps; no new unreviewed destructive migration |
| Gate 6 — Release preflight | `npm run qa:release-contract` | Clean snapshot accepted; dirty/secret/wrong-project snapshots rejected |

## DOMAIN REGRESSION MANIFEST

| Capability | Canonical implementation | Canonical API | Table/schema | Primary regression | Production proof | Release gate |
|---|---|---|---|---|---|---|
| Real camera source | lib/domain/digital-observer/camera-connection-layer.ts (frozen) | /api/digital-observer/connection-assessment | digital_observer_camera_sources; camera_streams | qa:digital-observer-camera-connections | PUSH 14 / 15 / 16B | GATE 3 + hardware registry |
| AI / inference | services/video-gateway/object-inference-client.mjs (frozen) | /api/video-gateway/cloud-events | observer_intelligence_signals | check-object-inference; qa:real-detection-event-bridge | PUSH 3–4 | GATE 3 |
| Tracking / zones | services/video-gateway/journal-tracker.mjs (frozen) | /api/video-gateway/cloud-events | observer_intelligence_signals | check-event-tracker-configuration; check-spatial-entry-geometry | PUSH 5 / 5B / 9D | GATE 3 + hardware registry |
| Events | lib/domain/event-engine/event-journal-service.ts | /api/digital-observer/event-journal | observer_intelligence_signals | check-event-journal; check-event-ingest; check-event-outbox | PUSH 4 | GATE 3 |
| Incidents | lib/domain/digital-observer/incident-correlation.ts | /api/digital-observer/incidents | observer_correlated_events; observer_correlated_event_links | qa:digital-observer-incidents | PUSH 6 | GATE 3 |
| Evidence | lib/domain/event-engine/event-evidence-compatibility.ts | /api/digital-observer/event-clips/[id]/media | digital_observer_event_clips | check-event-evidence-compatibility; qa:digital-observer-event-media | PUSH 7 / 7B.1 | GATE 3 + hardware registry |
| Context / baseline | lib/domain/digital-observer/learning-engine.ts | Incident projection | site_behavior_baselines | check-real-event-context-baseline | PUSH 8 | GATE 3 |
| Risk / decision | lib/domain/digital-observer/risk-decision-engine.ts | /api/digital-observer/incidents | digital_observer_risk_evaluations; digital_observer_decision_intents | qa:digital-observer-risk | PUSH 9 | GATE 3 |
| Verification | lib/domain/digital-observer/incident-verification-engine.ts | /api/digital-observer/incidents | digital_observer_incident_verifications | qa:digital-observer-verification | PUSH 10 | GATE 3 |
| Feedback / calibration | lib/domain/digital-observer/feedback-calibration.ts | /api/digital-observer/incidents/feedback | digital_observer_feedback_revisions; digital_observer_calibration_samples | qa:digital-observer-feedback | PUSH 11 | GATE 3 |
| Watch rules | lib/domain/digital-observer/watch-rule-compiler.ts | /api/digital-observer/watch-rules | observer_watch_requests; digital_observer_watch_rule_versions | qa:digital-observer-watch-rules | PUSH 12 | GATE 3 |
| Investigation | lib/domain/digital-observer/investigation-search-service.ts | /api/digital-observer/investigation | canonical Event/Incident/Evidence projections | qa:digital-observer-investigation | PUSH 13 | GATE 3 |

## TIER 1 CANONICAL SUITES

- `event-journal`: `node scripts/qa/check-event-journal.mjs`
- `event-ingest`: `node scripts/qa/check-event-ingest.mjs`
- `event-outbox`: `node scripts/qa/check-event-outbox.mjs`
- `object-inference`: `node scripts/qa/check-object-inference.mjs`
- `event-media`: `node scripts/qa/check-digital-observer-event-media.mjs`
- `evidence-compatibility`: `node scripts/qa/check-event-evidence-compatibility.mjs`
- `tracking-configuration`: `node scripts/qa/check-event-tracker-configuration.mjs`
- `spatial-geometry`: `node scripts/qa/check-spatial-entry-geometry.mjs`
- `journal-owner-lock`: `node scripts/qa/check-journal-owner-lock.mjs`
- `real-style-event-bridge`: `node scripts/qa/check-real-detection-event-bridge.mjs`
- `real-source-isolation`: `node scripts/qa/check-product-observer-real-source.mjs`
- `incidents`: `node scripts/qa/check-digital-observer-incidents.mjs`
- `context-baseline`: `node scripts/qa/check-real-event-context-baseline.mjs`
- `risk-decision`: `node scripts/qa/check-digital-observer-risk-decision.mjs`
- `verification`: `node scripts/qa/check-digital-observer-incident-verification.mjs`
- `feedback-calibration`: `node scripts/qa/check-digital-observer-feedback-calibration.mjs`
- `watch-rules`: `node scripts/qa/check-digital-observer-watch-rule-compiler.mjs`
- `investigation`: `node --test scripts/qa/check-digital-observer-investigation.mjs`
- `environment-safety`: `node scripts/validate-environment-safety.mjs`
- `encryption-separation`: `node scripts/qa/check-encryption-key-separation.mjs`
- `storage-policy`: `node scripts/qa/check-storage-policy-safety.mjs`
- `observer-engine-separation`: `node scripts/qa/check-observer-engine-separation.mjs`
- `canonical-api-error-boundary`: `node scripts/qa/check-canonical-api-error-boundary.mjs`
- `tenant-privacy-boundary`: `node --test scripts/qa/digital-guard-tenant-boundary.test.mjs`
- `mock-shadow-isolation`: `node scripts/qa/check-product-observer-real-source.mjs`

## COMPLETE QA SCRIPT INVENTORY

Inventory count: **120** files. Classifications are conservative; environment-dependent scripts stay outside Tier 1.

| File | Command | Tier | Deterministic | Network | Hardware | Production credentials | Destructive | Domain | Classification | Missing dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| `scripts/qa/analyze-object-frame-preprocessing.mjs` | node scripts/qa/analyze-object-frame-preprocessing.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/audit-digital-observer-functional-reality.mjs` | node scripts/qa/audit-digital-observer-functional-reality.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/benchmark-object-inference.mjs` | node scripts/qa/benchmark-object-inference.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/build-ci-test-manifest.mjs` | node scripts/qa/build-ci-test-manifest.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/build-digital-observer-reference-comparisons.mjs` | node scripts/qa/build-digital-observer-reference-comparisons.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | UI / E2E | SUPPORTING | none known |
| `scripts/qa/camera-gateway-contract.test.mjs` | node scripts/qa/camera-gateway-contract.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/camera-queue-production-preflight.sql` | SQL fixture (not directly executable) | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | YES / CONTROLLED | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/camera-queue-schema.test.mjs` | node scripts/qa/camera-queue-schema.test.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | @electric-sql/pglite |
| `scripts/qa/capture-digital-observer-admin.mjs` | node scripts/qa/capture-digital-observer-admin.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-digital-observer-ai-experience.mjs` | node scripts/qa/capture-digital-observer-ai-experience.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-digital-observer-reference-flows.mjs` | node scripts/qa/capture-digital-observer-reference-flows.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-live-object-diagnostic-sample.mjs` | node scripts/qa/capture-live-object-diagnostic-sample.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/check-canonical-api-error-boundary.mjs` | node scripts/qa/check-canonical-api-error-boundary.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-cloud-discovery-observer-persistence.mjs` | node scripts/qa/check-cloud-discovery-observer-persistence.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-cloud-discovery-safety.mjs` | node scripts/qa/check-cloud-discovery-safety.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-continuous-monitor.mjs` | node scripts/qa/check-continuous-monitor.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-digital-guard-public-readiness.mjs` | node scripts/qa/check-digital-guard-public-readiness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-camera-connection-layer.mjs` | npm run qa:digital-observer-camera-connections | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-camera-onboarding.mjs` | npm run qa:digital-observer-camera-onboarding | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-event-media.mjs` | npm run qa:digital-observer-event-media; npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVIDENCE | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-feedback-calibration.mjs` | npm run qa:digital-observer-feedback | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | FEEDBACK / CALIBRATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-incident-verification.mjs` | npm run qa:digital-observer-verification | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | VERIFICATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-incidents.mjs` | npm run qa:digital-observer-incidents | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | INCIDENT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-investigation.mjs` | npm run qa:digital-observer-investigation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | INVESTIGATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-product.mjs` | npm run qa:digital-observer-product | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/check-digital-observer-risk-decision.mjs` | npm run qa:digital-observer-risk | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | RISK / DECISION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-watch-rule-compiler.mjs` | npm run qa:digital-observer-watch-rules | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | WATCH RULES | CANONICAL CI | none known |
| `scripts/qa/check-discovery-capability-freshness.mjs` | node scripts/qa/check-discovery-capability-freshness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-dvr-shared-session-and-offline.mjs` | npm run qa:dvr-shared-session | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-encryption-key-separation.mjs` | npm run qa:encryption-key-separation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | CANONICAL CI | none known |
| `scripts/qa/check-eslint-baseline.mjs` | npm run lint:ci | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | SUPPORTING | none known |
| `scripts/qa/check-event-backend.mjs` | node scripts/qa/check-event-backend.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | EVENT / JOURNAL | INTEGRATION / SUPPORT | none known |
| `scripts/qa/check-event-clip-window.mjs` | node scripts/qa/check-event-clip-window.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVIDENCE | SUPPORTING | none known |
| `scripts/qa/check-event-evidence-compatibility.mjs` | node scripts/qa/check-event-evidence-compatibility.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVIDENCE | CANONICAL CI | none known |
| `scripts/qa/check-event-ingest-pipe.mjs` | node scripts/qa/check-event-ingest-pipe.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | SUPPORTING | none known |
| `scripts/qa/check-event-ingest.mjs` | npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | CANONICAL CI | none known |
| `scripts/qa/check-event-journal.mjs` | npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | CANONICAL CI | none known |
| `scripts/qa/check-event-manifest-policy.mjs` | node scripts/qa/check-event-manifest-policy.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-event-outbox.mjs` | npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | CANONICAL CI | none known |
| `scripts/qa/check-event-poll-isolation.mjs` | node scripts/qa/check-event-poll-isolation.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-event-temporal-coverage.mjs` | node scripts/qa/check-event-temporal-coverage.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-event-tracker-configuration.mjs` | node scripts/qa/check-event-tracker-configuration.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | TRACKING / ZONES | CANONICAL CI | none known |
| `scripts/qa/check-guard-journal-search.mjs` | node scripts/qa/check-guard-journal-search.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | SUPPORTING | none known |
| `scripts/qa/check-guard-server-credential.mjs` | node scripts/qa/check-guard-server-credential.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | SECURITY / TENANT ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/check-immutable-audit-pgcrypto.mjs` | node scripts/qa/check-immutable-audit-pgcrypto.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-journal-owner-lock.mjs` | node scripts/qa/check-journal-owner-lock.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | CANONICAL CI | none known |
| `scripts/qa/check-local-playback-grant.mjs` | node scripts/qa/check-local-playback-grant.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-manager-parent-live-contract.mjs` | npm run qa:manager-parent-live-contract | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-migration-health.mjs` | npm run qa:migrations | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | DATABASE / MIGRATIONS | SUPPORTING | none known |
| `scripts/qa/check-object-inference.mjs` | npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | CANONICAL CI | none known |
| `scripts/qa/check-observer-engine-separation.mjs` | npm run qa:observer-engine-separation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-observer-live-camera-thumbnails.mjs` | node scripts/qa/check-observer-live-camera-thumbnails.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-observer-loopback-csp.mjs` | node scripts/qa/check-observer-loopback-csp.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-observer-site-selection.mjs` | npm run qa:observer-site-selection | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-persistent-home-gateway.mjs` | node scripts/qa/check-persistent-home-gateway.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-product-observer-real-source.mjs` | npm run qa:product-observer-real-source | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-production-release-contract.mjs` | npm run qa:release-contract | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/check-production-release-snapshot.mjs` | npm run release:production:preflight | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/check-real-detection-event-bridge.mjs` | npm run qa:real-detection-event-bridge | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-real-event-context-baseline.mjs` | node scripts/qa/check-real-event-context-baseline.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | CANONICAL CI | none known |
| `scripts/qa/check-software-connector.mjs` | npm run qa:software-connector | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-spatial-entry-geometry.mjs` | node scripts/qa/check-spatial-entry-geometry.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | TRACKING / ZONES | CANONICAL CI | none known |
| `scripts/qa/check-storage-policy-safety.mjs` | npm run qa:storage-policy-safety | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | CANONICAL CI | none known |
| `scripts/qa/check-video-gateway-activity-insights.mjs` | node scripts/qa/check-video-gateway-activity-insights.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/cloud-discovery-capability-contract.test.mjs` | node scripts/qa/cloud-discovery-capability-contract.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/compare-object-model.mjs` | node scripts/qa/compare-object-model.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/compare-object-session-startup.mjs` | node scripts/qa/compare-object-session-startup.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/create-demo-role-users.mjs` | npm run qa:create-demo-role-users | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/create-digital-observer-admin-pilot.mjs` | node scripts/qa/create-digital-observer-admin-pilot.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/delete-digital-observer-test-user.mjs` | npm run qa:delete-digital-observer-test-user | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/diagnose-auth-email-delivery.mjs` | node scripts/qa/diagnose-auth-email-delivery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | SUPPORTING | none known |
| `scripts/qa/digital-guard-autonomy.test.mjs` | node scripts/qa/digital-guard-autonomy.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-camera-presence.test.mjs` | node scripts/qa/digital-guard-camera-presence.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/digital-guard-chat-query.test.mjs` | node scripts/qa/digital-guard-chat-query.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-command-queue-safety.test.mjs` | node scripts/qa/digital-guard-command-queue-safety.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-diagnostics-client.test.mjs` | node scripts/qa/digital-guard-diagnostics-client.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-diagnostics-integration.test.mjs` | node scripts/qa/digital-guard-diagnostics-integration.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-diagnostics-postgres.test.mjs` | node scripts/qa/digital-guard-diagnostics-postgres.test.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | DATABASE / MIGRATIONS | INTEGRATION / SUPPORT | @electric-sql/pglite |
| `scripts/qa/digital-guard-garden-control.test.mjs` | node scripts/qa/digital-guard-garden-control.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-persisted-learning.mjs` | node scripts/qa/digital-guard-persisted-learning.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CONTEXT / BASELINE | INTEGRATION / SUPPORT | none known |
| `scripts/qa/digital-guard-preview.test.mjs` | node scripts/qa/digital-guard-preview.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-public-readiness.test.mjs` | node scripts/qa/digital-guard-public-readiness.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-qa-ui.test.mjs` | node scripts/qa/digital-guard-qa-ui.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-runtime.test.mjs` | node scripts/qa/digital-guard-runtime.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-skeleton-contract.test.mjs` | node scripts/qa/digital-guard-skeleton-contract.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/digital-guard-skeleton-journal.test.mjs` | node scripts/qa/digital-guard-skeleton-journal.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | SUPPORTING | none known |
| `scripts/qa/digital-guard-tenant-boundary.test.mjs` | node scripts/qa/digital-guard-tenant-boundary.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | CANONICAL CI | none known |
| `scripts/qa/digital-guard-test-loader.mjs` | node scripts/qa/digital-guard-test-loader.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/gateway-device-refresh.test.mjs` | node scripts/qa/gateway-device-refresh.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/inspect-event-camera-sources.mjs` | node scripts/qa/inspect-event-camera-sources.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/inspect-production-risk-state.mjs` | node scripts/qa/inspect-production-risk-state.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/install-event-gateway-update.mjs` | node scripts/qa/install-event-gateway-update.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-inference-headroom-fix.mjs` | node scripts/qa/install-event-inference-headroom-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | AI / INFERENCE | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-runtime-stability-fix.mjs` | node scripts/qa/install-event-runtime-stability-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-spatial-rules-fix.mjs` | node scripts/qa/install-event-spatial-rules-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | TRACKING / ZONES | INTEGRATION / SUPPORT | none known |
| `scripts/qa/monitor-real-risk-window.mjs` | node scripts/qa/monitor-real-risk-window.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/normalize-local-qa-env.mjs` | npm run qa:normalize-demo-credentials | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/prepare-journal-source-release.mjs` | node scripts/qa/prepare-journal-source-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | EVENT / JOURNAL | INTEGRATION / SUPPORT | none known |
| `scripts/qa/private-nvr-lighting-pulse.test.mjs` | node scripts/qa/private-nvr-lighting-pulse.test.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/probe-admin-dashboard-schema.mjs` | node scripts/qa/probe-admin-dashboard-schema.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | DATABASE / MIGRATIONS | INTEGRATION / SUPPORT | none known |
| `scripts/qa/production-release-snapshot-core.mjs` | node scripts/qa/production-release-snapshot-core.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/report-demo-role-assignments.mjs` | npm run qa:report-demo-role-assignments | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-completion-role-boundary-probes.mjs` | npm run qa:probe-role-boundaries | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | SECURITY / TENANT ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-guard-preview-learning.mjs` | node scripts/qa/run-guard-preview-learning.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CONTEXT / BASELINE | INTEGRATION / SUPPORT | none known |
| `scripts/qa/seed-digital-observer-reference-data.mjs` | node scripts/qa/seed-digital-observer-reference-data.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/seed-digital-observer-runtime.sql` | SQL fixture (not directly executable) | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/send-digital-observer-admin-set-password.mjs` | node scripts/qa/send-digital-observer-admin-set-password.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/stage-camera-queue-release.mjs` | node scripts/qa/stage-camera-queue-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/stage-event-release.mjs` | node scripts/qa/stage-event-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/stage-guard-diagnostics-release.mjs` | node scripts/qa/stage-guard-diagnostics-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/verify-live-event-gateway.mjs` | node scripts/qa/verify-live-event-gateway.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/verify-production-camera-connection-layer.mjs` | npm run qa:digital-observer-camera-connections-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-camera-onboarding.mjs` | npm run qa:digital-observer-camera-onboarding-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-feedback-calibration.mjs` | npm run qa:digital-observer-feedback-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | FEEDBACK / CALIBRATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-feedback-ui.mjs` | npm run qa:digital-observer-feedback-ui | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | FEEDBACK / CALIBRATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-incident-verification.mjs` | node scripts/qa/verify-production-incident-verification.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | VERIFICATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-investigation.mjs` | npm run qa:digital-observer-investigation-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | INVESTIGATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-risk-user-view.mjs` | node scripts/qa/verify-production-risk-user-view.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-software-connector.mjs` | npm run qa:software-connector-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-watch-rule.mjs` | node scripts/qa/verify-production-watch-rule.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | WATCH RULES | PRODUCTION SMOKE | none known |

## MAINTENANCE RULE

Any new canonical capability must add its deterministic regression to `config/digital-observer-ci-gates.json`, update the capability row in this generator, and keep hardware/Production proof outside normal CI. Regenerate with `node scripts/qa/build-ci-test-manifest.mjs`.
