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
- `quality-benchmark`: `node scripts/qa/check-digital-observer-quality-benchmark.mjs`
- `native-preprocessing`: `node scripts/qa/check-digital-observer-native-preprocessing.mjs`
- `adaptive-sampling`: `node scripts/qa/check-digital-observer-adaptive-sampling.mjs`
- `durable-ai-job-queue`: `node scripts/qa/check-digital-observer-ai-job-queue.mjs`
- `hybrid-ai-routing`: `node scripts/qa/check-digital-observer-ai-routing.mjs`
- `cost-intelligence`: `node scripts/qa/check-digital-observer-cost-engine.mjs`
- `storage-portability`: `node scripts/qa/check-digital-observer-storage-portability.mjs`
- `portable-deployment`: `node scripts/qa/check-digital-observer-portable-deployment.mjs`
- `horizontal-ai-scale`: `node scripts/qa/check-digital-observer-horizontal-scale.mjs`
- `high-availability`: `node scripts/qa/check-digital-observer-high-availability.mjs`
- `reliability-qualification`: `node scripts/qa/check-digital-observer-reliability-qualification.mjs`
- `north-star-ledger`: `node scripts/qa/check-north-star-completion-ledger.mjs`
- `watch-rules`: `node scripts/qa/check-digital-observer-watch-rule-compiler.mjs`
- `investigation`: `node --test scripts/qa/check-digital-observer-investigation.mjs`
- `private-dvr-heartbeat-recovery-evidence`: `node scripts/qa/check-private-nvr-heartbeat-recovery-evidence.mjs`
- `gateway-common-cause-recovery`: `node scripts/qa/check-push38-gateway-common-cause-recovery.mjs`
- `gateway-session-stability`: `node scripts/qa/check-push38-gateway-session-stability.mjs`
- `connector-rtsp-session-recovery`: `node scripts/qa/check-push38-connector-rtsp-session-recovery.mjs`
- `connector-parent-exit-recovery`: `node scripts/qa/check-push38-connector-parent-exit-recovery.mjs`
- `edge-parent-shutdown`: `node scripts/qa/check-edge-parent-shutdown.mjs`
- `home-qa-identity-phases`: `node scripts/qa/check-push38-home-qa-phases.mjs`
- `home-qa-legacy-transition-proof`: `node scripts/qa/check-push38-home-qa-legacy-proof.mjs`
- `home-qa-r2-authorization`: `node scripts/qa/check-push38q-r2-download.mjs`
- `environment-safety`: `node scripts/validate-environment-safety.mjs`
- `encryption-separation`: `node scripts/qa/check-encryption-key-separation.mjs`
- `storage-policy`: `node scripts/qa/check-storage-policy-safety.mjs`
- `observer-engine-separation`: `node scripts/qa/check-observer-engine-separation.mjs`
- `canonical-api-error-boundary`: `node scripts/qa/check-canonical-api-error-boundary.mjs`
- `tenant-privacy-boundary`: `node --test scripts/qa/digital-guard-tenant-boundary.test.mjs`
- `mock-shadow-isolation`: `node scripts/qa/check-product-observer-real-source.mjs`

## COMPLETE QA SCRIPT INVENTORY

Inventory count: **273** files. Classifications are conservative; environment-dependent scripts stay outside Tier 1.

| File | Command | Tier | Deterministic | Network | Hardware | Production credentials | Destructive | Domain | Classification | Missing dependency |
|---|---|---|---|---|---|---|---|---|---|---|
| `scripts/qa/activate-push38-homeqa-connector-liveness.mjs` | node scripts/qa/activate-push38-homeqa-connector-liveness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs` | node scripts/qa/activate-push38-homeqa-connector-rtsp-session.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/activate-push38-homeqa-gateway-auth.mjs` | node scripts/qa/activate-push38-homeqa-gateway-auth.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs` | node scripts/qa/activate-push38-homeqa-gateway-common-cause-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/activate-push38-homeqa-gateway-session-stability.mjs` | node scripts/qa/activate-push38-homeqa-gateway-session-stability.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/activate-push38-homeqa-legacy-rollouts.mjs` | node scripts/qa/activate-push38-homeqa-legacy-rollouts.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/activate-push38-homeqa-managed-device.mjs` | node scripts/qa/activate-push38-homeqa-managed-device.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/analyze-object-frame-preprocessing.mjs` | node scripts/qa/analyze-object-frame-preprocessing.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/analyze-push38-v7.mjs` | node scripts/qa/analyze-push38-v7.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/audit-digital-observer-functional-reality.mjs` | node scripts/qa/audit-digital-observer-functional-reality.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/authorize-push38-baselines.mjs` | node scripts/qa/authorize-push38-baselines.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | SUPPORTING | none known |
| `scripts/qa/authorize-push38-homeqa-gateway-signed-recovery.mjs` | node scripts/qa/authorize-push38-homeqa-gateway-signed-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/authorize-push38g-release.mjs` | node scripts/qa/authorize-push38g-release.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | SUPPORTING | none known |
| `scripts/qa/authorize-push38l-connector-transition.mjs` | node scripts/qa/authorize-push38l-connector-transition.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/authorize-resigned-legacy-connector.mjs` | node scripts/qa/authorize-resigned-legacy-connector.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | LEGACY / FIXTURE | none known |
| `scripts/qa/benchmark-object-inference.mjs` | node scripts/qa/benchmark-object-inference.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/bind-push38-homeqa-legacy-proofs.mjs` | node scripts/qa/bind-push38-homeqa-legacy-proofs.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/bind-push38l-live-transition.mjs` | node scripts/qa/bind-push38l-live-transition.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/build-ci-test-manifest.mjs` | node scripts/qa/build-ci-test-manifest.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/build-digital-observer-reference-comparisons.mjs` | node scripts/qa/build-digital-observer-reference-comparisons.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | UI / E2E | SUPPORTING | none known |
| `scripts/qa/build-push38g-gateway-package.mjs` | node scripts/qa/build-push38g-gateway-package.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/camera-gateway-contract.test.mjs` | node scripts/qa/camera-gateway-contract.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/camera-queue-production-preflight.sql` | SQL fixture (not directly executable) | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | YES / CONTROLLED | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/camera-queue-schema.test.mjs` | node scripts/qa/camera-queue-schema.test.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-digital-observer-admin.mjs` | node scripts/qa/capture-digital-observer-admin.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-digital-observer-ai-experience.mjs` | node scripts/qa/capture-digital-observer-ai-experience.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-digital-observer-reference-flows.mjs` | node scripts/qa/capture-digital-observer-reference-flows.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | UI / E2E | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-live-object-diagnostic-sample.mjs` | node scripts/qa/capture-live-object-diagnostic-sample.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | AI / INFERENCE | SUPPORTING | none known |
| `scripts/qa/capture-push38-home-dvr-prewrite.mjs` | node scripts/qa/capture-push38-home-dvr-prewrite.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/capture-push38j-gateway-baseline.mjs` | node scripts/qa/capture-push38j-gateway-baseline.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/check-canonical-api-error-boundary.mjs` | node scripts/qa/check-canonical-api-error-boundary.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-cloud-discovery-observer-persistence.mjs` | node scripts/qa/check-cloud-discovery-observer-persistence.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-cloud-discovery-safety.mjs` | node scripts/qa/check-cloud-discovery-safety.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-connector-commercial.mjs` | node scripts/qa/check-connector-commercial.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-connector-health-recovery.mjs` | node scripts/qa/check-connector-health-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-connector-install-intents-db.mjs` | node scripts/qa/check-connector-install-intents-db.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-continuous-monitor.mjs` | node scripts/qa/check-continuous-monitor.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-digital-guard-public-readiness.mjs` | node scripts/qa/check-digital-guard-public-readiness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-adaptive-sampling.mjs` | npm run qa:digital-observer-adaptive-sampling | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-ai-job-queue.mjs` | npm run qa:digital-observer-ai-job-queue | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-ai-routing.mjs` | npm run qa:digital-observer-ai-routing | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-camera-connection-layer.mjs` | npm run qa:digital-observer-camera-connections | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-camera-health.mjs` | node scripts/qa/check-digital-observer-camera-health.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-camera-onboarding.mjs` | npm run qa:digital-observer-camera-onboarding | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-cost-engine.mjs` | npm run qa:digital-observer-cost-engine | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-domain-consolidation.mjs` | npm run qa:digital-observer-domain-consolidation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-digital-observer-event-media.mjs` | npm run qa:digital-observer-event-media; npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVIDENCE | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-feedback-calibration.mjs` | npm run qa:digital-observer-feedback | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | FEEDBACK / CALIBRATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-high-availability.mjs` | npm run qa:digital-observer-high-availability | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-horizontal-scale.mjs` | npm run qa:digital-observer-horizontal-scale | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-incident-verification.mjs` | npm run qa:digital-observer-verification | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | VERIFICATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-incidents.mjs` | npm run qa:digital-observer-incidents | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | INCIDENT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-investigation.mjs` | npm run qa:digital-observer-investigation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | INVESTIGATION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-native-preprocessing.mjs` | npm run qa:digital-observer-native-preprocessing | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-portable-deployment.mjs` | npm run qa:digital-observer-portable-deployment | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-product.mjs` | npm run qa:digital-observer-product | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/check-digital-observer-quality-benchmark.mjs` | npm run qa:digital-observer-quality-benchmark | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-reliability-qualification.mjs` | npm run qa:digital-observer-reliability-qualification | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-risk-decision.mjs` | npm run qa:digital-observer-risk | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | RISK / DECISION | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-storage-portability.mjs` | npm run qa:digital-observer-storage-portability | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-digital-observer-watch-rule-compiler.mjs` | npm run qa:digital-observer-watch-rules | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | WATCH RULES | CANONICAL CI | none known |
| `scripts/qa/check-discovery-capability-freshness.mjs` | node scripts/qa/check-discovery-capability-freshness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-dvr-shared-session-and-offline.mjs` | npm run qa:dvr-shared-session | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-edge-fleet-control-plane.mjs` | node scripts/qa/check-edge-fleet-control-plane.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-edge-ota-update.mjs` | node scripts/qa/check-edge-ota-update.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-edge-parent-shutdown.mjs` | node scripts/qa/check-edge-parent-shutdown.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-edge-release-trust.mjs` | node scripts/qa/check-edge-release-trust.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-edge-runtime-liveness.mjs` | node scripts/qa/check-edge-runtime-liveness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-edge-self-healing.mjs` | node scripts/qa/check-edge-self-healing.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
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
| `scripts/qa/check-home-qa-enrollment.mjs` | node scripts/qa/check-home-qa-enrollment.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-home-qa-trust-issuance.mjs` | node scripts/qa/check-home-qa-trust-issuance.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-immutable-audit-pgcrypto.mjs` | node scripts/qa/check-immutable-audit-pgcrypto.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-installed-ota-health-truth.mjs` | node scripts/qa/check-installed-ota-health-truth.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-journal-owner-lock.mjs` | node scripts/qa/check-journal-owner-lock.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVENT / JOURNAL | CANONICAL CI | none known |
| `scripts/qa/check-legacy-identity-bridge.mjs` | node scripts/qa/check-legacy-identity-bridge.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/check-live-kms-custody.mjs` | node scripts/qa/check-live-kms-custody.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-local-playback-grant.mjs` | node scripts/qa/check-local-playback-grant.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-managed-device-identity.mjs` | node scripts/qa/check-managed-device-identity.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-atomic-onboarding.mjs` | node scripts/qa/check-management-atomic-onboarding.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-canonical-family-linking.mjs` | node scripts/qa/check-management-canonical-family-linking.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-contact-verification.mjs` | node scripts/qa/check-management-contact-verification.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | VERIFICATION | SUPPORTING | none known |
| `scripts/qa/check-management-garden-context.mjs` | node scripts/qa/check-management-garden-context.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | SUPPORTING | none known |
| `scripts/qa/check-management-multi-garden-owner-context.mjs` | node scripts/qa/check-management-multi-garden-owner-context.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | SUPPORTING | none known |
| `scripts/qa/check-management-operational-role.mjs` | node scripts/qa/check-management-operational-role.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-owner-teacher-semantics.mjs` | node scripts/qa/check-management-owner-teacher-semantics.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-parent-invitation-acceptance.mjs` | node scripts/qa/check-management-parent-invitation-acceptance.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-management-signed-invitations.mjs` | node scripts/qa/check-management-signed-invitations.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-manager-parent-live-contract.mjs` | npm run qa:manager-parent-live-contract | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-migration-health.mjs` | npm run qa:migrations | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | DATABASE / MIGRATIONS | SUPPORTING | none known |
| `scripts/qa/check-north-star-completion-ledger.mjs` | node scripts/qa/check-north-star-completion-ledger.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-object-inference.mjs` | npm run qa:event-journal | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | AI / INFERENCE | CANONICAL CI | none known |
| `scripts/qa/check-observer-engine-separation.mjs` | npm run qa:observer-engine-separation | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-observer-live-camera-thumbnails.mjs` | node scripts/qa/check-observer-live-camera-thumbnails.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-observer-loopback-csp.mjs` | node scripts/qa/check-observer-loopback-csp.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-observer-site-selection.mjs` | npm run qa:observer-site-selection | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-offline-buffer-resync.mjs` | node scripts/qa/check-offline-buffer-resync.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-persistent-home-gateway.mjs` | node scripts/qa/check-persistent-home-gateway.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-post-push18-live-view.mjs` | node scripts/qa/check-post-push18-live-view.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-private-nvr-heartbeat-recovery-evidence.mjs` | node scripts/qa/check-private-nvr-heartbeat-recovery-evidence.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | EVIDENCE | CANONICAL CI | none known |
| `scripts/qa/check-product-observer-real-source.mjs` | npm run qa:product-observer-real-source | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-production-release-contract.mjs` | npm run qa:release-contract | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/check-production-release-snapshot.mjs` | npm run release:production:preflight | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/check-push17d-closure.mjs` | npm run qa:digital-observer-push17d | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push18b-gateway-runtime.mjs` | node scripts/qa/check-push18b-gateway-runtime.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-connector-crash-retry.mjs` | node scripts/qa/check-push38-connector-crash-retry.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-connector-parent-exit-recovery.mjs` | node scripts/qa/check-push38-connector-parent-exit-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | CANONICAL CI | none known |
| `scripts/qa/check-push38-connector-rtsp-host-pressure-retry.mjs` | node scripts/qa/check-push38-connector-rtsp-host-pressure-retry.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-connector-rtsp-session-recovery.mjs` | node scripts/qa/check-push38-connector-rtsp-session-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | CANONICAL CI | none known |
| `scripts/qa/check-push38-dvr-shadow-mode.mjs` | node scripts/qa/check-push38-dvr-shadow-mode.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-gateway-auth-recovery.mjs` | node scripts/qa/check-push38-gateway-auth-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-gateway-common-cause-recovery.mjs` | node scripts/qa/check-push38-gateway-common-cause-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | CANONICAL CI | none known |
| `scripts/qa/check-push38-gateway-session-stability.mjs` | node scripts/qa/check-push38-gateway-session-stability.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | CANONICAL CI | none known |
| `scripts/qa/check-push38-home-identity-rotation-bridge.mjs` | node scripts/qa/check-push38-home-identity-rotation-bridge.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-home-qa-issuance.mjs` | node scripts/qa/check-push38-home-qa-issuance.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-home-qa-legacy-proof.mjs` | node scripts/qa/check-push38-home-qa-legacy-proof.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-push38-home-qa-manifests.mjs` | node scripts/qa/check-push38-home-qa-manifests.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-home-qa-phases.mjs` | node scripts/qa/check-push38-home-qa-phases.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-push38-homeqa-gateway-bootstrap-prerequisite.mjs` | node scripts/qa/check-push38-homeqa-gateway-bootstrap-prerequisite.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-homeqa-gateway-rollback-recovery.mjs` | node scripts/qa/check-push38-homeqa-gateway-rollback-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-homeqa-gateway-signed-recovery.mjs` | node scripts/qa/check-push38-homeqa-gateway-signed-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-push38-homeqa-known-good-recovery.mjs` | node scripts/qa/check-push38-homeqa-known-good-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-homeqa-legacy-live-auth.mjs` | node scripts/qa/check-push38-homeqa-legacy-live-auth.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | LEGACY / FIXTURE | none known |
| `scripts/qa/check-push38-homeqa-mixed-identity-proof.mjs` | node scripts/qa/check-push38-homeqa-mixed-identity-proof.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-homeqa-ota-store.mjs` | node scripts/qa/check-push38-homeqa-ota-store.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-quarantined-release-retry.mjs` | node scripts/qa/check-push38-quarantined-release-retry.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38-tapo-endpoint-reconciliation.mjs` | node scripts/qa/check-push38-tapo-endpoint-reconciliation.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38b-monitor-accuracy.mjs` | node scripts/qa/check-push38b-monitor-accuracy.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38b-relay-recovery.mjs` | node scripts/qa/check-push38b-relay-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38c-health-probe.mjs` | node scripts/qa/check-push38c-health-probe.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38c-relay-reasons.mjs` | node scripts/qa/check-push38c-relay-reasons.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38c-session-policy.mjs` | node scripts/qa/check-push38c-session-policy.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38f-legacy-slots.mjs` | node scripts/qa/check-push38f-legacy-slots.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/check-push38g-managed-lifecycle.mjs` | node scripts/qa/check-push38g-managed-lifecycle.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38g-release-negatives.mjs` | node scripts/qa/check-push38g-release-negatives.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38h-live-dry-run.mjs` | node scripts/qa/check-push38h-live-dry-run.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38h-supervisor-smoke.mjs` | node scripts/qa/check-push38h-supervisor-smoke.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38h-supervisor-workdir.mjs` | node scripts/qa/check-push38h-supervisor-workdir.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38i-agent-core.mjs` | node scripts/qa/check-push38i-agent-core.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38l-live-dry-run.mjs` | node scripts/qa/check-push38l-live-dry-run.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38l-transition-policy.mjs` | node scripts/qa/check-push38l-transition-policy.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38o-home-qa-publication.mjs` | node scripts/qa/check-push38o-home-qa-publication.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38p-release-delivery.mjs` | node scripts/qa/check-push38p-release-delivery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-push38q-r2-download.mjs` | node scripts/qa/check-push38q-r2-download.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-push38t-ingress.mjs` | node scripts/qa/check-push38t-ingress.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-r2-keychain.mjs` | node scripts/qa/check-r2-keychain.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-real-detection-event-bridge.mjs` | npm run qa:real-detection-event-bridge | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | CANONICAL CI | none known |
| `scripts/qa/check-real-event-context-baseline.mjs` | node scripts/qa/check-real-event-context-baseline.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | CANONICAL CI | none known |
| `scripts/qa/check-remote-edge-signer.mjs` | node scripts/qa/check-remote-edge-signer.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-remote-playback-boundary.mjs` | node scripts/qa/check-remote-playback-boundary.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-software-connector.mjs` | npm run qa:software-connector | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-spatial-entry-geometry.mjs` | node scripts/qa/check-spatial-entry-geometry.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | TRACKING / ZONES | CANONICAL CI | none known |
| `scripts/qa/check-storage-policy-safety.mjs` | npm run qa:storage-policy-safety | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | SECURITY / TENANT ISOLATION | CANONICAL CI | none known |
| `scripts/qa/check-universal-connectivity.mjs` | node scripts/qa/check-universal-connectivity.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-vercel-deployment-package.mjs` | node scripts/qa/check-vercel-deployment-package.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/check-video-gateway-activity-insights.mjs` | node scripts/qa/check-video-gateway-activity-insights.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/check-zero-install-product-policy.mjs` | node scripts/qa/check-zero-install-product-policy.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
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
| `scripts/qa/digital-guard-diagnostics-postgres.test.mjs` | node scripts/qa/digital-guard-diagnostics-postgres.test.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | DATABASE / MIGRATIONS | INTEGRATION / SUPPORT | none known |
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
| `scripts/qa/enroll-push38t-devices.mjs` | node scripts/qa/enroll-push38t-devices.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/gateway-device-refresh.test.mjs` | node scripts/qa/gateway-device-refresh.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/inspect-event-camera-sources.mjs` | node scripts/qa/inspect-event-camera-sources.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/inspect-live-dvr-network-mode.mjs` | node scripts/qa/inspect-live-dvr-network-mode.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/inspect-production-quality-benchmark.mjs` | node scripts/qa/inspect-production-quality-benchmark.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | OTHER / SUPPORT | PRODUCTION SMOKE | none known |
| `scripts/qa/inspect-production-risk-state.mjs` | node scripts/qa/inspect-production-risk-state.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/inspect-push38-homeqa-remediation-runtime.mjs` | node scripts/qa/inspect-push38-homeqa-remediation-runtime.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/install-event-gateway-update.mjs` | node scripts/qa/install-event-gateway-update.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-inference-headroom-fix.mjs` | node scripts/qa/install-event-inference-headroom-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | AI / INFERENCE | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-runtime-stability-fix.mjs` | node scripts/qa/install-event-runtime-stability-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-event-spatial-rules-fix.mjs` | node scripts/qa/install-event-spatial-rules-fix.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | TRACKING / ZONES | INTEGRATION / SUPPORT | none known |
| `scripts/qa/install-push38-homeqa-ota-agent.mjs` | node scripts/qa/install-push38-homeqa-ota-agent.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | YES / CONTROLLED | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/managed-device-identity-postgres.test.mjs` | node scripts/qa/managed-device-identity-postgres.test.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | DATABASE / MIGRATIONS | SUPPORTING | none known |
| `scripts/qa/measure-real-home-adaptive-sampling.mjs` | npm run qa:digital-observer-adaptive-sampling-real | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/measure-real-home-ai-job-queue.mjs` | npm run qa:digital-observer-ai-job-queue-real | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/measure-real-home-ai-routing.mjs` | npm run qa:digital-observer-ai-routing-real | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/measure-real-home-cost-baseline.mjs` | npm run qa:digital-observer-cost-engine-real | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CONTEXT / BASELINE | SUPPORTING | none known |
| `scripts/qa/measure-real-home-horizontal-scale.mjs` | npm run qa:digital-observer-horizontal-scale-real | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/measure-real-home-preprocessing.mjs` | node scripts/qa/measure-real-home-preprocessing.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/monitor-real-risk-window.mjs` | node scripts/qa/monitor-real-risk-window.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/normalize-local-qa-env.mjs` | npm run qa:normalize-demo-credentials | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/observe-live-gateway-dvr-truth.mjs` | node scripts/qa/observe-live-gateway-dvr-truth.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/observe-push38-host-dvr.mjs` | node scripts/qa/observe-push38-host-dvr.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/plan-push38-homeqa-live.mjs` | node scripts/qa/plan-push38-homeqa-live.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/prepare-journal-source-release.mjs` | node scripts/qa/prepare-journal-source-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | EVENT / JOURNAL | INTEGRATION / SUPPORT | none known |
| `scripts/qa/private-nvr-lighting-pulse.test.mjs` | node scripts/qa/private-nvr-lighting-pulse.test.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/probe-admin-dashboard-schema.mjs` | node scripts/qa/probe-admin-dashboard-schema.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | DATABASE / MIGRATIONS | INTEGRATION / SUPPORT | none known |
| `scripts/qa/probe-push38-dvr-transport.mjs` | node scripts/qa/probe-push38-dvr-transport.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/production-release-snapshot-core.mjs` | node scripts/qa/production-release-snapshot-core.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | PRODUCTION RELEASE | SUPPORTING | none known |
| `scripts/qa/prove-push38-homeqa-legacy-download.mjs` | node scripts/qa/prove-push38-homeqa-legacy-download.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/reconcile-live-gateway-dvr-endpoint.mjs` | node scripts/qa/reconcile-live-gateway-dvr-endpoint.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/reconcile-live-tapo-endpoint.mjs` | node scripts/qa/reconcile-live-tapo-endpoint.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/reconcile-push38-home-identity.mjs` | node scripts/qa/reconcile-push38-home-identity.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/reconcile-push38-homeqa-connector-healthy-state.mjs` | node scripts/qa/reconcile-push38-homeqa-connector-healthy-state.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/recover-push38-homeqa-connector-transition.mjs` | node scripts/qa/recover-push38-homeqa-connector-transition.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/recover-push38-homeqa-gateway-rollback.mjs` | node scripts/qa/recover-push38-homeqa-gateway-rollback.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/recover-push38-homeqa-known-good.mjs` | node scripts/qa/recover-push38-homeqa-known-good.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-connector-liveness.mjs` | node scripts/qa/register-push38-homeqa-connector-liveness.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-connector-pidfix.mjs` | node scripts/qa/register-push38-homeqa-connector-pidfix.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs` | node scripts/qa/register-push38-homeqa-connector-rtsp-session.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-gateway-auth-recovery.mjs` | node scripts/qa/register-push38-homeqa-gateway-auth-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs` | node scripts/qa/register-push38-homeqa-gateway-common-cause-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-gateway-session-stability.mjs` | node scripts/qa/register-push38-homeqa-gateway-session-stability.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/register-push38-homeqa-legacy-devices.mjs` | node scripts/qa/register-push38-homeqa-legacy-devices.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/register-push38-homeqa-releases.mjs` | node scripts/qa/register-push38-homeqa-releases.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/renew-push38-homeqa-legacy-proofs.mjs` | node scripts/qa/renew-push38-homeqa-legacy-proofs.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | LEGACY / FIXTURE | none known |
| `scripts/qa/report-demo-role-assignments.mjs` | npm run qa:report-demo-role-assignments | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/retry-push38-homeqa-connector-after-crash-recovery.mjs` | node scripts/qa/retry-push38-homeqa-connector-after-crash-recovery.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/retry-push38-homeqa-connector-after-endpoint-reconciliation.mjs` | node scripts/qa/retry-push38-homeqa-connector-after-endpoint-reconciliation.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/retry-push38-homeqa-connector-rtsp-session-after-host-pressure.mjs` | node scripts/qa/retry-push38-homeqa-connector-rtsp-session-after-host-pressure.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/run-clean-environment-proof.mjs` | npm run qa:digital-observer-clean-environment | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-completion-role-boundary-probes.mjs` | npm run qa:probe-role-boundaries | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | SECURITY / TENANT ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-guard-preview-learning.mjs` | node scripts/qa/run-guard-preview-learning.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CONTEXT / BASELINE | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-push38-dvr-shadow.mjs` | node scripts/qa/run-push38-dvr-shadow.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-push38-homeqa-connector-transition.mjs` | node scripts/qa/run-push38-homeqa-connector-transition.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-push38-homeqa-gateway-bootstrap.mjs` | node scripts/qa/run-push38-homeqa-gateway-bootstrap.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/run-real-home-soak.mjs` | npm run qa:digital-observer-real-home-soak | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/seed-digital-observer-reference-data.mjs` | node scripts/qa/seed-digital-observer-reference-data.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/seed-digital-observer-runtime.sql` | SQL fixture (not directly executable) | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | YES / CONTROLLED | MOCK / SHADOW ISOLATION | INTEGRATION / SUPPORT | none known |
| `scripts/qa/send-digital-observer-admin-set-password.mjs` | node scripts/qa/send-digital-observer-admin-set-password.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/soak-health-probe.mjs` | node scripts/qa/soak-health-probe.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/stage-camera-queue-release.mjs` | node scripts/qa/stage-camera-queue-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | CAMERA / GATEWAY / CONNECTOR | INTEGRATION / SUPPORT | none known |
| `scripts/qa/stage-event-release.mjs` | node scripts/qa/stage-event-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/stage-guard-diagnostics-release.mjs` | node scripts/qa/stage-guard-diagnostics-release.mjs | TIER 2 — INTEGRATION | NO | YES / ENV-DEPENDENT | NO | NO | NO | OTHER / SUPPORT | INTEGRATION / SUPPORT | none known |
| `scripts/qa/start-push38t-ingress.mjs` | node scripts/qa/start-push38t-ingress.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/start-push38t-qualification.mjs` | node scripts/qa/start-push38t-qualification.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/start-push38t-rest-loopback.mjs` | node scripts/qa/start-push38t-rest-loopback.mjs | TIER 1 — CI DETERMINISTIC | YES | NO | NO | NO | NO | OTHER / SUPPORT | SUPPORTING | none known |
| `scripts/qa/verify-live-event-gateway.mjs` | node scripts/qa/verify-live-event-gateway.mjs | TIER 3 — HARDWARE E2E | NO | NO | YES | NO | NO | CAMERA / GATEWAY / CONNECTOR | SUPPORTING | none known |
| `scripts/qa/verify-production-camera-connection-layer.mjs` | npm run qa:digital-observer-camera-connections-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-camera-onboarding.mjs` | npm run qa:digital-observer-camera-onboarding-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-feedback-calibration.mjs` | npm run qa:digital-observer-feedback-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | FEEDBACK / CALIBRATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-feedback-ui.mjs` | npm run qa:digital-observer-feedback-ui | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | FEEDBACK / CALIBRATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-incident-verification.mjs` | node scripts/qa/verify-production-incident-verification.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | VERIFICATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-investigation.mjs` | npm run qa:digital-observer-investigation-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | INVESTIGATION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-risk-user-view.mjs` | node scripts/qa/verify-production-risk-user-view.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | RISK / DECISION | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-software-connector.mjs` | npm run qa:software-connector-production | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | CAMERA / GATEWAY / CONNECTOR | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-storage-evidence.mjs` | npm run qa:digital-observer-storage-evidence-real | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | EVIDENCE | PRODUCTION SMOKE | none known |
| `scripts/qa/verify-production-watch-rule.mjs` | node scripts/qa/verify-production-watch-rule.mjs | TIER 4 — PRODUCTION SMOKE | NO | YES / ENV-DEPENDENT | NO | YES | NO | WATCH RULES | PRODUCTION SMOKE | none known |

## MAINTENANCE RULE

Any new canonical capability must add its deterministic regression to `config/digital-observer-ci-gates.json`, update the capability row in this generator, and keep hardware/Production proof outside normal CI. Regenerate with `node scripts/qa/build-ci-test-manifest.mjs`.
