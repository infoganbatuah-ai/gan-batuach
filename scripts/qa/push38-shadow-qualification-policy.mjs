export function evaluateHlsRenewalContinuity(checkpoints, { maximumTargetPeriods = 2,
  graceMs = 2_000 } = {}) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2 ||
    !Number.isFinite(maximumTargetPeriods) || maximumTargetPeriods < 1 ||
    !Number.isFinite(graceMs) || graceMs < 0) return { pass: false, reason: "INVALID_INPUT" };
  let lastAdvanceAt = null;
  let maximumStagnationMs = 0;
  let maximumBufferedStagnationMs = 0;
  let bufferedHandoffs = 0;
  let inBufferedHandoff = false;
  let advances = 0;
  for (let index = 0; index < checkpoints.length; index += 1) {
    const point = checkpoints[index], renewal = point?.renewal;
    const observedAt = Date.parse(point?.observed_at || "");
    const targetDurationSeconds = Number(renewal?.target_duration_seconds);
    if (!Number.isFinite(observedAt) || renewal?.status !== 200 ||
      renewal?.playlist_status !== 200 || renewal?.segment_status !== 200 ||
      !(renewal?.segment_bytes > 0) || !Number.isInteger(renewal?.media_sequence) ||
      !Number.isInteger(renewal?.latest_segment_sequence) ||
      !Number.isInteger(renewal?.segment_count) || renewal.segment_count < 1 ||
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
      inBufferedHandoff = false;
      advances += 1;
      continue;
    }
    if (renewal.segment_sha256 !== previous.segment_sha256)
      return { pass: false, reason: "SAME_SEQUENCE_DIFFERENT_SEGMENT", index };
    const stagnationMs = observedAt - lastAdvanceAt;
    maximumStagnationMs = Math.max(maximumStagnationMs, stagnationMs);
    const strictFreshnessMs = targetDurationSeconds * maximumTargetPeriods * 1_000 + graceMs;
    if (stagnationMs <= strictFreshnessMs) continue;
    const input = point?.shadow?.media?.inputs?.find(entry =>
      !Number.isInteger(point?.channel) || entry?.channel === point.channel);
    const holdbackSeconds = Math.abs(Number(renewal?.start_time_offset_seconds));
    const retainedBufferValid = input?.owner_state === "RENEWING" &&
      input?.media_owner_state === "RETAINED_HLS" &&
      input?.playback_continuity === true && Number.isFinite(holdbackSeconds) &&
      renewal.start_time_offset_seconds < 0 &&
      renewal.segment_count >= Math.ceil(holdbackSeconds / targetDurationSeconds) &&
      stagnationMs <= holdbackSeconds * 1_000;
    if (retainedBufferValid) {
      maximumBufferedStagnationMs = Math.max(maximumBufferedStagnationMs, stagnationMs);
      if (!inBufferedHandoff) bufferedHandoffs += 1;
      inBufferedHandoff = true;
      continue;
    }
    return { pass: false, reason: "PLAYLIST_FRESHNESS_EXCEEDED", index,
      maximum_stagnation_ms: maximumStagnationMs };
  }
  return { pass: advances > 0, reason: advances > 0 ? null : "NO_SEGMENT_ADVANCE",
    advances, maximum_stagnation_ms: maximumStagnationMs,
    buffered_handoffs: bufferedHandoffs,
    maximum_buffered_stagnation_ms: maximumBufferedStagnationMs };
}

export function hasQualifiedHandoffEncoderState(point) {
  const input = point?.shadow?.media?.inputs?.[0];
  if (["videotoolbox", "libx264"].includes(input?.encoder)) return true;
  // During an exclusive session renewal the previous encoder has exited and
  // the replacement has not yet become CURRENT.  The relay is still serving
  // the retained, bounded HLS window.  Accept the intentionally absent encoder
  // only when the full retained-playback contract is present and playable.
  return input?.encoder == null && input?.renewing === true &&
    input?.playback_continuity === true && input?.owner_state === "RENEWING" &&
    input?.media_owner_state === "RETAINED_HLS" &&
    point?.shadow?.media?.progressing === 0 && point?.shadow?.media?.renewing === 1 &&
    point?.shadow?.media?.available === 1 && point?.shadow?.media?.stalled === 0 &&
    point?.renewal?.status === 200 && point?.renewal?.playlist_status === 200 &&
    point?.renewal?.segment_status === 200 && point?.renewal?.segment_bytes > 0;
}

export function evaluateShadowMeasurementReadiness(checkpoints, {
  expectedProgressing = 1,
  minimumStableMs = 30_000
} = {}) {
  if (!Array.isArray(checkpoints) || checkpoints.length < 2 ||
    !Number.isInteger(expectedProgressing) || expectedProgressing < 1 ||
    !Number.isFinite(minimumStableMs) || minimumStableMs < 1_000)
    return { pass: false, reason: "INVALID_INPUT" };
  const startedAt = Date.parse(checkpoints[0]?.observed_at || "");
  const endedAt = Date.parse(checkpoints.at(-1)?.observed_at || "");
  if (!Number.isFinite(startedAt) || !Number.isFinite(endedAt) || endedAt < startedAt)
    return { pass: false, reason: "INVALID_TIMESTAMP" };
  const componentStable = checkpoints.every(point => point.shadow?.http === 200 &&
    point.shadow?.discovery?.assigned === expectedProgressing &&
    point.shadow?.discovery?.connected === expectedProgressing &&
    Number(point.shadow?.media?.progressing || 0) === expectedProgressing &&
    Number(point.shadow?.media?.renewing || 0) === 0 &&
    Number(point.shadow?.media?.stalled || 0) === 0 &&
    Number(point.shadow?.media?.candidate_handoffs || 0) === 0 &&
    Number(point.shadow?.media?.provisional_handoffs || 0) === 0);
  if (!componentStable) return { pass: false, reason: "COMPONENT_NOT_STABLE" };
  const channels = checkpoints[0].renewals?.map(entry => entry.channel) ?? [];
  if (channels.length !== expectedProgressing || new Set(channels).size !== channels.length)
    return { pass: false, reason: "CHANNEL_SET_MISMATCH" };
  const channelResults = channels.map(channel => ({
    channel,
    ...evaluateHlsRenewalContinuity(checkpoints.map(point => ({
      observed_at: point.observed_at,
      channel,
      shadow: point.shadow,
      renewal: point.renewals?.find(entry => entry.channel === channel)?.playback
    })))
  }));
  const failed = channelResults.find(result => !result.pass);
  if (failed) return { pass: false, reason: failed.reason, channels: channelResults };
  const stableMs = endedAt - startedAt;
  if (stableMs < minimumStableMs)
    return { pass: false, reason: "STABLE_WINDOW_PENDING", stable_ms: stableMs,
      channels: channelResults };
  return { pass: true, reason: null, stable_ms: stableMs, channels: channelResults };
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
  // Several source-level candidate rejections can complete inside one sampling
  // interval. Keep the counter delta as the event cardinality instead of
  // assuming that every rejection has a distinct checkpoint. The checkpoint
  // still has to prove uninterrupted media for every batched event.
  const failurePoints = checkpoints.flatMap((point, index) => {
    const current = Number(point.shadow?.media?.lifecycle?.warmHandoffFailures || 0);
    const previous = index > 0
      ? Number(checkpoints[index - 1].shadow?.media?.lifecycle?.warmHandoffFailures || 0)
      : 0;
    const count = current - previous;
    return Number.isInteger(count) && count > 0 ? [{ index, count }] : [];
  });
  const observedFailures = failurePoints.reduce((total, point) => total + point.count, 0);
  if (observedFailures !== outputFailures)
    return { pass: false, warning: null, reason: "FAILURE_POINT_MISSING" };
  const mediaPreserved = failurePoints.every(({ index }) => {
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
    failure_checkpoints: failurePoints.map(({ index, count }) => ({
      sequence: checkpoints[index].sequence ?? index + 1, count
    })),
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
  const proactiveRenewal = session.last_rotation_reason ===
    "proactive_nonexclusive_renewal";
  const finiteResponseRenewal = ["finite_response_reopen_rejected",
    "finite_response_socket_retired", "finite_response_body_retired"]
    .includes(session.last_rotation_reason);
  const invalidModeCounters = proactiveRenewal ? (
    Number(session.proactive_attempts || 0) !== rotations ||
    Number(session.proactive_succeeded || 0) !== rotations ||
    Number(lifecycle.startsByReason?.sessionSweep || 0) !== expectedSweeps ||
    Number(lifecycle.warmHandoffsByMode?.sessionSweep || 0) !== expectedSweeps ||
    Number(lifecycle.warmHandoffFailuresByMode?.sessionSweep || 0) !== 0 ||
    Number(lifecycle.startsByReason?.recovery || 0) !== 0 ||
    Number(lifecycle.inputSocketError || 0) !== 0
  ) : finiteResponseRenewal ? (
    Number(session.proactive_attempts || 0) !== 0 ||
    Number(session.proactive_succeeded || 0) !== 0 ||
    Number(lifecycle.startsByReason?.recovery || 0) !== rotations ||
    Number(lifecycle.upstreamEnded || 0)
      + Number(lifecycle.responseRetired || 0) !== rotations ||
    Number(lifecycle.inputSocketError || 0) > rotations
  ) : true;
  if (invalidModeCounters ||
    Number(session.login_succeeded || 0) !== rotations + 1 ||
    Number(session.logout_succeeded || 0) !== rotations ||
    Number(session.logout_failed || 0) !== 0 ||
    Number(session.retired_session_backlog || 0) !== 0 ||
    Number(lifecycle.staleInput || 0) !== 0 || Number(lifecycle.stalePlaylist || 0) !== 0 ||
    Number(lifecycle.staleOnRequest || 0) !== 0)
    return { pass: false, reason: "SESSION_SWEEP_COUNTERS_INVALID", rotations,
      expected_sweeps: expectedSweeps };
  const continuity = checkpoints.every(point => {
    const renewals = Array.isArray(point?.renewals)
      ? point.renewals.map(entry => entry.playback) : [point?.renewal];
    return point?.shadow?.http === 200 &&
      Number(point?.shadow?.media?.available ??
        Number(point?.shadow?.media?.progressing || 0)
          + Number(point?.shadow?.media?.renewing || 0)) === expectedProgressing &&
      point?.shadow?.media?.stalled === 0 && renewals.length === expectedProgressing &&
      renewals.every(renewal => renewal?.status === 200 && renewal?.playlist_status === 200 &&
        renewal?.segment_status === 200 && renewal?.segment_bytes > 0);
  });
  if (!continuity) return { pass: false, reason: "SESSION_SWEEP_MEDIA_GAP", rotations,
    expected_sweeps: expectedSweeps };
  return { pass: true, reason: null, rotations,
    expected_sweeps: proactiveRenewal ? expectedSweeps : 0,
    warning: proactiveRenewal
      ? "PROACTIVE_SESSION_RENEWAL_WITH_CONTINUOUS_MEDIA"
      : "FINITE_RESPONSE_RENEWAL_WITH_CONTINUOUS_MEDIA" };
}
