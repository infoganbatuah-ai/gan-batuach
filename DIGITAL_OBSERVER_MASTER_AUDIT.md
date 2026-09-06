# DIGITAL OBSERVER — MASTER EXISTING SYSTEM AUDIT

Audit date: 2026-09-04
Repository: `/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach`
Revision: `22f3a53` (`codex/ci-typecheck-deployment-repair-20260831`)
Scope: repository and available local runtime evidence only. No roadmap implementation was performed.

## Audit rules and evidence boundary

The only statuses used in this report are: `PRODUCTION VERIFIED`, `EXISTS — NEEDS QA`, `NEEDS HARDENING`, `PARTIAL`, `UI ONLY`, `MOCK / SIMULATED`, `BROKEN`, `MISSING`, and `NOT DUE YET`.

`PRODUCTION VERIFIED` is intentionally rare. It requires runtime evidence against a real deployed service or real camera. The audit environment had no running Next process and no running Video Gateway (`curl` to `127.0.0.1:3000`, `:3001`, and `:8080` failed), so no live camera capability is marked production verified. Supabase production row counts and migration application state were also not independently confirmed from the available runtime.

Commands used:

- `rg --files -g '!node_modules'` and repository structure inspection.
- `npm run typecheck` — PASS.
- `npm run lint` — FAIL: 5,417 errors and 215 warnings, predominantly `@typescript-eslint/no-explicit-any`.
- `npm run build` — diagnostic run; no production runtime was available for post-build smoke verification in this audit environment.
- Local QA scripts: continuous monitor, object inference, event journal, event outbox, event manifest policy, event clip window, event evidence compatibility, discovery freshness, storage policy, observer-engine separation — PASS.
- Local QA scripts: `check-dvr-shared-session-and-offline.mjs` — FAIL (`Missing shared DVR session safeguard: relay.sessionToken`); `check-persistent-home-gateway.mjs` — FAIL (`Installer may print cloud configuration`).
- No credentials, media, or secrets were printed. No destructive actions or external provider sends were performed.

## CURRENT PRODUCT SNAPSHOT

These are evidence-based audit estimates, not operational KPIs. They reflect implementation maturity plus the absence of live production proof.

| Dimension | Score / 100 | Basis |
|---|---:|---|
| Overall Production Readiness | 35 | Broad code surface and schema, but no live runtime proof, lint failure, and many readiness/mock paths. |
| Autonomous Observer Readiness | 17 | Event/journal/rule scaffolding exists; AI worker is explicitly mock/local-shadow and human-review-only. |
| Camera Infrastructure Readiness | 43 | Gateway, FFmpeg, RTSP/ONVIF/DVR routes and health logic exist; real camera connection is unverified. |
| AI Intelligence Readiness | 20 | Object inference worker and policy vocabulary exist; product observer defaults to mock/shadow and no live model was proven. |
| Reliability Readiness | 38 | Retry/outbox/health contracts are tested locally; two reliability/security QA checks fail and no 24/7 run was observed. |
| Enterprise Readiness | 28 | Sites, memberships, RLS, roles, billing tables and audit concepts exist; scale, SSO, isolation and operations are not proven. |
| API/OEM Readiness | 22 | Many internal routes and gateway contracts exist; no documented stable external API/SDK/OEM package was found. |
| Acquisition Technical Readiness | 42 | Large, feature-rich repository and migrations; architecture is difficult to separate, lint is red, docs/runbooks and verified deployment evidence are incomplete. |

## Executive findings

1. The repository contains a substantial Digital Observer product shell: dedicated UI, onboarding, sites, cameras, people, rules, alerts, recordings, billing, settings, gateway enrollment and admin operations.
2. The production-facing product path is deliberately conservative. Onboarding writes readiness/demo metadata; live monitoring and real AI are not enabled by default.
3. There are two materially different systems: a relatively mature local Video Gateway/event-journal path, and a product AI observer path that is explicitly `mock`, `local_shadow`, synthetic-frame, and human-review-only.
4. Camera support is implemented as contracts and adapters, not proven as a connected real-camera fleet. RTSP/ONVIF/DVR/NVR labels in UI or schemas are not evidence of actual deployed support.
5. Recording/evidence design is stronger than the AI decision layer: bounded event windows, source anchors, signed media access and retention jobs exist in code/schema.
6. Billing and notifications have providers/readiness models, but Digital Observer billing is mock/readiness and push/email/SMS/WhatsApp real delivery is disabled or dry-run by policy in the inspected code.
7. Security intent is strong in several areas (server-side camera secrets, RLS, short playback tokens, signed URLs, audit records), but encryption currently falls back to `SUPABASE_SERVICE_ROLE_KEY` if `FIELD_ENCRYPTION_KEY` is absent, which is a production blocker.
8. The repository is not currently acquisition-ready as an asset without cleanup: 181 migrations, multiple legacy/parallel observer systems, 5,632 lint findings, and unclear separation between kindergarten safety product and standalone Digital Observer.

## 1. CURRENT ARCHITECTURE

### Current flow

```text
Camera / DVR / NVR / RTSP / ONVIF
        │
        ├─ local Video Gateway (Node + FFmpeg; optional Docker service)
        │       ├─ HLS relay / playback token
        │       ├─ probe / health / reconnect
        │       ├─ frame sampling + ONNX object worker
        │       ├─ local journal tracker + SQLite outbox
        │       └─ event evidence / clip capture
        │
        └─ Next.js App Router API routes
                ├─ Supabase auth/RLS/database/storage
                ├─ camera/event/gateway contracts
                ├─ mock/local-shadow AI observer and rules
                ├─ event journal, summaries, learning projections
                └─ UI notifications / signed media / admin views
                                │
                                └─ user review (human review required)
```

Frontend: Next.js 16 App Router, React 19, TypeScript, Framer Motion, HLS.js, Capacitor mobile shell. Evidence: `app/`, `components/digital-observer/`, `package.json`, `capacitor.config.ts`.

Backend: Next.js route handlers under `app/api`, domain services under `lib/domain`, Supabase server/admin/browser clients, Sentry instrumentation. Evidence: `app/api/`, `lib/api.ts`, `lib/supabase/*`, `instrumentation.ts`, `sentry.*.config.ts`.

Database: Supabase/Postgres with 181 migration files, RLS policies, observer sites/memberships, camera sources/streams, zones, AI events, correlated events, learning/baseline tables, clips, gateway registry, audit and billing tables. Evidence: `supabase/migrations/`, especially `20260820010000_digital_observer_product_runtime.sql`, `20260612016400_real_camera_gateway_dvr_nvr_home_pilot.sql`, `20260606004000_advanced_observer_intelligence.sql`.

Gateway: a separate Node service using FFmpeg/ffprobe, HLS relay, local files/tmp, in-memory relay/session state, optional SQLite command state, keychain-backed device secrets, cloud callbacks. Evidence: `services/video-gateway/server.mjs`, `continuous-monitor.mjs`, `journal-loop.mjs`, `event-evidence-store.mjs`, `private-nvr-command-runtime.mjs`, `services/video-gateway/Dockerfile`.

Storage: Supabase Storage for event media and other uploads; signed URLs are issued server-side. Gateway event capture uses local temporary workspace before cloud upload. Evidence: `app/api/video-gateway/cloud-event-media/route.ts`, `app/api/digital-observer/event-clips/[id]/media/route.ts`, `services/video-gateway/event-capture-workspace.mjs`.

Deployment: Vercel-oriented Next config plus Dockerfiles and Docker Compose for web/gateway/reverse-proxy. Vercel cron definitions exist for permit scan and event-media retention. Evidence: `vercel.json`, `Dockerfile`, `docker-compose.yml`, `services/video-gateway/Dockerfile`.

## 2–3. REAL CAMERA CONNECTIVITY AND DIGITAL-FIRST READINESS

The code contains RTSP, ONVIF, IP-camera, DVR/NVR, manufacturer API, cloud-provider, edge-gateway and demo connector descriptors. The connector contract requires server-side credentials and a Gateway for live/preview for non-demo types. Evidence: `lib/domain/digital-observer/connectors.ts`, `camera-connection-methods.ts`, `dvr-gateway.ts`, `app/api/video-gateway/rtsp-ingest/route.ts`, `onvif-discovery/route.ts`, `dvr-connections/route.ts`, `cloud-discovery/route.ts`.

Current reality:

- RTSP: implementation path exists in Gateway/route contracts; live deployment not verified.
- ONVIF: discovery route and configuration vocabulary exist; no real device discovery was observed.
- DVR/NVR: private NVR HTTP/MP4, channel mapping, preflight, heartbeat and command contracts exist; a local QA safeguard currently fails.
- Vendor cloud/API: generic cloud discovery and provider integration contracts exist; no vendor-specific production adapter was verified.
- WebRTC: playback fields and URL selection exist; no WebRTC runtime proof was found.
- Software/physical gateway: enrollment, device credentials, keychain, heartbeat, re-enrollment and Docker packaging exist; fleet/OTA/rollback are not complete.
- Digital-first ordering: not implemented as a universal automated resolver. It is represented by connector types/readiness and onboarding choices, with manual configuration and Gateway dependence for most real sources.

## 4. VIDEO PIPELINE

Gateway code supports upstream fetch/probe, FFmpeg decoding/transcoding, HLS relay, frame sampling, stale-input checks, reconnect/backoff, event clip windows, local temporary capture, cloud upload and a journal outbox. Evidence: `server.mjs`, `anchored-frame-decoder.mjs`, `hardware-transcoder.mjs`, `continuous-monitor.mjs`, `journal-tracker.mjs`, `event-clip-window.mjs`, `event-evidence-store.mjs`, `journal-loop.mjs`.

Classification: stream ingestion — `EXISTS — NEEDS QA`; decoding — `EXISTS — NEEDS QA`; frame sampling — `EXISTS — NEEDS QA`; buffering/freshness — `NEEDS HARDENING`; reconnect/failure detection — `EXISTS — NEEDS QA`; 24/7 operation — `PARTIAL`; sample/upload/fake paths — `MOCK / SIMULATED` where used by the product AI worker and demo connector. No end-to-end real-camera run was available.

## 5. AI PERCEPTION

The product observer uses `createLocalDetector()` with synthetic metadata and an explicit `local_shadow` mode. `lib/domain/ai-observer/worker.ts` creates a `mock` worker and `mock_detection` jobs; `detection-engine.ts`, `local-detector.ts` and `local-vision-adapter.ts` contain mock/shadow providers and scenario-based outputs. `services/video-gateway/object-inference-client.mjs` and `onnx-object-worker.mjs` provide a separate local object-inference foundation, but the audit did not prove it is connected to the product observer or a real camera in production.

| Capability | Status | Evidence / limitation |
|---|---|---|
| Person / presence | `MOCK / SIMULATED` | Local detector outputs synthetic person boxes; no live model proof. |
| Vehicle | `PARTIAL` | Event vocabulary and parking rules exist; no verified vehicle model/inference path. |
| Animal | `MISSING` | Templates mention animal; no verified detector pipeline found. |
| Motion / no-motion | `EXISTS — NEEDS QA` | Motion score and local shadow scenarios; real frame source not proven. |
| Fall / distress / crowding | `MOCK / SIMULATED` | Scenario vocabulary and rule mapping exist; generated as review indicators. |
| Smoke / fire | `PARTIAL` | Event validation vocabulary exists; no live detector/provider verified. |
| Abandoned/removed object | `MISSING` | No verified implementation found. |
| Camera obstruction/tamper | `MOCK / SIMULATED` | Shadow detector/event type exists; no live visual classifier verified. |
| Confidence handling | `EXISTS — NEEDS QA` | Confidence fields, severity mapping and validation contracts exist. |
| Model latency/performance | `MISSING` | No real production latency or FPS metric was found. |
| Failure behavior | `EXISTS — NEEDS QA` | Worker failures, bounded inference queue and stale-worker tests exist. |

## 6. TRACKING / IDENTITY / ZONES

The Gateway journal tracker supports stable event IDs, track IDs, spatial evidence, directional entry/exit and per-camera state. `event-validation-pipeline.ts`, `camera-zone-mapper.ts`, `journal-tracker.mjs`, `event-evidence-compatibility.ts` and `observer-engine/skeleton-journal.ts` provide schemas and validation.

- Object tracking / trajectories / first-seen / last-seen / duration: `EXISTS — NEEDS QA`; local journal logic and tests exist, but not real-camera verified.
- Zone entry/exit / restricted zones / line crossing: `EXISTS — NEEDS QA`; zone matrix and event compatibility tests pass locally.
- Known people: `PARTIAL`; `digital_observer_known_people` and consent/status fields exist.
- Face/biometric identity: `MISSING` for production use; the kindergarten engine explicitly rejects face/biometric data and known-person recognition is readiness/consent-gated.
- Cross-camera correlation: `PARTIAL`; `observer_correlated_events` schema/route/domain exists, but production correlation quality is unverified.

## 7. EVENTS & INCIDENTS

Normalized event concepts exist across multiple systems: `ai_camera_events`, Gateway journal events, `observer_correlated_events`, audio events, notifications and incident reports. Event validation normalizes aliases, maps severity (`INFO/WARNING/CRITICAL`), checks zone compatibility, health/passive evidence and recording policy. Evidence: `event-validation-pipeline.ts`, `event-evidence-compatibility.ts`, `event-journal-service.ts`, `app/api/digital-observer/event-journal/route.ts`.

Current distinction: Detection = model/local-detector output; Event = persisted camera signal/observation; Incident = higher-level case/report workflow, not consistently created from every observer event; Alert/Notification = user-facing delivery record, with mock/dry-run providers. Evidence: `worker.ts`, `incident-cases.ts`, `app/api/incidents/route.ts`, `event-engine/notifications.ts`.

| Capability | Status |
|---|---|
| Normalized event schema | `EXISTS — NEEDS QA` |
| Correlation and deduplication | `EXISTS — NEEDS QA` |
| Severity and evidence association | `EXISTS — NEEDS QA` |
| Incident creation/lifecycle | `PARTIAL` |
| Timeline | `PARTIAL` |
| Acknowledge/review/resolve | `EXISTS — NEEDS QA` |
| End-to-end detection → event → incident → alert on real video | `MISSING` |

## 8. CONTEXT / MEMORY / BEHAVIOR

Time zones, off-hours schedules, routine configuration, historical event queries, site/camera learning profiles, behavior baselines and feedback tables exist. `learning-engine.ts`, `home-learning-sampler.ts`, `advanced-learning-engine.ts`, `event-engine/off-hours.ts`, `observer-intelligence-engine.ts` and migrations for `observer_site_learning_profiles`, `camera_learning_profiles`, `site_behavior_baselines` support this.

Classification: time/site/schedule context — `EXISTS — NEEDS QA`; historical events — `EXISTS — NEEDS QA`; per-site/per-camera baseline — `PARTIAL`; anomaly detection — `MOCK / SIMULATED` or `PARTIAL` depending on path; autonomous AI memory — `MISSING`. The QA learning fixture is explicitly synthetic and no real behavior baseline was verified against a live deployment.

## 9–10. RULES, RISK AND NATURAL LANGUAGE

Structured rules, priorities, cooldowns, zones, watch requests, event types and severity decisions exist in `observer_rules`, `rule-engine.ts`, `observer-watch-request-engine.ts`, `event-validation-pipeline.ts` and related routes. Risk values are present in some event/baseline projections, but a unified production risk engine with calibrated explainability was not found.

Natural language conversation exists in `app/api/digital-observer/conversation/route.ts` and `guard-chat-query.ts`. It parses a limited keyword vocabulary, queries stored signals/cameras/baselines and returns templated answers. It does not demonstrate general natural-language rule parsing into a validated executable rule, nor does it demonstrate real-video investigation. Classification: search over stored metadata — `EXISTS — NEEDS QA`; NL rule compiler — `MISSING`; AI-generated text without real indexed evidence — `PARTIAL`.

## 11. ACTIONS & ALERTS

In-app notifications and delivery tables/routes exist. Push has FCM integration with explicit safety flags; email has provider adapters; SMS and WhatsApp have provider adapters, but inspected implementations use mock/dry-run or `canSendRealMessages: false` unless additional production policy is enabled. Evidence: `push-provider.ts`, `firebase-admin.ts`, `email-provider.ts`, `sms-provider.ts`, `whatsapp-provider.ts`, `notification-template-registry.ts`, `app/api/notifications/*`, `app/api/digital-observer/notifications/mock/route.ts`.

| Channel / behavior | Status |
|---|---|
| In-app | `EXISTS — NEEDS QA` |
| Push | `PARTIAL` — FCM path exists; real-send gate disabled by default |
| Email | `PARTIAL` — Resend/provider path and signed webhook exist; production delivery not verified |
| SMS | `MOCK / SIMULATED` — provider contracts/dry-run paths |
| WhatsApp | `MOCK / SIMULATED` — Meta/Twilio readiness but real send disabled |
| Webhooks | `EXISTS — NEEDS QA` — signature/idempotency framework exists |
| Retry/dedupe/rate limiting/escalation/quiet hours | `PARTIAL` |

## 12. EVIDENCE / RECORDING / STORAGE

Snapshot/event-media routes, bounded pre/post-event clip windows, source anchors, signed URLs, storage buckets, retention cron and delete paths exist. Evidence: `event-clip-window.mjs`, `event-evidence-store.mjs`, `app/api/video-gateway/cloud-event-media/route.ts`, `app/api/digital-observer/event-clips/[id]/media/route.ts`, `app/api/cron/digital-observer-event-media-retention/route.ts`, migration `20260827000100_digital_observer_event_media_evidence.sql`.

Classification: snapshots — `EXISTS — NEEDS QA`; event clips — `EXISTS — NEEDS QA`; pre/post windows — `EXISTS — NEEDS QA`; full-stream recording — `MISSING` as a product guarantee and deliberately not the default; retention/deletion/signed access — `EXISTS — NEEDS QA`; NAS/local provider abstraction — `PARTIAL`; provider-independent storage interface — `PARTIAL`.

## 13. CONNECTOR / GATEWAY / EDGE

Gateway enrollment, device identity, keychain references, refresh tokens, heartbeat, re-enrollment/rebind, local command runtime, watchdog-like health and Docker packaging exist. Evidence: `gateway-device-enrollment.sql`, `gateway-enrollment/route.ts`, `services/video-gateway/keychain-store.mjs`, `device-refresh.mjs`, `private-nvr-heartbeat.mjs`, `private-nvr-command-runtime.mjs`, `edge-readiness.mjs`.

Real: local Gateway service and protocol contracts — `EXISTS — NEEDS QA`. Not proven: fleet management, OTA, rollback, certificate lifecycle, offline buffering/resync across fleet, remote diagnostics at scale — `MISSING` or `PARTIAL`. The persistent gateway installer QA currently fails because it may print cloud configuration.

## 14. CHEAP PREPROCESSING & AI INFRASTRUCTURE

Motion scores, frame sampling, bounded concurrency, local object worker, queue/retry concepts, event candidate filtering, model readiness and local-vs-cloud fields exist. Evidence: `journal-tracker.mjs`, `continuous-monitor.mjs`, `object-inference-client.mjs`, `onnx-object-worker.mjs`, `observer-frame-sampling-jobs` migration, `event-manifest-policy.ts`.

Classification: cheap preprocessing — `EXISTS — NEEDS QA`; adaptive/routed AI pools — `PARTIAL`; real edge/cloud/dedicated routing — `MISSING`; expensive AI on every frame — not evidenced as mandatory in the inspected Gateway path, but actual production cost behavior is unverified.

## 15. PORTABLE INFRASTRUCTURE

Docker packaging for web and Gateway exists, environment-driven configuration is used widely, and Compose defines web/gateway/reverse-proxy. However, the application has Vercel assumptions, local keychain/tmp assumptions, hardcoded browser origins, local loopback media policy and unresolved provider/runtime dependencies. Classification: containers — `EXISTS — NEEDS QA`; portability — `PARTIAL`; single points of failure — `NEEDS HARDENING`.

Key SPOFs: one Supabase project/database/storage dependency; one Gateway instance per local deployment; in-memory relay/session maps; local temp/HLS files; one Next/Vercel deployment; no demonstrated worker autoscaling/failover; no demonstrated cross-region recovery.

## 16. MULTI-TENANCY / ENTERPRISE

Organization-like hierarchy is represented by `observer_sites`, memberships, profiles/roles, gardens, cameras, rules, events and incidents. RLS and scoped policies are present in migrations, including Digital Observer product runtime and observer membership recursion fixes.

Classification: site/user hierarchy — `EXISTS — NEEDS QA`; tenant isolation/RLS — `EXISTS — NEEDS QA`; RBAC — `PARTIAL`; multi-site — `EXISTS — NEEDS QA`; service accounts/API clients/SSO — `MISSING` or `PARTIAL`; enterprise policy/audit — `PARTIAL`.

## 17. PRODUCT UI → REAL BACKEND

| Screen | Status | Evidence |
|---|---|---|
| Login/register/verification | `EXISTS — NEEDS QA` | `app/digital-observer/login`, `register`, `verify`, Supabase auth routes |
| Onboarding | `PARTIAL` | `onboarding/page.tsx`, `onboarding/route.ts`; writes readiness/demo metadata |
| Add camera | `PARTIAL` | `cameras/add`, `observer-action-forms.tsx`; non-demo waits for Gateway/provider |
| Live View | `PARTIAL` | `observer-live-player.tsx`, `video-streaming.ts`; real stream not verified |
| Dashboard | `EXISTS — NEEDS QA` | `dashboard/page.tsx`, `runtime.ts` |
| Events/alerts | `PARTIAL` | `alerts/page.tsx`, event journal/review routes; real ingestion unverified |
| Incidents | `PARTIAL` | `app/api/incidents/route.ts`, `incident-cases.ts` |
| People/faces | `UI ONLY` | `people/page.tsx`, known-people route; identity remains readiness/consent-gated |
| Rules / natural language | `PARTIAL` | `rules/page.tsx`, conversation route, observer rules |
| Search/investigation | `PARTIAL` | keyword search over stored signals; no general video investigation |
| Recordings/evidence | `PARTIAL` | recordings page and signed media routes; capture/live integration unverified |
| Notifications | `PARTIAL` | settings and notification routes; providers mocked/dry-run |
| Billing/subscription | `MOCK / SIMULATED` | `billing/route.ts`, `billing/page.tsx`, future/manual payment adapters |
| Sites | `EXISTS — NEEDS QA` | sites pages/runtime and `observer_sites` |
| Settings/permissions | `PARTIAL` | settings/access routes; enterprise permission coverage incomplete |
| Device health/admin Gateway | `PARTIAL` | admin operations/camera gateway dashboards; local runtime absent |

## 18. API / SDK / OEM

There are numerous internal REST-style Next route handlers and server-to-server Gateway routes, plus webhook endpoints and some realtime/client refresh behavior. Evidence: `app/api/`, `lib/domain/video-gateway-client.ts`, `lib/domain/digital-observer/integration-contract.ts`, `provider-webhooks.ts`.

Classification: internal APIs — `EXISTS — NEEDS QA`; external stable API — `MISSING`; API versioning — `MISSING`; public documentation — `MISSING`; API auth/service accounts — `PARTIAL`; SDK/OEM/white-label — `MISSING`. An external company cannot currently be shown to use the core without the UI through a documented, stable, supported contract.

## 19. SECURITY

Positive controls found: server-side Supabase admin client, browser-safe camera columns, server-side camera authorization checks, RLS migrations, short-lived playback tokens, signed media URLs, signed provider webhooks, rate-limit table, audit log service, CSP/security headers, no-browser-credentials intent, and encrypted sensitive-field helpers.

Critical production blockers:

1. `lib/security/encryption.ts` falls back from `FIELD_ENCRYPTION_KEY` to `SUPABASE_SERVICE_ROLE_KEY`; key separation is not enforced.
2. No live deployment/runtime verification of RLS, signed media access, camera secret non-exposure, or tenant isolation was possible.
3. `npm run lint` is red with 5,417 errors, reducing confidence in security-sensitive refactors and reviewability.
4. Demo/mock paths and QA credentials/scripts exist in the repository; they require strict environment and deployment exclusion review.
5. Browser CSP includes `'unsafe-inline'` and `'unsafe-eval'` for Digital Observer, materially weakening the policy.
6. Gateway/browser origin allow-list has built-in production origins and local loopback access; deployment-specific verification is required.
7. Failed persistent-gateway QA indicates a possible secret/configuration disclosure path.

Classification: security architecture — `NEEDS HARDENING`; auth/RLS — `EXISTS — NEEDS QA`; secret handling — `NEEDS HARDENING`; audit logs — `EXISTS — NEEDS QA`; rate limits — `EXISTS — NEEDS QA`; verified production security posture — `MISSING`.

## 20. PRIVACY

Privacy intent is explicit: kindergarten skeleton/pose-only policy, no face/biometric fields, no raw frame storage for the skeleton journal, parent visibility restrictions, consent-gated known people, storage retention and right-to-be-forgotten script. Evidence: `observer-engine/policy.ts`, `skeleton-journal.ts`, `standard-privacy-policy.ts`, `privacy/data-subject-scope.ts`, `scripts/right-to-be-forgotten.mjs`, relevant migrations.

Classification: retention/deletion — `EXISTS — NEEDS QA`; face/identity privacy — `EXISTS — NEEDS QA` for restricted kindergarten mode, `PARTIAL` for standalone identity readiness; masks/consent/export — `PARTIAL`; independently verified compliance — `MISSING`.

## 21. OBSERVABILITY

Sentry, Gateway request/relay metrics, health endpoints, camera health history, job logs, audit events, worker readiness and storage/provider delivery records exist. Evidence: `instrumentation.ts`, `relay-input-metrics.mjs`, `camera-health.ts`, `observer_job_logs`/health migrations, provider production dashboard.

Missing or unproven: reliable camera uptime SLA, inference FPS/latency dashboards, end-to-end event/notification latency, queue depth across all workers, fleet CPU/GPU/RAM/disk/bandwidth, cost-linked telemetry, alerting on operational SLOs. Classification: `PARTIAL`.

## 22. QUALITY METRICS

Schema and fixtures exist for pilot runs, ground truth reviews, calibration profiles, quality snapshots and performance snapshots. Evidence: `20260612016500_real_ai_observer_pilot_shadow_calibration.sql`, `20260607002000_observer_test_calibration_platform.sql`, `20260608002000_digital_observer_calibration_training_program.sql`.

Actual measured precision, recall, false-positive rate, false-negative rate, alerts/camera/day, detection latency and incident latency were not found in the repository/runtime evidence. Classification: metric framework — `PARTIAL`; real quality measurement — `MISSING`.

## 23. COST ENGINE

Usage tracking, subscription usage snapshots, billing tables and provider readiness/cost dashboard concepts exist. Evidence: `observer_usage_tracking`, `observer_site_usage_snapshots`, `observer_product_analytics` migrations and admin provider-production UI.

No verified calculation pipeline for GPU time, AI calls/tokens, CPU, bandwidth, storage, notification cost, cost/camera/hour, cost/camera/month or cost/tenant was found. Classification: `PARTIAL` for schema/readiness; live cost engine — `MISSING`.

## 24. SCALE / RELIABILITY

Local reliability contracts include bounded concurrency, retries, backoff/jitter, outbox, restart recovery, stale input handling and 16-camera failure isolation. Evidence: passing local QA scripts listed at the top and `continuous-monitor.mjs`, `journal-loop.mjs`.

Not demonstrated: queues/workers as horizontally scalable services, autoscaling, load balancing, failover, backpressure under 100+ cameras, database partitioning, storage throughput, AI capacity planning, or multi-region recovery. Classification: 10-camera pilot — `PARTIAL`; 100-camera — `MISSING`; 1,000/10,000-camera — `MISSING`.

## 25. TESTING

Inventory: many local unit/contract/security/privacy/observer/gateway scripts under `scripts/qa`, including synthetic event, journal, policy, gateway, tenant-boundary, diagnostics, learning and UI scripts. `npm run typecheck` passes. There is no evidence in the repository of a CI workflow executing the full QA suite; `package.json` exposes selected scripts but not a comprehensive CI contract.

Classification: unit/contract tests — `EXISTS — NEEDS QA`; integration tests — `PARTIAL`; E2E UI — `EXISTS — NEEDS QA` via Playwright script but requires demo server/accounts; real camera tests — `MISSING`; AI quality/load/chaos/regression CI — `MISSING` or `PARTIAL`.

## 26. REAL-WORLD READINESS

| Target | Status | Rationale |
|---|---|---|
| 24/7 home pilot | `PARTIAL` | Gateway and home learning concepts exist; no live 24/7 run proof. |
| Multiple homes | `MISSING` | Tenant/fleet isolation and operational capacity not proven. |
| Business pilot | `PARTIAL` | Site templates, zones and dashboard exist; live detection/alert chain unverified. |
| 100+ camera pilot | `MISSING` | No scale/load/failover evidence. |
| Monitoring center | `MISSING` | No proven escalation/SLA/operator console workflow. |
| Enterprise customer | `MISSING` | SSO, service accounts, support/runbooks, SLOs and scale are incomplete. |

## 27. ACQUISITION / TECHNICAL DD READINESS

Strengths: commit history exists, environment examples exist, Dockerfiles exist, migrations are explicit, security/privacy intent is documented in code, and there is meaningful test/QA inventory.

Gaps: no single architecture document before this audit, no stable public API/SDK documentation, no verified deployment/runbook package, 181 migrations and parallel/legacy systems, lint red, real-camera evidence absent, mock/demo code mixed with product code, unclear IP/license/dependency ownership package, and no completed model/vendor dependency register. Classification: `NEEDS HARDENING`.

## 28. DISCOVERED CAPABILITIES NOT EXPLICITLY CALLED OUT

- A kindergarten-specific observer engine with hard privacy assertions and skeleton-only event vocabulary: `lib/domain/observer-engine/*`.
- Immutable/auditable event and integration metadata patterns, including pgcrypto regression QA.
- Private NVR physical-command safety contracts with lease, preflight, heartbeat, audit signing and no-physical-command sentinel behavior.
- Event evidence anchoring designed to prevent cross-camera, stale, future or mismatched clip substitution.
- Local home learning sampler with per-camera baseline isolation and synthetic QA fixture.
- Gateway device enrollment and atomic re-enrollment/rebind concepts.
- Product-specific retention ceiling for Digital Observer event clips (migration constraint: 48 hours maximum).
- Address resolution/autocomplete and site templates for home, kiosk, retail, office, warehouse, clinic, restaurant and child-education use cases.
- Mobile Capacitor packaging for Android/iOS.

These are valuable foundations, but should enter the future roadmap only after ownership, deployment status, and real-runtime verification are clarified.

# FINAL MASTER MATRIX

| ID | Capability | Current Status | Current Implementation | Evidence | Real Camera Verified? | Production Ready? | Security Risk | Reliability Risk | Scale Risk | Recommended Action | Recommended Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ARC-01 | Next.js frontend | EXISTS — NEEDS QA | App Router, React, TS | `app/`, `package.json` | NO | NO | M | M | M | VERIFY | P1 |
| ARC-02 | Next.js API backend | EXISTS — NEEDS QA | Route handlers/domain services | `app/api/`, `lib/domain/` | NO | NO | H | M | H | VERIFY | P1 |
| ARC-03 | Supabase DB/auth/storage | EXISTS — NEEDS QA | Clients, migrations, RLS | `lib/supabase/`, `supabase/migrations/` | NO | NO | H | M | H | VERIFY | P1 |
| ARC-04 | Separate Video Gateway | EXISTS — NEEDS QA | Node + FFmpeg service | `services/video-gateway/` | NO | NO | H | H | H | VERIFY | P0 |
| CAM-01 | RTSP ingest | EXISTS — NEEDS QA | Gateway/route contracts | `rtsp-ingest/route.ts`, `server.mjs` | NO | NO | H | H | H | VERIFY | P0 |
| CAM-02 | ONVIF discovery | EXISTS — NEEDS QA | Discovery route/config | `onvif-discovery/route.ts`, `camera-connection-methods.ts` | NO | NO | H | H | H | VERIFY | P0 |
| CAM-03 | DVR/NVR channels | PARTIAL | Local config/channel mapping | `dvr-gateway.ts`, `server.mjs` | NO | NO | H | H | H | HARDEN | P0 |
| CAM-04 | Vendor cloud/API | PARTIAL | Generic cloud discovery | `cloud-discovery/route.ts` | NO | NO | H | H | H | COMPLETE | P2 |
| CAM-05 | WebRTC playback | PARTIAL | URL fields/selection | `video-streaming.ts` | NO | NO | M | H | M | VERIFY | P2 |
| CAM-06 | Gateway credentials | NEEDS HARDENING | Keychain/server refs | `keychain-store.mjs`, encryption helper | NO | NO | C | H | M | HARDEN | P0 |
| CAM-07 | Reconnect/failure detection | EXISTS — NEEDS QA | stale/backoff/retry | `continuous-monitor.mjs` | NO | NO | M | H | H | VERIFY | P0 |
| VID-01 | FFmpeg decode/transcode | EXISTS — NEEDS QA | ffmpeg/ffprobe subprocesses | `anchored-frame-decoder.mjs`, `hardware-transcoder.mjs` | NO | NO | M | H | M | VERIFY | P1 |
| VID-02 | Frame sampling | EXISTS — NEEDS QA | bounded sampler | `journal-tracker.mjs`, `journal-loop.mjs` | NO | NO | M | H | H | VERIFY | P1 |
| VID-03 | Frozen stream detection | PARTIAL | stale timestamps/input checks | `server.mjs`, detector vocabulary | NO | NO | M | H | M | HARDEN | P1 |
| VID-04 | 24/7 operation | PARTIAL | loops/restart logic | Gateway service + Docker healthcheck | NO | NO | M | C | H | VERIFY | P0 |
| AI-01 | Local object inference | EXISTS — NEEDS QA | ONNX worker/client | `onnx-object-worker.mjs`, `object-inference-client.mjs` | NO | NO | M | H | H | VERIFY | P1 |
| AI-02 | Product observer worker | MOCK / SIMULATED | mock jobs/local shadow | `lib/domain/ai-observer/worker.ts` | NO | NO | M | H | H | REPLACE | P0 |
| AI-03 | Person detection | MOCK / SIMULATED | synthetic boxes/scenarios | `local-vision-adapter.ts` | NO | NO | H | H | H | REPLACE | P0 |
| AI-04 | Vehicle detection | PARTIAL | event vocabulary/rules | `event-validation-pipeline.ts`, templates | NO | NO | M | H | H | BUILD | P2 |
| AI-05 | Animal detection | MISSING | template target only | `site-templates.ts` | NO | NO | M | M | M | BUILD | P3 |
| AI-06 | Motion/no-motion | EXISTS — NEEDS QA | motion score/shadow logic | `local-detector.ts`, learning sampler | NO | NO | M | H | H | VERIFY | P1 |
| AI-07 | Fall/distress/crowding | MOCK / SIMULATED | scenario vocabulary | `detection-engine.ts`, `policy.ts` | NO | NO | H | H | H | REPLACE | P1 |
| AI-08 | Smoke/fire | PARTIAL | event types/validation only | `event-validation-pipeline.ts` | NO | NO | H | H | H | BUILD | P2 |
| AI-09 | Tamper/obstruction | MOCK / SIMULATED | shadow event type | `local-vision-adapter.ts` | NO | NO | H | H | M | REPLACE | P1 |
| AI-10 | Confidence/latency metrics | MISSING | fields exist, measurements absent | `confidence` fields; no runtime metric | NO | NO | M | H | H | BUILD | P1 |
| TRK-01 | Track IDs/trajectories | EXISTS — NEEDS QA | journal tracker state | `journal-tracker.mjs` | NO | NO | M | H | H | VERIFY | P1 |
| TRK-02 | Zone entry/exit/line crossing | EXISTS — NEEDS QA | zone matrix/compatibility | `camera-zone-mapper.ts`, QA scripts | NO | NO | H | H | H | VERIFY | P0 |
| TRK-03 | Known people/consent | PARTIAL | consent-gated table/routes | `digital_observer_known_people`, known-people route | NO | NO | C | H | M | HARDEN | P1 |
| TRK-04 | Face recognition/LPR | MISSING | explicitly blocked/readiness | `observer-engine/policy.ts` | NO | NO | C | H | H | LATER | P3 |
| TRK-05 | Cross-camera correlation | PARTIAL | correlated event schema/route | `observer_correlated_events` | NO | NO | H | H | H | VERIFY | P2 |
| EVT-01 | Normalized events | EXISTS — NEEDS QA | event validation/journal | `event-validation-pipeline.ts` | NO | NO | H | H | H | VERIFY | P0 |
| EVT-02 | Dedupe/suppression | EXISTS — NEEDS QA | cooldown/outbox/idempotency | `rule-engine.ts`, `journal-loop.mjs` | NO | NO | M | H | H | VERIFY | P1 |
| EVT-03 | Incident lifecycle | PARTIAL | incident routes/cases | `incident-cases.ts`, `app/api/incidents` | NO | NO | H | H | H | COMPLETE | P1 |
| EVT-04 | Evidence association | EXISTS — NEEDS QA | source anchors/clip records | `event-evidence-store.mjs`, clip migration | NO | NO | H | H | H | VERIFY | P0 |
| CTX-01 | Time/off-hours/site context | EXISTS — NEEDS QA | schedule/timezone rules | `event-engine/off-hours.ts` | NO | NO | M | M | M | VERIFY | P1 |
| CTX-02 | Behavior baseline | PARTIAL | per-site/camera projections | `learning-engine.ts`, baseline tables | NO | NO | M | H | H | HARDEN | P1 |
| CTX-03 | Autonomous memory | MISSING | history/baselines only | no decision-grade memory found | NO | NO | M | H | H | BUILD | P3 |
| RULE-01 | Structured WHEN/conditions/THEN | PARTIAL | observer rules/watch requests | `rule-engine.ts`, `observer_rules` | NO | NO | H | H | H | COMPLETE | P1 |
| RULE-02 | Unified risk engine | MISSING | scattered risk fields only | `home-learning-sampler.ts` | NO | NO | H | H | H | BUILD | P1 |
| NLU-01 | Natural-language query | EXISTS — NEEDS QA | keyword filters over stored data | `conversation/route.ts` | NO | NO | M | H | M | VERIFY | P2 |
| NLU-02 | Natural-language rule compiler | MISSING | no validated compiler found | conversation route only | NO | NO | H | H | H | BUILD | P2 |
| NLU-03 | Video investigation | MISSING | no real indexed video search | recordings/search surfaces | NO | NO | H | H | H | BUILD | P3 |
| ALT-01 | In-app alert | EXISTS — NEEDS QA | notification rows/routes | `app/api/notifications`, worker | NO | NO | M | H | M | VERIFY | P1 |
| ALT-02 | Push delivery | PARTIAL | FCM adapter with safety gate | `push-provider.ts` | NO | NO | H | H | M | VERIFY | P2 |
| ALT-03 | Email delivery | PARTIAL | Resend/provider + webhook | `email-provider.ts`, webhooks | NO | NO | H | H | M | VERIFY | P2 |
| ALT-04 | SMS/WhatsApp | MOCK / SIMULATED | dry-run/mock adapters | `sms-provider.ts`, `whatsapp-provider.ts` | NO | NO | H | H | M | LATER | P3 |
| EVD-01 | Event clip window | EXISTS — NEEDS QA | bounded pre/post planner | `event-clip-window.mjs` | NO | NO | H | H | H | VERIFY | P0 |
| EVD-02 | Signed media access | EXISTS — NEEDS QA | server-side signed URLs | media route | NO | NO | C | H | M | VERIFY | P0 |
| EVD-03 | Retention/deletion | EXISTS — NEEDS QA | cron/storage remove | retention route/migration | NO | NO | C | M | H | VERIFY | P1 |
| EVD-04 | Provider-independent storage | PARTIAL | Supabase-centric adapter paths | `app/api/storage`, gateway upload | NO | NO | M | H | H | HARDEN | P2 |
| EDG-01 | Gateway enrollment | EXISTS — NEEDS QA | device enrollment/rebind | `gateway-device-enrollment.sql`, route | NO | NO | C | H | H | VERIFY | P1 |
| EDG-02 | OTA/rollback/fleet | MISSING | no complete fleet system | gateway files only | NO | NO | H | C | C | LATER | P3 |
| INF-01 | Cheap preprocessing | EXISTS — NEEDS QA | motion/sample/bounded inference | Gateway journal/object worker | NO | NO | M | H | H | VERIFY | P1 |
| INF-02 | Routing/local-vs-cloud AI | PARTIAL | readiness/provider fields | `event-manifest-policy.ts` | NO | NO | H | H | H | BUILD | P2 |
| ENT-01 | Sites/memberships/RLS | EXISTS — NEEDS QA | scoped schemas/policies | observer runtime migrations | NO | NO | C | H | H | VERIFY | P0 |
| ENT-02 | RBAC/permissions | PARTIAL | roles/access checks | `lib/roles.ts`, `access.ts` | NO | NO | C | H | H | HARDEN | P0 |
| ENT-03 | SSO/service accounts | MISSING | no stable implementation found | route inventory | NO | NO | C | M | H | LATER | P3 |
| API-01 | Internal REST API | EXISTS — NEEDS QA | Next route handlers | `app/api/` | NO | NO | H | H | H | VERIFY | P1 |
| API-02 | Stable external API/SDK/OEM | MISSING | no versioned public package/docs | `integration-contract.ts` only | NO | NO | H | M | H | BUILD | P3 |
| SEC-01 | Encryption key separation | NEEDS HARDENING | service-role fallback | `lib/security/encryption.ts` | NO | NO | C | M | M | HARDEN | P0 |
| SEC-02 | CSP/security headers | NEEDS HARDENING | strong headers with unsafe directives | `next.config.ts` | NO | NO | H | M | M | HARDEN | P1 |
| SEC-03 | Audit logs/rate limits | EXISTS — NEEDS QA | DB-backed services | `audit-log-service.ts`, `rate-limit.ts` | NO | NO | H | H | H | VERIFY | P1 |
| PRIV-01 | Privacy/pose-only policy | EXISTS — NEEDS QA | assertions and restricted schema | `observer-engine/policy.ts` | NO | NO | C | H | M | VERIFY | P0 |
| OBS-01 | Sentry/health/logs | EXISTS — NEEDS QA | instrumentation/metrics/health | `instrumentation.ts`, Gateway health | NO | NO | M | H | H | VERIFY | P1 |
| OBS-02 | End-to-end SLO dashboards | MISSING | no verified complete telemetry | provider/admin surfaces | NO | NO | M | C | C | BUILD | P2 |
| QUA-01 | Quality metric framework | PARTIAL | calibration/ground truth tables | calibration migrations | NO | NO | M | H | H | COMPLETE | P2 |
| COST-01 | Cost engine | MISSING | usage/readiness schema only | billing/usage migrations | NO | NO | M | H | C | BUILD | P2 |
| REL-01 | 10-camera reliability | PARTIAL | 16-camera isolation tests | event outbox/journal QA | NO | NO | M | H | H | VERIFY | P1 |
| REL-02 | 100+ camera scale | MISSING | no load/autoscale proof | no evidence found | NO | NO | H | C | C | BUILD | P2 |
| TEST-01 | Typecheck | PRODUCTION VERIFIED | command passes in audit environment | `npm run typecheck` | N/A | NO | M | M | M | VERIFY | P1 |
| TEST-02 | Lint health | BROKEN | 5,417 errors/215 warnings | `npm run lint` | N/A | NO | M | H | H | HARDEN | P0 |
| TEST-03 | Local gateway/event contracts | EXISTS — NEEDS QA | selected scripts pass | `scripts/qa/*` | NO | NO | M | H | H | VERIFY | P1 |
| TEST-04 | Real-camera E2E | MISSING | no running camera/runtime evidence | runtime probe failed | NO | NO | C | C | C | BUILD | P0 |
| DD-01 | Acquisition documentation | NEEDS HARDENING | no single complete DD pack | repo/docs inventory | N/A | NO | M | C | H | COMPLETE | P1 |

Security risk legend: `C` critical, `H` high, `M` medium, `L` low. “Real Camera Verified?” is `NO` unless a real stream was actually observed in this audit.

# WHAT WE SHOULD NOT BUILD AGAIN

- Basic Digital Observer UI shell and navigation.
- Supabase client/auth/RLS foundation and observer-site membership concepts.
- Camera source/readiness model and server-side secret-reference pattern.
- Gateway HTTP service foundation, FFmpeg relay/probe, HLS playback token model and health checks.
- Local event journal, outbox, retry/backoff, dedupe and camera outage grouping foundations.
- Source-anchored event evidence and bounded clip-window planning.
- Privacy-first kindergarten skeleton/pose-only policy and identity prohibition checks.
- Site templates, time/off-hours context, watch requests and basic structured rule engine.
- Learning/baseline schema and synthetic isolation fixture.
- Signed media access and event-media retention scaffolding.
- Gateway device enrollment/re-enrollment and private NVR safety contracts.

# WHAT ONLY NEEDS QA

- RTSP/ONVIF/DVR/NVR connection paths against the actual pilot environment.
- Gateway live playback, health, reconnect and 24/7 behavior.
- Event journal/outbox/media chain with real camera timestamps and real storage.
- RLS/tenant boundaries, signed URLs, parent/staff/inspector access and audit logging in the deployed Supabase project.
- UI authenticated flows using a controlled QA environment.
- FCM/Resend webhook behavior after provider sandbox configuration.

# WHAT NEEDS HARDENING

- Secret key separation and camera credential lifecycle.
- Lint/type safety and duplicated legacy/observer systems.
- Persistent gateway installer disclosure behavior.
- Shared DVR session contract (`relay.sessionToken` QA failure).
- Gateway fleet reliability, durable state, failover and operational telemetry.
- Unified event/incident/alert model and production-ready notification semantics.
- CSP and deployment-specific origin policy.
- Acquisition documentation, dependency/license/IP inventory and runbooks.

# WHAT IS ACTUALLY MISSING

- Verified real-camera production runtime.
- Production AI observer connected to live frames with a real, measured model/provider.
- Calibrated precision/recall/false-positive/false-negative metrics.
- Unified risk engine and decision explainability.
- General natural-language rule compiler and real video investigation/search.
- Proven abandoned/removed-object, animal, robust smoke/fire and cross-camera identity capabilities.
- Stable external API/SDK/OEM package and versioned documentation.
- Horizontal scale/autoscaling/failover for 100–10,000 cameras.
- Fleet OTA/rollback/certificates/offline resync.
- End-to-end cost attribution engine.
- Enterprise SSO/service accounts and complete support/SLO operations.

# TOP 10 REAL BLOCKERS

1. No verified live runtime connecting a real camera through Gateway to a user-visible event.
2. Product AI observer is explicitly mock/local-shadow/synthetic and cannot support autonomous production decisions.
3. No measured model quality or operational latency metrics.
4. No production-scale worker/queue/backpressure/failover architecture proven beyond local contracts.
5. Camera/NVR shared-session safeguard QA is failing.
6. Persistent home Gateway installer QA reports possible cloud-configuration disclosure.
7. Encryption key separation is not enforced because sensitive-field encryption can fall back to the Supabase service-role key.
8. Lint is broken at repository scale, with 5,417 errors and 215 warnings.
9. Event, incident, alert, notification and provider systems are spread across parallel/legacy domains, making production behavior difficult to reason about.
10. No stable external API/SDK/OEM, deployment runbooks, complete telemetry/cost engine or acquisition-grade dependency/IP documentation.

## Stop condition

Audit completed. No roadmap feature, broad refactor, or issue fix was implemented. The only repository change is this report: `DIGITAL_OBSERVER_MASTER_AUDIT.md`.
