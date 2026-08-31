const states = new Set(["no_event", "event_detected", "no_media", "processing_failed", "offline", "deferred_budget", "consent_unavailable"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Construct an allowlisted report; never serialize the channel, model output or credentials.
export function createAnalysisRoundReport(policy, round, completedAt = Date.now()) {
  if (!uuid.test(policy?.authorization_id ?? "") || !Number.isFinite(completedAt)
    || !Array.isArray(round?.reports) || !round.reports.length || round.reports.length > 128) return null;
  const seen = new Set();
  const reports = [];
  for (const item of round.reports) {
    if (!uuid.test(item?.source_id ?? "") || seen.has(item.source_id) || !states.has(item.state)) return null;
    seen.add(item.source_id);
    const success = item.state === "no_event" || item.state === "event_detected";
    const attempted = item.last_attempt_at === null ? null : Date.parse(item.last_attempt_at);
    const analyzed = item.last_analyzed_at === null ? null : Date.parse(item.last_analyzed_at);
    if (attempted !== null && (!Number.isFinite(attempted) || attempted > completedAt || completedAt - attempted > 300_000)) return null;
    if (success ? attempted === null || !Number.isFinite(analyzed) || analyzed < attempted || analyzed > completedAt
      || !Number.isSafeInteger(item.event_count) || item.event_count < 0 || item.event_count > 100
      || (item.state === "no_event") !== (item.event_count === 0)
      : analyzed !== null || item.event_count !== null) return null;
    if (["offline", "deferred_budget"].includes(item.state) && attempted !== null) return null;
    if (["no_media", "processing_failed"].includes(item.state) && attempted === null) return null;
    reports.push({ source_id: item.source_id, state: item.state,
      last_attempt_at: attempted === null ? null : new Date(attempted).toISOString(),
      last_analyzed_at: analyzed === null ? null : new Date(analyzed).toISOString(),
      detection_count: item.event_count });
  }
  return { authorization_id: policy.authorization_id, completed_at: new Date(completedAt).toISOString(), reports };
}
