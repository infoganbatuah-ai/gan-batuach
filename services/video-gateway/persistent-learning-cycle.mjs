import { createFairSourceScheduler } from "./fair-source-scheduler.mjs";
import { createAnalysisRoundReport } from "./analysis-round-report.mjs";

const eventLabels = new Set(["person", "car", "motorcycle", "truck", "dog", "cat"]);

export function createPersistentLearningCycle({ authorize, analyze, publishSamples, publishEvent, publishReport, now = Date.now, cooldownMs = 600_000, schedulerOptions = {} }) {
  const scheduler = createFairSourceScheduler({ ...schedulerOptions, now });
  const cooldowns = new Map();
  let current = null;

  async function execute(channels) {
    const sources = channels.filter(channel => channel.camera_source_id && channel.gateway_stream_id)
      .map(channel => ({ id: channel.camera_source_id, connected: channel.status === "connected", channel }));
    if (!sources.length) return { reports: [], attempted: 0, state: "no_mapped_sources" };
    let policy;
    try {
      policy = await authorize(sources.map(source => source.id));
      if (!policy || policy.consentVerified !== true || !Array.isArray(policy.sourceIds) || !Number.isFinite(policy.expiresAt) || policy.expiresAt <= now()
        || policy.expiresAt > now() + 90_000 || policy.physical_actions_allowed !== false || policy.biometric_matching_allowed !== false
        || policy.sourceIds.some(id => !sources.some(source => source.id === id))) throw new Error("invalid_policy");
    } catch {
      policy = { consentVerified: false, sourceIds: [], expiresAt: now(), authorization_id: policy?.authorization_id };
    }
    const samples = new Map();
    const round = await scheduler.run(sources, policy, async (source, signal) => {
      const data = await analyze(source.channel, signal);
      signal.throwIfAborted();
      if (policy.expiresAt <= now()) throw new Error("expired_policy");
      if (data?.state === "no_media") return { state: "no_media" };
      const insight = data?.insight;
      if (data?.stream_id !== source.channel.gateway_stream_id || data?.local_processing !== true || data?.no_raw_video_returned !== true || insight?.object_detection?.status !== "sampled"
        || !Array.isArray(insight.object_detection.detections)) return { state: "processing_failed" };
      if (!insight.object_detection.detections.every(item => typeof item?.label === "string"
        && Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1)) return { state: "processing_failed" };
      const analyzedAt = Date.parse(String(insight.sampled_at ?? ""));
      if (!Number.isFinite(analyzedAt) || analyzedAt > now()) return { state: "processing_failed" };
      if (![insight.motion_score, insight.luminance_score].every(value => Number.isFinite(value) && value >= 0 && value <= 1)
        || !Number.isInteger(insight.sample_frames) || insight.sample_frames < 1 || insight.sample_frames > 2) return { state: "processing_failed" };
      const detections = insight.object_detection.detections.filter(item => eventLabels.has(item?.label)
        && Number.isFinite(item.confidence) && item.confidence >= 0.55 && item.confidence <= 1).slice(0, 10)
        .map(({ label, confidence }) => ({ label, confidence }));
      const sample = {
        stream_id: source.channel.gateway_stream_id, motion_score: insight.motion_score,
        luminance_score: insight.luminance_score, sampled_at: insight.sampled_at,
        sample_frames: insight.sample_frames, channel: source.channel, detections
      };
      samples.set(source.id, sample);
      return { state: detections.length ? "event_detected" : "no_event", analyzedAt: insight.sampled_at, eventCount: detections.length };
    });
    // Only samples accepted by the scheduler may leave the local cycle.
    const accepted = round.reports.filter(report => report.last_analyzed_at).map(report => samples.get(report.source_id)).filter(Boolean);
    let metricsSubmitted = false, eventsSubmitted = 0, eventFailures = 0, eventsDeferred = 0;
    if (accepted.length && policy.expiresAt > now()) {
      try {
        const published = await publishSamples(accepted.map(({ stream_id, motion_score, luminance_score, sampled_at, sample_frames }) => ({ stream_id, motion_score, luminance_score, sampled_at, sample_frames })));
        metricsSubmitted = published?.submitted === true;
      } catch { /* A metrics outage must not suppress independently verified event media. */ }
    }
    for (const sample of accepted) {
      const primary = sample.detections[0];
      if (!primary) continue;
      const key = `${sample.channel.camera_source_id}:${primary.label}`;
      if ((cooldowns.get(key) ?? -Infinity) + cooldownMs > now()) continue;
      const remaining = Math.floor(policy.expiresAt - now());
      if (remaining <= 0) { eventsDeferred++; continue; }
      try {
        const result = await publishEvent(sample.channel, primary, AbortSignal.timeout(remaining));
        if (result?.submitted === true) { cooldowns.set(key, now()); eventsSubmitted++; }
        else eventFailures++;
      } catch { eventFailures++; }
    }
    for (const [key, recordedAt] of cooldowns) if (recordedAt + cooldownMs <= now()) cooldowns.delete(key);
    samples.clear();
    let reportSubmitted = false;
    const report = createAnalysisRoundReport(policy, round, now());
    if (report && publishReport) {
      try { reportSubmitted = (await publishReport(report))?.submitted === true; }
      catch { /* Reporting failure is not an empty successful analysis round. */ }
    }
    return { ...round, state: policy.consentVerified === true ? "finished" : "policy_unavailable",
      metrics_submitted: metricsSubmitted, events_submitted: eventsSubmitted, event_failures: eventFailures, events_deferred: eventsDeferred,
      report_submitted: reportSubmitted };
  }
  return {
    run(channels) {
      if (current) return current;
      current = execute(channels).finally(() => { current = null; });
      return current;
    }
  };
}
