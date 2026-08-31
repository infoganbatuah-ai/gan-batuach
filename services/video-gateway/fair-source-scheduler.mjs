const states = new Set(["no_event", "event_detected", "no_media", "processing_failed"]);

// The caller supplies a fresh, server-authorized site/source policy. This
// scheduler neither grants consent nor reads credentials, media or device state.
export function createFairSourceScheduler({ concurrency = 2, maxSourcesPerRound = 20, roundBudgetMs = 60_000, timeoutMs = 20_000, now = Date.now } = {}) {
  for (const value of [concurrency, maxSourcesPerRound, roundBudgetMs, timeoutMs]) {
    if (!Number.isSafeInteger(value) || value < 1) throw new Error("invalid_scheduler_budget");
  }
  if (concurrency > 4 || maxSourcesPerRound > 128 || roundBudgetMs > 300_000 || timeoutMs > roundBudgetMs) throw new Error("unsafe_scheduler_budget");
  let nextSource = null;
  let round = null;
  const inFlight = new Set();

  async function execute(sources, policy, sample) {
    const started = now();
    const unique = new Map();
    for (const source of sources) {
      if (!source || typeof source.id !== "string" || !source.id || unique.has(source.id)) throw new Error("invalid_or_duplicate_source");
      unique.set(source.id, source);
    }
    if (unique.size > 128) throw new Error("source_budget_exceeded");
    const ordered = [...unique.values()].sort((a, b) => a.id.localeCompare(b.id));
    const offset = Math.max(0, ordered.findIndex((source) => source.id === nextSource));
    const queue = [...ordered.slice(offset), ...ordered.slice(0, offset)];
    const allowed = new Set(Array.isArray(policy?.sourceIds) ? policy.sourceIds : []);
    const reports = new Map(ordered.map((source) => [source.id, {
      source_id: source.id,
      state: source.connected !== true ? "offline"
        : policy?.consentVerified !== true || !Number.isFinite(policy.expiresAt) || policy.expiresAt <= started || !allowed.has(source.id)
          ? "consent_unavailable" : "deferred_budget",
      last_attempt_at: null, last_analyzed_at: null, event_count: null
    }]));
    let cursor = 0, attempted = 0;
    const worker = async () => {
      while (cursor < queue.length && attempted < maxSourcesPerRound && now() - started < roundBudgetMs) {
        if (inFlight.size >= concurrency) return;
        const source = queue[cursor++];
        nextSource = queue[cursor % queue.length]?.id ?? null;
        const report = reports.get(source.id);
        if (source.connected !== true) continue;
        if (policy?.consentVerified !== true || !Number.isFinite(policy.expiresAt) || policy.expiresAt <= now() || !allowed.has(source.id)) {
          report.state = "consent_unavailable";
          continue;
        }
        attempted += 1;
        const attemptedAt = now();
        report.last_attempt_at = new Date(attemptedAt).toISOString();
        const controller = new AbortController();
        const limit = Math.min(timeoutMs, roundBudgetMs - (now() - started), policy.expiresAt - now());
        let timer;
        let task;
        task = Promise.resolve().then(() => sample(source, controller.signal)).finally(() => inFlight.delete(task));
        inFlight.add(task);
        try {
          const result = await Promise.race([task, new Promise((_, reject) => {
            timer = setTimeout(() => { controller.abort(); reject(new Error("sample_timeout")); }, limit);
          })]);
          if (policy.expiresAt <= now()) {
            report.state = "consent_unavailable";
            continue;
          }
          if (!result || !states.has(result.state)) throw new Error("invalid_sample_result");
          if (result.state === "no_event" || result.state === "event_detected") {
            const analyzed = Date.parse(String(result.analyzedAt ?? ""));
            if (!Number.isFinite(analyzed) || analyzed < attemptedAt || analyzed > now()) throw new Error("invalid_sample_time");
            if (!Number.isSafeInteger(result.eventCount) || result.eventCount < 0 || result.eventCount > 100 || (result.state === "no_event") !== (result.eventCount === 0)) throw new Error("invalid_event_count");
            report.last_analyzed_at = new Date(analyzed).toISOString();
            report.event_count = result.eventCount;
          }
          report.state = result.state;
        } catch {
          report.state = policy.expiresAt <= now() ? "consent_unavailable" : "processing_failed";
        } finally {
          clearTimeout(timer);
        }
      }
    };
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { reports: [...reports.values()], attempted, continuous_coverage: false, media_retained: false };
  }

  return {
    run(sources, policy, sample) {
      if (round) return round;
      round = execute(sources, policy, sample).finally(() => { round = null; });
      return round;
    }
  };
}
