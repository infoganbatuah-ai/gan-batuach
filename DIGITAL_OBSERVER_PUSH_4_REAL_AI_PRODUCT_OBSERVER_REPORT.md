# DIGITAL OBSERVER — PUSH 4

## FINAL STATUS

**FAIL — PRODUCT OBSERVER INTEGRATION**

The canonical real-event boundary, mock isolation, status truth logic, and a real Journal event were implemented and tested. PUSH 4 cannot be marked PASS because the final production deployment that retains the stream binding was blocked by Vercel's missing dedicated `FIELD_ENCRYPTION_KEY`, and an authorized product-UI rendering of the new event could not be captured in this run.

## BEFORE ARCHITECTURE

### Current real path

`real DVR → local Gateway relay → ONNX → JournalTracker → durable outbox → authenticated cloud event ingest → observer_intelligence_signals → EventJournalService → Digital Observer UI`

### Legacy mock/shadow path

`admin/mock worker or watch-request trigger → local_shadow/mock detector → ai_camera_events`

The legacy path uses a distinct table and is for kindergarten/test/calibration workflows. It is not the real Digital Observer camera-event path.

## TARGET / CANONICAL ARCHITECTURE

For an enabled real Digital Observer site, camera truth is accepted only from the authenticated Gateway event ingest path. The product journal consumes `observer_intelligence_signals` with canonical provenance; it does not create a second inference result from `ai_camera_events`.

## MOCK / SHADOW INVENTORY

| Component | Classification | Result |
|---|---|---|
| Gateway ONNX + Journal | Active production real path | Canonical |
| Cloud event ingest | Active production real path | Canonical |
| `EventJournalService` | Active product read path | Filters mock/shadow/simulation camera observations |
| `ai-observer/worker.ts` | Test/legacy mock path | Rejects a camera belonging to a real Observer site |
| `observer-watch-requests` `trigger_mock` | Test/legacy mock path | Returns 409 for a real Observer site |
| `ai_camera_events` dashboards | Test/shadow/legacy | Not used by the Digital Observer dashboard event path |

## CHANGES APPLIED

- Added `lib/domain/digital-observer/observation-provenance.ts`.
  - Accepts `REAL_CAMERA_AI` and `CAMERA_NATIVE_EVENT` camera observations.
  - Rejects `SIMULATION`, `SHADOW_AI`, `mock`, `synthetic`, `local_shadow`, and simulation source modes from the product camera journal.
- Updated `EventJournalService` to enforce that boundary before grouping/rendering events.
- Updated authenticated Gateway ingestion to persist `observation_provenance: REAL_CAMERA_AI` and model provenance.
- Added a pending source-stream persistence fix (`stream_id`) with an ingest regression assertion. The change is locally verified but is not active in production because the follow-up Vercel build failed safely.
- Blocked mock watch-event creation for real Observer sites.
- Blocked the legacy mock worker from selecting a camera tied to a real Observer site.
- Replaced the dashboard's consent-only “monitoring active” label with truthful states: real monitoring active, real camera/Observer degraded, camera online with AI unverified, offline, or demo/simulation.

## EVENT PROVENANCE

The cloud ingestion route records real Gateway events as `REAL_CAMERA_AI`. Existing authenticated `system` records from before this marker remain readable for compatibility, while explicit mock/shadow/simulation camera rows are hidden from the product journal.

## PRODUCT OBSERVER INTEGRATION

The production deployment `dpl_5vSUSc2dwk8gXa9d24WthPyekwRU` completed successfully and contains the canonical provenance, mock isolation, and status-truth changes.

The attempted follow-up deployment `dpl_GQBRre8wRQ2gumPYYbfy6ZDNLxHX` failed its production safety check because Vercel production does not currently define `FIELD_ENCRYPTION_KEY` or `FIELD_ENCRYPTION_KEY_CURRENT`. The system correctly refused to fall back to `SUPABASE_SERVICE_ROLE_KEY`.

## RULE INPUT RESULT

The real Gateway event passes the existing event validation, zone/evidence compatibility, Journal grouping, notification, and Digital Guard action paths. The mock watch-request trigger remains deliberately unavailable for real sites; it cannot become a competing rule input.

## LEARNING INPUT RESULT

Home learning samples activity only through the local Gateway activity-insight endpoint with `local_processing: true` and `no_raw_video_returned: true`. It does not use `mock` or `local_shadow` detections as real-site activity data.

## ALERT INPUT RESULT

Authenticated real event ingestion invokes the existing notification and Digital Guard action paths. No SMS or WhatsApp provider was enabled. Delivery is governed by current site policy.

## REAL PERSON E2E RESULT

**REAL — 2026-09-05 11:41:05Z to 11:41:09Z**

| Step | Result | Evidence |
|---|---|---|
| Real person / DVR channel 11 | PASS | Controlled physical pass on the verified entrance source |
| Gateway / ONNX | PASS | Three distinct real source sequences during diagnostic pass; Journal-only pass produced an event with confidence 0.983 |
| Journal event | PASS | Event `049e28c4-6f89-463a-b15e-40a41bab1aec` automatically created at `2026-09-05T11:41:07.121Z` |
| DB persistence | PASS | Correct site `cc1673b8-3eb0-4785-a12c-1fb88f425a41`, camera `e9f8abf3-5895-494e-b1cf-ea8818602851`, `source_type: system`, `REAL_CAMERA_AI`, validated event, model `ssd_mobilenet_v1_10` |
| Evidence | NOT APPLICABLE | Current event policy set `recording_required: false`; `media_status: not_required` |
| Product UI | NOT VERIFIED | Local browser automation timed out twice before an authorized UI render could be captured |

The diagnostic video segments were local-only and deleted immediately after analysis.

## DUPLICATE CHECK

The Journal-only pass produced one new real normalized event for the controlled window. The outbox reported `pending: 0` and `delivery_failures: 0`. The mock worker and mock watch request entry points are blocked for this real site; no mock event was used or observed.

## FAILURE TEST

The persistent Gateway LaunchAgent was restarted using its existing installation. After recovery:

- Gateway health: healthy
- Channel 11: connected and sampled
- ONNX model: loaded and ready
- Journal outbox: `pending: 0`, `delivery_failures: 0`
- Gateway coverage remained degraded only because six unrelated DVR channels are offline and the parking channel lacks a crossing-line rule.

No mock fallback is implemented or triggered by this recovery path. The product status code maps a degraded real runtime to an explicit degraded/unverified state rather than “real monitoring active.” The sub-second offline interval could not be rendered in the authorized product UI during this run.

## PLAYBACK HOSTNAME KNOWN ISSUE

Playback/media behavior across differing hostnames remains **not Production Verified**. This PUSH did not alter playback routing or mark it verified.

## TEST MATRIX

| Test | Result |
|---|---|
| `npm run typecheck` | PASS |
| `qa:product-observer-real-source` | PASS |
| `qa:real-detection-event-bridge` | PASS |
| `qa:observer-engine-separation` | PASS |
| `qa:dvr-shared-session` | PASS |
| `qa:event-journal` (journal, ingest, outbox, inference, media) | PASS |
| Focused lint: new provenance module and cloud ingest | PASS |
| Real person → Journal → Supabase | PASS |
| Authorized product UI proof | NOT VERIFIED |
| Follow-up production deployment with stream binding | BLOCKED — dedicated encryption key absent |

Focused lint over several long-standing legacy files still reports pre-existing `no-explicit-any` debt; no new lint finding was introduced in the new provenance module or the changed cloud ingest route.

## REMAINING LEGACY PATHS

- `ai_camera_events` mock/shadow/calibration workflows: retain for test and legacy administration.
- `local_shadow` detector and local vision adapter: retain only for explicit shadow/test workflows.
- Broad legacy cleanup is deferred; no test fixture or useful QA tooling was deleted.

## PUSH 5 READINESS

**ARE WE READY FOR PUSH 5 — REAL TRACKING + ZONES VERIFICATION?**

**NO.**

Minimum blockers:

1. Add a dedicated production `FIELD_ENCRYPTION_KEY` or `FIELD_ENCRYPTION_KEY_CURRENT` in the Vercel project, then redeploy the already-tested stream-binding change. Do not use the Supabase service-role key.
2. Capture one authorized Digital Observer UI rendering of a new `REAL_CAMERA_AI` event after that deployment.
3. Keep the hostname-specific playback verification as a separate later evidence/playback hardening item.
