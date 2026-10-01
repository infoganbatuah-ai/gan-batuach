export function evaluateHlsRenewalContinuity(checkpoints, { maximumTargetPeriods = 2,
  graceMs = 2_000 } = {}) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2 ||
    !Number.isFinite(maximumTargetPeriods) || maximumTargetPeriods < 1 ||
    !Number.isFinite(graceMs) || graceMs < 0) return { pass: false, reason: "INVALID_INPUT" };
  let lastAdvanceAt = null;
  let maximumStagnationMs = 0;
  let advances = 0;
  for (let index = 0; index < checkpoints.length; index += 1) {
    const point = checkpoints[index], renewal = point?.renewal;
    const observedAt = Date.parse(point?.observed_at || "");
    const targetDurationSeconds = Number(renewal?.target_duration_seconds);
    if (!Number.isFinite(observedAt) || renewal?.status !== 200 ||
      renewal?.playlist_status !== 200 || renewal?.segment_status !== 200 ||
      !(renewal?.segment_bytes > 0) || !Number.isInteger(renewal?.media_sequence) ||
      !Number.isInteger(renewal?.latest_segment_sequence) ||
      !Number.isInteger(targetDurationSeconds) || targetDurationSeconds < 1 ||
      targetDurationSeconds > 60 || !/^[a-f0-9]{64}$/.test(renewal?.playlist_sha256 || "") ||
      !/^[a-f0-9]{64}$/.test(renewal?.segment_sha256 || ""))
      return { pass: false, reason: "INVALID_RENEWAL", index };
    if (index === 0) { lastAdvanceAt = observedAt; continue; }
    const previous = checkpoints[index - 1].renewal;
    if (renewal.media_sequence < previous.media_sequence ||
      renewal.latest_segment_sequence < previous.latest_segment_sequence)
      return { pass: false, reason: "SEQUENCE_REGRESSION", index };
    if (renewal.latest_segment_sequence > previous.latest_segment_sequence) {
      if (renewal.segment_sha256 === previous.segment_sha256)
        return { pass: false, reason: "ADVANCE_WITHOUT_NEW_SEGMENT", index };
      lastAdvanceAt = observedAt;
      advances += 1;
      continue;
    }
    if (renewal.segment_sha256 !== previous.segment_sha256)
      return { pass: false, reason: "SAME_SEQUENCE_DIFFERENT_SEGMENT", index };
    const stagnationMs = observedAt - lastAdvanceAt;
    maximumStagnationMs = Math.max(maximumStagnationMs, stagnationMs);
    if (stagnationMs > targetDurationSeconds * maximumTargetPeriods * 1_000 + graceMs)
      return { pass: false, reason: "PLAYLIST_FRESHNESS_EXCEEDED", index,
        maximum_stagnation_ms: maximumStagnationMs };
  }
  return { pass: advances > 0, reason: advances > 0 ? null : "NO_SEGMENT_ADVANCE",
    advances, maximum_stagnation_ms: maximumStagnationMs };
}

export function classifyBoundedOutputRescueRejection(checkpoints, lifecycle = {}) {
  const outputFailures = Number(lifecycle.warmHandoffFailuresByMode?.outputRescue || 0);
  if (outputFailures === 0) return { pass: true, warning: null };
  const startedAt = Date.parse(checkpoints?.[0]?.observed_at || "");
  const endedAt = Date.parse(checkpoints?.at(-1)?.observed_at || "");
  const boundedFailures = Number.isFinite(startedAt) && Number.isFinite(endedAt)
    ? Math.max(1, Math.ceil((endedAt - startedAt) / 120_000)) : 0;
  if (!Array.isArray(checkpoints) || outputFailures > boundedFailures ||
    lifecycle.warmHandoffFailures !== outputFailures ||
    lifecycle.warmHandoffConfirmationFailures !== outputFailures ||
    lifecycle.warmHandoffRollbacks !== 0 ||
    lifecycle.staleInput !== 0 || lifecycle.stalePlaylist !== 0 || lifecycle.staleOnRequest !== 0 ||
    lifecycle.inputSocketError !== 0 || lifecycle.upstreamFailed !== 0 ||
    Number(lifecycle.startsByReason?.recovery || 0) !== 0 ||
    Number(lifecycle.warmHandoffs || 0) <= outputFailures)
    return { pass: false, warning: null, reason: "UNBOUNDED_OUTPUT_RESCUE_FAILURE" };
  const failureIndexes = checkpoints.map((point, index) => index > 0 &&
    Number(point.shadow?.media?.lifecycle?.warmHandoffFailures || 0) >
      Number(checkpoints[index - 1].shadow?.media?.lifecycle?.warmHandoffFailures || 0)
      ? index : -1).filter(index => index >= 0);
  if (failureIndexes.length !== outputFailures)
    return { pass: false, warning: null, reason: "FAILURE_POINT_MISSING" };
  const mediaPreserved = failureIndexes.every(index => {
    const failed = checkpoints[index], renewal = failed.renewal;
    const input = failed.shadow?.media?.inputs?.[0];
    const canonicalMedia = input?.owner_state === "CURRENT" &&
      input?.canonical_owner_progressing === true;
    const candidateMedia = input?.owner_state === "WARMING_CONTINUITY" &&
      input?.candidate_progressing === true;
    return failed.shadow?.media?.progressing === 1 && failed.shadow?.media?.stalled === 0 &&
      (canonicalMedia || candidateMedia) && renewal?.status === 200 &&
      renewal?.playlist_status === 200 && renewal?.segment_status === 200 &&
      renewal?.segment_bytes > 0;
  });
  const final = checkpoints.at(-1);
  if (!mediaPreserved || final?.shadow?.media?.progressing !== 1 ||
    final?.shadow?.media?.stalled !== 0)
    return { pass: false, warning: null, reason: "MEDIA_NOT_PRESERVED_OR_NOT_RECOVERED" };
  return { pass: true,
    warning: "BOUNDED_OUTPUT_RESCUE_CANDIDATE_REJECTED_WITHOUT_MEDIA_GAP",
    failure_checkpoints: failureIndexes.map(index => checkpoints[index].sequence ?? index + 1),
    maximum_bounded_failures: boundedFailures };
}
