# DIGITAL OBSERVER — PUSH 29 NATIVE PREPROCESSING REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS`

PUSH 29 implements the canonical candidate/preprocessing boundary, local cheap fallback, safety gates and auditable workload accounting while preserving the canonical Event pipeline. It does not begin PUSH 30 and does not automatically change Production thresholds.

## IMPLEMENTATION

- Capability vocabulary now covers native motion/person/vehicle, scene change and local frame difference.
- The event manifest exposes a bounded policy, Watch Rule/criticality override, empty-channel semantics and a human-approval gate.
- Gateway `/activity` reuses existing relay analysis without ONNX and returns no raw video.
- Journal evaluates activity before `/detections`; suppressed cycles create no Product Event.
- Missing metadata fails open to AI; unhealthy/stale sources remain health failures.
- Native IDs are deduplicated and continuous candidates are coalesced.
- Connection Intelligence accepts sanitized capability outcomes without customer/source identifiers.

## DVR / TAPO

Neither current real path has verified native vendor metadata. Both therefore use `LOCAL_FRAME_DIFF` as the cheap strategy. The common candidate contract is ready for future verified vendor/VMS adapters without changing Observer Core.

## REAL HOME WORKLOAD

The bounded read-only comparison sampled all 11 physical sources twice in 6,016 ms: 20 DVR samples and 2 Tapo samples succeeded. Baseline requested 22 expensive jobs. The same real activity scores under ADAPTIVE policy requested 11 and avoided 11 (50%, denominator 22); all 11 first observations used never-blind fallback. Six empty DVR slots requested zero AI jobs. No source configuration was changed and no raw frame was logged.

This short quiet-window result is not a Product-wide savings claim. Native metadata remains unverified, no natural qualifying Event occurred, and detector output was available for 20/22 baseline requests.

## QUALITY

Deterministic QA compares a fixed 10-job baseline with a 4-job optimized workload (6/10 avoided) on the same PUSH 28 dataset contract. Candidate signals remain non-canonical. Precision machinery is preserved; recall is `NOT MEASURABLE` because false-negative Ground Truth is unavailable. Broad enablement requires explicit quality-gate approval.

## SAFETY

Active Watch Rules and critical policies force analysis. Metadata failure triggers AI fallback. Health failure cannot masquerade as quiet. Empty channels are excluded. No action, Incident or Event is produced from a vendor signal alone. No raw frame, credential, private URL or customer identity enters telemetry/Connection Intelligence.

## LIVE COMPATIBILITY CORRECTION

The authenticated heartbeat previously returned 500 after persisting health when the deployed Fleet-command RPC contract was absent. The route now returns zero commands only for exact PostgreSQL/PostgREST missing-function codes (`42883`/`PGRST202`) and reports `CONTRACT_UNAVAILABLE_NO_COMMANDS`; all other errors remain failures. Authentication, tenant/Site scope and command allow-listing are unchanged.

## REAL EVENT PROOF

`NOT VERIFIED` in this bounded run: no natural qualifying Event occurred. Deterministic candidate, dedupe, coalescing, fallback, Watch Rule priority and canonical-pipeline tests pass. No physical Event was fabricated.

## REGRESSION

- Typecheck: PASS.
- Canonical lint baseline: PASS; 0 canonical errors/warnings and no regression.
- Production build: PASS; 492 routes/pages generated. The first restricted run was blocked only by Turbopack local-port sandboxing; the approved unrestricted build passed.
- Domain gate: PASS, 20/20 suites including the new preprocessing suite.
- Security gate: PASS, 7/7 suites; tenant/privacy, encryption separation and mock isolation remain green.
- Product QA: PASS, 68/68.
- OTA, self-healing, offline/resync, Fleet and Camera Health focused regressions: PASS.
- Migration health: PASS, 196 migrations, no new destructive migration; the historical duplicate-name warning remains unchanged.
- Release contract and committed-source Live View contract: PASS.
- Existing Home final local snapshot: Gateway healthy with 10/10 relays progressing and 0 stalled; six slots unassigned; Tapo healthy with 1/1 progressing and 0 stalled; both identities authorized; no Site/device/source was created.
- Playback code was not modified. The prior authorized Product moving-video proof remains canonical and the committed playback contract passed; no new browser-visible real-video claim is made from the workload sampler.
- PUSH 25 deferred billing RLS finding remains open and unchanged.

## NORTH-STAR

The 190-row ledger remains fully owned. `Preprocessing` advances from `FOUNDATION` to `IMPLEMENTED — NEEDS REAL PROOF`; `Sampling` advances from `FOUNDATION` to `PARTIAL`. `Metadata-first processing` advances from `FOUNDATION` to `PARTIAL`. Representative multi-camera Ground Truth and long-duration/pilot evidence remain future proof obligations.

## CANONICAL STATUS

PUSH 29: `DONE` after completion gates.
PUSH 30: `NOT STARTED`.
