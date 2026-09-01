const DEFAULTS = Object.freeze({
  intervalMs: 10_000,
  leaseRenewMs: 120_000,
  staleMs: 30_000,
  requestTimeoutMs: 12_000,
  retryBaseMs: 2_000,
  retryMaxMs: 60_000,
  jitterRatio: 0.2,
  maxConcurrent: 4
});

function finiteInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
}

function safeConfig(input = {}) {
  return Object.freeze({
    intervalMs: finiteInteger(input.intervalMs, DEFAULTS.intervalMs, 1_000, 60_000),
    leaseRenewMs: finiteInteger(input.leaseRenewMs, DEFAULTS.leaseRenewMs, 30_000, 240_000),
    staleMs: finiteInteger(input.staleMs, DEFAULTS.staleMs, 10_000, 120_000),
    requestTimeoutMs: finiteInteger(input.requestTimeoutMs, DEFAULTS.requestTimeoutMs, 1_000, 30_000),
    retryBaseMs: finiteInteger(input.retryBaseMs, DEFAULTS.retryBaseMs, 250, 30_000),
    retryMaxMs: finiteInteger(input.retryMaxMs, DEFAULTS.retryMaxMs, 1_000, 300_000),
    jitterRatio: Math.max(0, Math.min(0.5, Number(input.jitterRatio ?? DEFAULTS.jitterRatio))),
    maxConcurrent: finiteInteger(input.maxConcurrent, DEFAULTS.maxConcurrent, 1, 8)
  });
}

function loopbackOrigin(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" || parsed.hostname !== "127.0.0.1" || parsed.username || parsed.password
    || parsed.pathname !== "/" || parsed.search || parsed.hash) throw new Error("continuous_monitor_loopback_required");
  return parsed.origin;
}

function connectedChannels(value) {
  const unique = new Map();
  for (const item of Array.isArray(value) ? value : []) {
    const channel = Number(item?.channel);
    const streamId = String(item?.gateway_stream_id || "");
    if (item?.status !== "connected" || !Number.isInteger(channel) || channel < 1 || channel > 64
      || !streamId || streamId.length > 256 || /[\u0000-\u001f]/.test(streamId) || unique.has(channel)) continue;
    unique.set(channel, { channel, streamId });
  }
  return [...unique.values()].sort((left, right) => left.channel - right.channel);
}

function publicRecord(record, now) {
  return {
    channel: record.channel,
    status: record.status,
    progressing: record.progressing,
    last_progress_at: record.lastProgressAt ? new Date(record.lastProgressAt).toISOString() : null,
    last_lease_at: record.lastLeaseAt ? new Date(record.lastLeaseAt).toISOString() : null,
    last_checked_at: record.lastCheckedAt ? new Date(record.lastCheckedAt).toISOString() : null,
    stale_for_ms: record.lastProgressAt ? Math.max(0, now - record.lastProgressAt) : null,
    consecutive_failures: record.failures,
    next_retry_at: record.nextRetryAt > now ? new Date(record.nextRetryAt).toISOString() : null,
    last_error: record.lastError
  };
}

async function boundedMap(values, concurrency, operation) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      await operation(values[index]);
    }
  });
  await Promise.all(workers);
}

export function createContinuousMonitoringLifecycle({
  gatewayUrl,
  gatewaySecret,
  getChannels,
  report = () => undefined,
  fetchImpl = globalThis.fetch,
  now = Date.now,
  random = Math.random,
  setTimer = setTimeout,
  clearTimer = clearTimeout,
  config: inputConfig = {}
}) {
  const origin = loopbackOrigin(gatewayUrl);
  if (typeof gatewaySecret !== "string" || gatewaySecret.length < 16) throw new Error("continuous_monitor_secret_required");
  if (typeof getChannels !== "function" || typeof fetchImpl !== "function") throw new Error("continuous_monitor_dependencies_invalid");
  const config = safeConfig(inputConfig);
  const records = new Map();
  const controllers = new Set();
  let timer = null;
  let running = false;
  let stopping = false;
  let inFlight = null;
  let cycleCount = 0;
  let lastHealthAt = null;
  let lastHealthError = null;

  function syncRecords(at) {
    const desired = connectedChannels(getChannels());
    const desiredChannels = new Set(desired.map((item) => item.channel));
    for (const channel of records.keys()) if (!desiredChannels.has(channel)) records.delete(channel);
    for (const item of desired) {
      const current = records.get(item.channel);
      if (current?.streamId === item.streamId) continue;
      records.set(item.channel, {
        ...item,
        status: "starting",
        progressing: false,
        lastBytes: null,
        lastChunks: null,
        lastProgressAt: null,
        lastLeaseAt: null,
        lastCheckedAt: at,
        nextRetryAt: 0,
        failures: 0,
        lastError: null
      });
    }
    return desired;
  }

  async function requestJson(path) {
    if (!(path === "/health" || /^\/camera\/[^/]+\/playback$/.test(path))) throw new Error("continuous_monitor_readonly_path_blocked");
    const controller = new AbortController();
    controllers.add(controller);
    const timeout = setTimer(() => controller.abort(), config.requestTimeoutMs);
    timeout?.unref?.();
    try {
      const response = await fetchImpl(`${origin}${path}`, {
        method: "GET",
        headers: { "x-video-gateway-secret": gatewaySecret },
        signal: controller.signal
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw Object.assign(new Error(`gateway_http_${response.status}`), { status: response.status });
      return body;
    } finally {
      clearTimer(timeout);
      controllers.delete(controller);
    }
  }

  function retryDelay(failures) {
    const exponential = Math.min(config.retryMaxMs, config.retryBaseMs * (2 ** Math.max(0, failures - 1)));
    const jitter = Math.floor(exponential * config.jitterRatio * Math.max(0, Math.min(1, random())));
    return Math.min(config.retryMaxMs, exponential + jitter);
  }

  async function renew(record, at) {
    if (stopping || at < record.nextRetryAt) return;
    try {
      const result = await requestJson(`/camera/${encodeURIComponent(record.streamId)}/playback`);
      if (!result || !Number.isFinite(Number(result.expires_in_seconds))) throw new Error("playback_lease_invalid");
      record.lastLeaseAt = at;
      record.failures = 0;
      record.nextRetryAt = 0;
      record.lastError = null;
      if (!record.progressing) record.status = "recovering";
    } catch (error) {
      if (stopping && error?.name === "AbortError") return;
      record.failures += 1;
      record.nextRetryAt = at + retryDelay(record.failures);
      record.lastError = error instanceof Error ? error.message.slice(0, 120) : "lease_failed";
      record.status = "degraded";
    }
  }

  function observe(record, metric, at) {
    record.lastCheckedAt = at;
    const bytes = Number(metric?.bytes);
    const chunks = Number(metric?.chunks);
    const idle = Number(metric?.input_idle_ms);
    const hasMetric = Number.isFinite(bytes) && bytes >= 0 && Number.isFinite(chunks) && chunks >= 0;
    const advanced = hasMetric && record.lastBytes !== null && (bytes > record.lastBytes || chunks > record.lastChunks);
    const freshInitial = hasMetric && record.lastBytes === null && (bytes > 0 || chunks > 0)
      && Number.isFinite(idle) && idle <= config.staleMs;
    if (advanced || freshInitial) record.lastProgressAt = advanced ? at : Math.max(1, at - Math.max(0, idle));
    if (hasMetric) {
      record.lastBytes = bytes;
      record.lastChunks = chunks;
    }
    const freshByGateway = hasMetric && Number.isFinite(idle) && idle <= config.staleMs;
    record.progressing = Boolean(record.lastProgressAt && at - record.lastProgressAt <= config.staleMs && freshByGateway);
    if (record.progressing) {
      record.status = record.failures === 0 ? "healthy" : "degraded";
      if (record.failures === 0) record.lastError = null;
    } else if (record.status !== "degraded") {
      record.status = hasMetric ? "stale" : "missing";
    }
  }

  function snapshot() {
    const at = now();
    const channels = [...records.values()].map((record) => publicRecord(record, at));
    return {
      version: 1,
      read_only: true,
      physical_commands_sent: 0,
      running,
      stopping,
      cycle_count: cycleCount,
      expected_channels: channels.length,
      progressing_channels: channels.filter((item) => item.progressing).length,
      degraded_channels: channels.filter((item) => !item.progressing).length,
      last_health_at: lastHealthAt ? new Date(lastHealthAt).toISOString() : null,
      last_health_error: lastHealthError,
      channels
    };
  }

  async function runCycle() {
    if (stopping) return snapshot();
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const at = now();
      const desired = syncRecords(at);
      let health = null;
      try {
        health = await requestJson("/health");
        lastHealthAt = at;
        lastHealthError = null;
      } catch (error) {
        if (!(stopping && error?.name === "AbortError")) lastHealthError = error instanceof Error ? error.message.slice(0, 120) : "health_failed";
      }
      const metrics = new Map((Array.isArray(health?.mediaHeartbeat?.inputs) ? health.mediaHeartbeat.inputs : [])
        .map((metric) => [Number(metric?.channel), metric]).filter(([channel]) => Number.isInteger(channel)));
      for (const item of desired) observe(records.get(item.channel), metrics.get(item.channel), at);
      const renewals = desired.map((item) => records.get(item.channel)).filter((record) => {
        const leaseDue = !record.lastLeaseAt || at - record.lastLeaseAt >= config.leaseRenewMs;
        return at >= record.nextRetryAt && (leaseDue || !record.progressing);
      });
      await boundedMap(renewals, config.maxConcurrent, (record) => renew(record, at));
      cycleCount += 1;
      const state = snapshot();
      await report(state);
      return state;
    })().finally(() => { inFlight = null; });
    return inFlight;
  }

  function schedule() {
    if (!running || stopping) return;
    timer = setTimer(async () => {
      timer = null;
      try { await runCycle(); } catch {}
      schedule();
    }, config.intervalMs);
    timer?.unref?.();
  }

  async function start() {
    if (running) return snapshot();
    stopping = false;
    running = true;
    const state = await runCycle();
    schedule();
    return state;
  }

  async function stop() {
    if (!running && !inFlight) return snapshot();
    stopping = true;
    running = false;
    if (timer) clearTimer(timer);
    timer = null;
    for (const controller of controllers) controller.abort();
    await inFlight?.catch(() => undefined);
    controllers.clear();
    return snapshot();
  }

  return Object.freeze({ start, stop, runCycle, snapshot });
}
