# DIGITAL OBSERVER — PUSH 30 ADAPTIVE SAMPLING REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS`

PUSH 30 implements one explainable adaptive scheduler over PUSH 29 preprocessing/candidates. It preserves canonical Observer Events and does not begin PUSH 31.

## IMPLEMENTATION

- Explicit purposes: realtime detection, tracking continuity, Site learning, health/freshness and investigation.
- Explicit CRITICAL/HIGH/NORMAL/LOW/LEARNING priority with reason, interval, expiry and reevaluation.
- Incident, Track, Watch Rule, critical-camera, activity, recovery, quiet decay, resource pressure and learning coverage inputs.
- Least-recent/overdue fairness and a bounded never-blind floor.
- `observer-ai-candidate-v2` is deduplicated, expiring, queue-ready and never a canonical Event.
- Manifest supplies active Incident, Watch Rule, criticality and per-camera learning state.
- Journal preserves legacy fixed manifests, while new manifests route through the scheduler before PUSH 29 preprocessing and canonical Tracker/Event creation.
- Product learning view exposes camera-level sample/time coverage.

## 1/11 LEARNING ROOT CAUSE

The old learning loop concurrently called `/insights` for all cameras, invoking the one shared ONNX session even though only cheap motion/luminance was uploaded. The new loop uses sequential bounded `/activity` samples and the shared scheduler's `SITE_LEARNING` purpose. This removes model contention and intentional fairness replaces accidental source dominance.

The isolated real-input coverage decision is 11/11 with no starved source. The currently installed live packages predate `/activity`, so persisted Production coverage must not be claimed as 11/11 until those packages update and accepted uploads accumulate.

## FIXED VS ADAPTIVE REAL-INPUT WORKLOAD

Mode: read-only real-input replay. Duration: 4,555 ms. Inputs: 11/11 physical sources; no configuration changed and no raw frame logged.

- Fixed: 3 rounds × 11 cameras = 33 samples and 33 AI requests.
- Adaptive: 12 scheduled samples, 11 AI requests, 22/33 avoided (66.67%).
- Per-camera: every physical camera received at least one realtime sample and one learning sample; DVR channel 1 received two realtime samples as remaining round capacity became available.
- Candidates: 0 in this quiet bounded window.
- Empty DVR slots: 6; realtime/learning/candidate/AI work all zero.
- Runtime compatibility: live packages exposed 0 cheap `/activity` endpoints and used 11 one-time legacy `/insights` inputs for this measurement. Repository/package implementation is ready; local package rollout is separate from this non-destructive benchmark.

This short replay is not a Product-wide savings claim.

## QUALITY

PUSH 28 contracts remain authoritative. Precision was not measurable in the unreviewed window. Recall is `NOT MEASURABLE` because false-negative Ground Truth is unavailable. No natural qualifying Event occurred, so real Event proof is `NOT VERIFIED`. Deterministic tests prove priority, decay/floor, candidate dedupe/expiry, resource pressure, fairness, empty-channel exclusion, learning priority and recovery re-entry.

## SAFETY / BOUNDARIES

Watch Rules, Incidents, Tracks and critical sources retain protected work. Health loss cannot masquerade as quiet. No threshold changes automatically. No durable AI queue, portable worker or generic cost engine was implemented. No source, Site, device or camera record was created.

## REAL HOME

Read-only final health during measurement: DVR 10/10 progressing, 0 stalled; Tapo 1/1 progressing, 0 stalled; six DVR slots empty. Fresh authorized Production UI verification showed 11 active physical-camera tiles. Tapo frames visibly changed from camera timestamp `03:56:46` to `03:56:47`; DVR grid timestamps visibly advanced across populated channels. No mock/manual stream was used and playback code was not modified.

## REGRESSION

- Adaptive scheduler QA: PASS.
- PUSH 29 native preprocessing QA: PASS.
- Canonical domain gate: PASS, 21/21.
- Typecheck: PASS.
- Canonical lint: PASS with zero canonical regressions.
- Production build: PASS, 492 routes/pages.
- Product QA: PASS, 68/68.
- Security gate: PASS, 7/7.
- PUSH 20 self-healing, PUSH 21 offline/resync, PUSH 22 Fleet, PUSH 23 Camera Health, PUSH 28 Quality and Watch Rule regressions: PASS.
- Migration health: PASS, 196 migrations, no new destructive migration; the one historical duplicate-name warning remains unchanged.
- Release snapshot contract, local playback grant, Live View thumbnail and canonical domain consolidation checks: PASS.
- PUSH 25 deferred billing RLS finding remains open and unchanged.

## NORTH-STAR

`Sampling` advances from PARTIAL to IMPLEMENTED — NEEDS REAL PROOF. Representative FN Ground Truth, longer-duration operation and multi-Site/enterprise scale remain required. The ledger remains 190 capabilities with zero unowned rows.

## CANONICAL STATUS

PUSH 30: `DONE` after completion gates.
PUSH 31: `NOT STARTED`.
