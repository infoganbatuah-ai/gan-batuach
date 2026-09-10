# DIGITAL OBSERVER — PUSH 32 HYBRID AI ROUTING REPORT

Date: 2026-09-10

## FINAL STATUS

`PASS`

PUSH 32 adds one policy/eligibility router above the PUSH 31 durable AI queue. It does not create another inference or Event pipeline and does not begin PUSH 33 cost optimization.

## IMPLEMENTATION

- `observer-execution-target-v1` for target class, environment, provider/region, capabilities, input locality, health, capacity, tenant/privacy eligibility, latency, measured-quality/reliability evidence and an unmeasured cost hook.
- `observer-ai-routing-policy-v1` with hard eligibility before preference.
- `observer-ai-routing-decision-v1` with selected/rejected targets, normalized reasons, explanation, policy version, bounded failover history and audit digest.
- `observer-inference-result-v1` preserves execution target ID/class, route decision ID, routing policy version and failover history.
- Target-bound queue claims and retryable failover release preserve the original job ID, idempotency, timestamp, retry ceiling and expiry.

## POLICY AND SECURITY QA

Deterministic QA passed: Edge selection; at-capacity and unavailable alternate selection; `EDGE_ONLY` fail-closed behavior; capability/model/input matching; unhealthy/crash-loop rejection; tenant allow-list, region/provider/shared/dedicated policy; measured-quality preference with sample gate; no cost scoring; retryable failover; one accepted downstream result; bounded route audit; and secret-shaped target metadata rejection.

PUSH 31 queue priority, tenant/Site/camera fairness, backpressure, lease, ACK, retry, expiry and dead-letter tests remain green. Worker target strings cannot authorize a claim; PUSH 18 scope and trusted runtime registration remain independent gates.

## EXECUTION ENVIRONMENTS

- `EDGE_LOCAL`: real physical Tapo C211 sample executed by the existing Software Connector ONNX runtime.
- `LOCAL_DEDICATED` / `ISOLATED_PROCESS`: the same canonical job/result contract executed in a separate Node process during deterministic QA.
- `CLOUD_SHARED` and `CLOUD_DEDICATED`: contract/provider boundary only. No authorized real Cloud inference provider is configured; status is `NOT CONFIGURED`, not verified.

Final deterministic completion-gate latency sample: EDGE_LOCAL 0 ms inference, n=1; LOCAL_DEDICATED/ISOLATED_PROCESS 90 ms inference, n=1. These tiny local QA samples do not establish relative Production performance or quality equivalence.

## REAL CAMERA ROUTING

Read-only proof:

`physical Tapo C211 → observer-ai-job-v1 → EDGE_ONLY decision → EDGE_LOCAL → ssd_mobilenet_v1_10 / onnxruntime-node → observer-inference-result-v1 → JournalTracker`

The final run returned one detection. Queue wait was 6 ms; inference 1,972 ms; total 1,978 ms; n=1. The result retained its route decision and policy provenance. No Event was fabricated; canonical Event creation remains the existing Tracker/Observer responsibility.

## LIVE HOME REGRESSION AND RECOVERY

The first acceptance attempt found the existing Tapo child runtime alive but its health endpoint blocked by stale media/probe operations. A bounded LaunchAgent restart exposed a separate startup defect: temporary Cloud sync failure forced discovery off despite a valid protected local configuration. The canonical startup now uses the protected cached configuration only when Cloud synchronization fails; an authoritative successful empty Cloud response still disables it. QA covers the fallback.

The installed Connector received the reviewed startup/cloud-auth files plus the previously omitted canonical managed-device-auth dependency, with a rollback backup. It restarted under the same LaunchAgent, identity, Site and Camera Source and rediscovered one stream. No source was created or rebound.

Final real proof: DVR 10/10 progressing and 0 stalled before/after; Tapo 1/1 progressing and 0 stalled; six empty DVR slots emitted zero jobs. Existing authorized Product and local playback authorization regressions remain the playback proof; PUSH 32 changes no player/API path.

## OBSERVABILITY

Journal status now exposes bounded routing decisions, selected target classes, rejection reasons, failovers, no-target outcomes and policy version alongside existing queue/worker metrics. No input contents, credentials or private media references are logged.

## QUALITY / COST BOUNDARY

Only measured quality with at least 20 samples can affect preference. Detector confidence is not quality evidence. Cost metadata is carried for PUSH 33 but is not scored; `cost_optimization_used` remains false.

## SECURITY / REGRESSION

Passed: TypeScript; canonical lint with zero canonical errors/warnings/regressions; Production build; 23/23 canonical domain suites; 7/7 security suites; npm audit with zero HIGH/CRITICAL findings; migration safety across 196 migrations; release-contract QA; 68/68 Product QA; PUSH 18 managed identity; PUSH 23 camera health; PUSH 28 quality; PUSH 29 preprocessing; PUSH 30 adaptive sampling; PUSH 31 queue/worker; Event Journal; Software Connector; playback authorization; and Live View source-contract QA. The non-breaking lock refresh moved `sharp` to 0.35.4 and `js-yaml` to 4.3.2 after the concurrent upstream dependency commit exposed their HIGH advisories; six MODERATE transitive findings remain. The historical deferred billing RLS finding remains unchanged and outside PUSH 32.

Production release preflight is intentionally rerun from the clean scoped commit immediately before push; its dirty-snapshot rejection was also verified.

## NORTH-STAR

Hybrid routing and model routing move to `IMPLEMENTED — NEEDS REAL PROOF`; Edge/cloud allocation moves to `PARTIAL`. The legacy traceability slot for Cloud/dedicated AI moves to `FOUNDATION`, but it is not an additional North-Star row and does not alter the 190-capability count. Real Cloud-provider work, multi-provider failover, representative quality/latency and Production-scale operation remain future evidence requirements. The matrix remains 190 capabilities with zero without a canonical owner.

## CANONICAL STATUS

PUSH 32: `DONE` after completion gates.
PUSH 33: `NOT STARTED`.
