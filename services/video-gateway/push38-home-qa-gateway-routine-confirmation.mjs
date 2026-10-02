import { validateEdgeUpdateManifest } from "./edge-update-contract.mjs";
import { assertEdgeReleaseObjectUrl, edgeReleaseObjectPath,
  EDGE_RELEASE_R2_BUCKET } from "./edge-release-object.mjs";

// Exact-device successor to the signed 0.2.56 live runtime. The failed
// 60-minute pre-soak and the real-DVR shadows proved that the recorder pauses
// output before a finite response ends. The signed 0.2.53 shadow preserved
// playback but measured one 10.136-second playlist freeze: its five-second
// rescue trigger combined with 5.043 seconds of replacement acquisition. This
// 0.2.54 started the same non-destructive single-owner rescue probe at three
// seconds but its two-second scheduler cadence still permitted one measured
// 10.060-second playlist freeze. This release includes scheduler detection in
// the deadline and checks the bounded rescue lane every second: the measured
// complete bound is 3.000 + 1.000 + 5.329 = 9.329 seconds, while the ten-second
// freshness contract remains unchanged. The signed 0.2.55 shadow then exposed
// the remaining rollback edge: the newest segment kept advancing, but returning
// from a safely rejected candidate to the longer fallback playlist moved the
// advertised window start from 26 back to 18. This release projects both the
// first and last external sequence monotonically across candidate/fallback
// generations. A contained candidate rejection receives a one-minute
// retry backoff while the original owner remains current; hard-stale media
// bypasses that delay. The first two-lane Home shadow then proved the remaining
// failure: an output-rescue candidate emitted first output in 3.256 seconds and
// three valid advances, but the first-output+8 s sub-deadline rejected it before
// the next cadence boundary. This release keeps the fourteen-second acquisition
// limit and uses the already-bounded twenty-one-second total probation after
// first output. The signed 0.2.57 Shadow then exposed a distinct exclusive
// rescue gap: the concurrent candidate had already acquired media, but the
// owner-release path killed both it and the hard-stale owner before opening a
// third response. One checkpoint consequently had no active relay even though
// retained HLS remained playable. Release 0.2.58 retained that acquired
// candidate, but the live canary proved another recorder-specific boundary:
// the recorder may accept the second request while withholding its response
// body until the hard-stale owner closes. Requiring candidate output before
// owner release was therefore circular and still caused a third-request media
// gap. Release 0.2.59 retains the acquired, running candidate through
// the bounded hard-stale remainder, releases only the stale owner, and then
// starts the full confirmation observation. Its signed real-DVR Shadow kept
// playback and the HLS playlist continuous, but exposed a health aggregation
// defect: candidate-only continuity was omitted while canonical ownership was
// intentionally empty during probation. Release 0.2.60 counted the effective
// candidate media in health and supervision without promoting it early. Its
// signed real-DVR Shadow then proved that a candidate which briefly produced
// output could strand after the stale owner closed. Release 0.2.61 gave
// that retained response the existing three-second freshness budget and, only
// if it stops advancing, reopens one exclusive response while preserving both
// prior HLS generations. Its signed real-DVR Shadow then captured the final
// one-response boundary: the concurrent rescue probe was rejected as non-media
// at the same instant the hard-stale owner ended, causing ordinary recovery and
// one real playback 503. This 0.2.62 successor keeps that exact rejection inside
// the bounded handoff, opens exactly one exclusive response, and preserves the
// prior HLS generation while requiring the unchanged four advances across six
// seconds. Concurrency remains capped at two. The
// intermediate 0.2.46 release was quarantined after its evidence-bound retry
// and cannot safely serve as another bridge. The first 0.2.62 manifest targeted
// 0.2.58, but the installed crash guard later quarantined 0.2.58 after a
// sustained health-endpoint outage under the same relay churn this candidate
// fixes. Re-promoting that removed release solely to bridge an update would
// make rollback unsafe. This replacement manifest therefore binds the exact
// already-qualified 0.2.62 artifact directly to the live signed 0.2.56
// KNOWN_GOOD and rolls back to that same immutable slot. No runtime bytes were
// rebuilt for that baseline reconciliation. The first live 0.2.62 canary then
// captured one final finite-response race on CH10: the old recorder response
// ended naturally after a replacement was acquired but before its six-second
// confirmation completed. Treating the now-missing owner as an ownership
// conflict discarded the only candidate and created one cold-recovery gap.
// Release 0.2.63 distinguished a naturally ended owner from a different
// canonical owner, retained the already-bounded candidate as the sole response,
// and still required the unchanged four advances across six seconds before
// promotion. Its live canary preserved component liveness and playback while
// exposing a health-only serialization boundary: canonical ownership could be
// intentionally empty while a candidate had not produced current media, so the
// health projection dereferenced no effective owner and returned HTTP 500.
// This 0.2.64 release keeps the exact relay contract and reports that bounded
// interval truthfully as no effective input instead of failing the whole health
// response. It rolls back exactly to the signed live 0.2.63 KNOWN_GOOD.
export const PUSH38_GATEWAY_ROUTINE_CONFIRMATION = Object.freeze({
  role: "GATEWAY_FRESHNESS_CONTINUITY",
  deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
  releaseId: "qa-p38-health-gateway-health-serialization-dee178ab7c45",
  version: "0.2.64-p38-health",
  buildSha: "5b3ee9f0e78c22926ff5688ee9f77c973257632b",
  digest: "dee178ab7c455b7e744d3a1658e79333296f5420787299182b021f9020068ba2",
  size: 135842806,
  profile: "PHYSICAL_GATEWAY",
  rollbackReleaseId: "qa-p38-health-gateway-finite-owner-exit-79141a089f25",
  rollbackVersion: "0.2.63-p38-health",
  supersedesReleaseId: "qa-p38-health-gateway-finite-owner-exit-79141a089f25",
  supersedesVersion: "0.2.63-p38-health",
  failedLiveCanaryReleaseId: "qa-p38-health-gateway-finite-owner-exit-79141a089f25",
  failedLiveCanaryVersion: "0.2.63-p38-health",
  quarantinedRuntimeReleaseId: "qa-p38-health-gateway-exclusive-reuse-8b32513d7591",
  quarantinedRuntimeVersion: "0.2.58-p38-health",
  failedCandidateReleaseId: "qa-p38-health-gateway-rescue-probation-direct-9a9a29bfb861",
  failedCandidateVersion: "0.2.57-p38-health",
  failedHealthCandidateReleaseId: "qa-p38-health-gateway-body-blocked-reuse-55a5a7a7f8bd",
  failedHealthCandidateVersion: "0.2.59-p38-health",
  failedContinuityCandidateReleaseId: "qa-p38-health-gateway-handoff-health-4fd9e7b95e77",
  failedContinuityCandidateVersion: "0.2.60-p38-health",
  failedAcquisitionCandidateReleaseId: "qa-p38-health-gateway-exclusive-reopen-9053fd23eb8e",
  failedAcquisitionCandidateVersion: "0.2.61-p38-health",
  quarantinedBridgeReleaseId: "qa-p38-health-gateway-routine-confirmation-5cdf47d35b44",
  quarantinedBridgeVersion: "0.2.46-p38-health",
  agentPredecessorReleaseId: "qa-p38-health-gateway-routine-provisional-6045266c007a",
  priorManagementArtifactSha256: "6045266c007a433f6e6398610d4f6d382a2bd8b8ac97505e0b0ece2dd8351a72"
});

// The long-running 0.2.41 predecessor renews its single recorder session
// proactively. A cumulative rotation count greater than zero is therefore not
// a failure by itself. Preflight may accept it only when every observed
// rotation is the expected successful non-exclusive renewal and the current
// session remains singular, authenticated, and responsive.
export function gatewayRoutineConfirmationBaselineSessionAcceptable(sample = {}) {
  return Number.isInteger(sample.rotations) && sample.rotations >= 0 &&
    sample.active_sessions === 1 && sample.authentication_rejected === 0 &&
    sample.consecutive_failures === 0 && sample.responses_ok > 0 &&
    sample.login_attempts >= 1 && sample.login_succeeded === sample.login_attempts &&
    (sample.rotations === 0
      ? sample.last_rotation_reason === null && sample.proactive_attempts === 0 &&
        sample.proactive_succeeded === 0
      : sample.last_rotation_reason === "proactive_nonexclusive_renewal" &&
        sample.proactive_attempts === sample.rotations &&
        sample.proactive_succeeded === sample.rotations);
}

export function gatewayRoutineConfirmationLegacyRuntimeAcceptable(sample = {}) {
  const connected = sample.connected;
  const progressing = sample.progressing;
  const failed = sample.failed;
  const expectedReasons = new Set(["EXPECTED_RELAY_NOT_PROGRESSING", "DISCOVERY_PROBE_FAILED"]);
  return ["degraded", "healthy"].includes(sample.status) && sample.assigned === 10 &&
    sample.empty === 6 && Number.isInteger(connected) && connected >= 7 && connected <= 9 &&
    failed === 10 - connected && Number.isInteger(progressing) && progressing >= 7 && progressing <= 9 &&
    Number.isInteger(sample.stalled) && sample.stalled >= 0 && sample.stalled <= 2 &&
    Math.max(connected, progressing) >= 8 && Array.isArray(sample.reason_codes) &&
    sample.reason_codes.every(reason => expectedReasons.has(reason)) &&
    gatewayRoutineConfirmationBaselineSessionAcceptable(sample);
}

export function buildPush38GatewayRoutineConfirmationManifest({ signingKeyId,
  artifactOrigin, releasedAt }) {
  if (!/^[A-Za-z0-9._:-]{3,160}$/.test(signingKeyId || ""))
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_SIGNER_INVALID");
  const origin = new URL(artifactOrigin);
  if (origin.protocol !== "https:" || !/^[a-f0-9]{32}\.r2\.cloudflarestorage\.com$/.test(origin.hostname) ||
    origin.pathname !== "/" || origin.search || origin.hash)
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_ORIGIN_INVALID");
  if (!Number.isFinite(Date.parse(releasedAt)) || Date.parse(releasedAt) > Date.now() + 300_000)
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_RELEASE_TIME_INVALID");
  const item = PUSH38_GATEWAY_ROUTINE_CONFIRMATION;
  const document = { protocol: "observer-edge-update-v1", release_id: item.releaseId,
    version: item.version, build_sha: item.buildSha, channel: "HOME_QA", platform: "darwin",
    architecture: "arm64", profile: item.profile,
    artifact_url: `${origin.origin}/${EDGE_RELEASE_R2_BUCKET}/home-qa/${item.releaseId}/${item.digest}.tar.gz`,
    artifact_sha256: item.digest, artifact_size: item.size, signing_key_id: signingKeyId,
    compatibility: { minimum_current_version: item.rollbackVersion,
      maximum_current_version: item.rollbackVersion, minimum_config_version: 1,
      maximum_config_version: 1, security_floor_version: item.rollbackVersion },
    released_at: releasedAt, rollout: { stage: "INTERNAL_QA",
      cohort_seed: "push38-home-qa-exact-device", cohort_percent: 0,
      explicit_device_ids: [item.deviceId] },
    signature: Buffer.alloc(64).toString("base64url") };
  validateEdgeUpdateManifest(document);
  if (assertEdgeReleaseObjectUrl(document, origin.origin) !== edgeReleaseObjectPath(document))
    throw new Error("P38_GATEWAY_ROUTINE_CONFIRMATION_OBJECT_MISMATCH");
  return { role: item.role, deviceId: item.deviceId, document };
}
