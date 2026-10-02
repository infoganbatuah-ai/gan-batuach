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

export function classifyBoundedOutputRescueRejection(checkpoints, lifecycle = {}, {
  expectedProgressing = 1
} = {}) {
  const outputFailures = Number(lifecycle.warmHandoffFailuresByMode?.outputRescue || 0);
  if (outputFailures === 0) return { pass: true, warning: null };
  const startedAt = Date.parse(checkpoints?.[0]?.observed_at || "");
  const endedAt = Date.parse(checkpoints?.at(-1)?.observed_at || "");
  const boundedFailures = Number.isFinite(startedAt) && Number.isFinite(endedAt)
    ? Math.max(1, Math.ceil((endedAt - startedAt) / 120_000)) : 0;
  if (!Array.isArray(checkpoints) || outputFailures > boundedFailures ||
    lifecycle.warmHandoffFailures !== outputFailures ||
    // A rejected candidate can fail either before media acquisition or during
    // confirmation. Both are safe only when the canonical owner and playback
    // remain continuous at the exact failure checkpoint. Requiring every
    // rejection to be a confirmation failure incorrectly rejected a measured
    // acquisition timeout with zero media gap.
    lifecycle.warmHandoffConfirmationFailures > outputFailures ||
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
    const failed = checkpoints[index];
    const renewals = Array.isArray(failed.renewals)
      ? failed.renewals.map(entry => entry.playback) : [failed.renewal];
    const inputs = failed.shadow?.media?.inputs ?? [];
    const mediaOwnersValid = inputs.length >= expectedProgressing && inputs.every(input =>
      input?.owner_state === "CURRENT" && input?.canonical_owner_progressing === true ||
      input?.owner_state === "WARMING_CONTINUITY" && input?.candidate_progressing === true);
    const playbackValid = renewals.length === expectedProgressing && renewals.every(renewal =>
      renewal?.status === 200 && renewal?.playlist_status === 200 &&
      renewal?.segment_status === 200 && renewal?.segment_bytes > 0);
    return failed.shadow?.media?.progressing === expectedProgressing &&
      failed.shadow?.media?.stalled === 0 && mediaOwnersValid && playbackValid;
  });
  const final = checkpoints.at(-1);
  if (!mediaPreserved || final?.shadow?.media?.progressing !== expectedProgressing ||
    final?.shadow?.media?.stalled !== 0)
    return { pass: false, warning: null, reason: "MEDIA_NOT_PRESERVED_OR_NOT_RECOVERED" };
  return { pass: true,
    warning: "BOUNDED_OUTPUT_RESCUE_CANDIDATE_REJECTED_WITHOUT_MEDIA_GAP",
    failure_checkpoints: failureIndexes.map(index => checkpoints[index].sequence ?? index + 1),
    maximum_bounded_failures: boundedFailures };
}

export function classifyContainedOwnerRecovery(checkpoints, { expectedProgressing = 1 } = {}) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2 ||
    !Number.isInteger(expectedProgressing) || expectedProgressing < 1)
    return { pass: false, reason: "INVALID_INPUT", events: 0 };
  const events = new Map();
  for (const [index, point] of checkpoints.entries()) {
    const diagnostics = point?.shadow?.media?.source_diagnostics;
    if (!Array.isArray(diagnostics)) continue;
    for (const source of diagnostics) {
      if (source?.last_handoff_result !== "OWNER_RECOVERED" ||
        source?.last_failure_reason !== "OUTPUT_RESCUE_OWNER_RECOVERED" ||
        !Number.isInteger(source?.channel) ||
        !Number.isFinite(Date.parse(source?.last_failure_at || ""))) continue;
      const key = `${source.channel}:${source.last_failure_at}`;
      if (!events.has(key)) events.set(key, { index, channel: source.channel,
        observed_at: point.observed_at, event_at: source.last_failure_at });
    }
  }
  if (events.size < 1) return { pass: false, reason: "NO_OWNER_RECOVERY_OBSERVED", events: 0 };
  for (const event of events.values()) {
    const point = checkpoints[event.index];
    const lifecycle = point?.shadow?.media?.lifecycle || {};
    const inputs = point?.shadow?.media?.inputs || [];
    const renewals = Array.isArray(point?.renewals)
      ? point.renewals.map(entry => entry.playback) : [point?.renewal];
    const mediaPreserved = point?.shadow?.media?.progressing === expectedProgressing &&
      point?.shadow?.media?.stalled === 0 && inputs.length >= expectedProgressing &&
      inputs.every(input => input?.owner_state === "CURRENT" &&
        input?.canonical_owner_progressing === true) &&
      renewals.length === expectedProgressing && renewals.every(renewal =>
        renewal?.status === 200 && renewal?.playlist_status === 200 &&
        renewal?.segment_status === 200 && renewal?.segment_bytes > 0) &&
      Number(lifecycle.staleInput || 0) === 0 && Number(lifecycle.stalePlaylist || 0) === 0 &&
      Number(lifecycle.staleOnRequest || 0) === 0 &&
      Number(lifecycle.startsByReason?.recovery || 0) === 0;
    if (!mediaPreserved) return { pass: false, reason: "OWNER_RECOVERY_MEDIA_GAP",
      events: events.size, failed_event: event };
  }
  return { pass: true, reason: null, events: events.size,
    event_checkpoints: [...events.values()].map(event => ({ channel: event.channel,
      observed_at: event.observed_at, event_at: event.event_at })) };
}

// A recorder login rotation is acceptable qualification evidence only when it
// is the measured, proactive non-exclusive renewal and every source is moved
// exactly once per rotation through the existing SESSION_SWEEP contract. The
// classification deliberately rechecks media and playback at every sampled
// point so it cannot turn a reactive outage or a partial epoch drain into a
// passing renewal.
export function classifyContinuousSessionRenewal(checkpoints, lifecycle = {},
  session = {}, { expectedProgressing = 1 } = {}) {
  const rotations = Number(session.rotations || 0);
  if (rotations === 0) return { pass: true, warning: null, rotations: 0 };
  if (!Array.isArray(checkpoints) || checkpoints.length < 2 ||
    !Number.isInteger(expectedProgressing) || expectedProgressing < 1)
    return { pass: false, reason: "INVALID_INPUT", rotations };
  const expectedSweeps = rotations * expectedProgressing;
  if (session.last_rotation_reason !== "proactive_nonexclusive_renewal" ||
    Number(session.proactive_attempts || 0) !== rotations ||
    Number(session.proactive_succeeded || 0) !== rotations ||
    Number(session.login_succeeded || 0) !== rotations + 1 ||
    Number(lifecycle.startsByReason?.sessionSweep || 0) !== expectedSweeps ||
    Number(lifecycle.warmHandoffsByMode?.sessionSweep || 0) !== expectedSweeps ||
    Number(lifecycle.warmHandoffFailuresByMode?.sessionSweep || 0) !== 0 ||
    Number(lifecycle.startsByReason?.recovery || 0) !== 0 ||
    Number(lifecycle.inputSocketError || 0) !== 0 ||
    Number(lifecycle.staleInput || 0) !== 0 || Number(lifecycle.stalePlaylist || 0) !== 0 ||
    Number(lifecycle.staleOnRequest || 0) !== 0)
    return { pass: false, reason: "SESSION_SWEEP_COUNTERS_INVALID", rotations,
      expected_sweeps: expectedSweeps };
  const continuity = checkpoints.every(point => {
    const renewals = Array.isArray(point?.renewals)
      ? point.renewals.map(entry => entry.playback) : [point?.renewal];
    return point?.shadow?.http === 200 && point?.shadow?.media?.progressing === expectedProgressing &&
      point?.shadow?.media?.stalled === 0 && renewals.length === expectedProgressing &&
      renewals.every(renewal => renewal?.status === 200 && renewal?.playlist_status === 200 &&
        renewal?.segment_status === 200 && renewal?.segment_bytes > 0);
  });
  if (!continuity) return { pass: false, reason: "SESSION_SWEEP_MEDIA_GAP", rotations,
    expected_sweeps: expectedSweeps };
  return { pass: true, reason: null, rotations, expected_sweeps: expectedSweeps,
    warning: "PROACTIVE_SESSION_RENEWAL_WITH_CONTINUOUS_MEDIA" };
}
