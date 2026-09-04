import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContinuousMonitoringLifecycle } from "../../services/video-gateway/continuous-monitor.mjs";

const secret = "read-only-test-secret-value";
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const channel = (number) => ({ channel: number, status: "connected", gateway_stream_id: `safe-stream-${number}` });
const health = (inputs) => response(200, { ok: true, mediaHeartbeat: { inputs } });
const lease = () => response(200, { status: "starting", expires_in_seconds: 300 });

function monitorHarness({ channelList, fetchImpl, startAt = 1_000_000, random = () => 0, config = {} }) {
  let current = startAt;
  const lifecycle = createContinuousMonitoringLifecycle({
    gatewayUrl: "http://127.0.0.1:18082",
    gatewaySecret: secret,
    getChannels: () => channelList,
    fetchImpl,
    now: () => current,
    random,
    config: { intervalMs: 1_000, leaseRenewMs: 30_000, staleMs: 10_000, retryBaseMs: 250,
      retryMaxMs: 2_000, jitterRatio: 0, ...config }
  });
  return { lifecycle, advance: (milliseconds) => { current += milliseconds; } };
}

// Exponential retry includes deterministic jitter and never exceeds its cap.
{
  let playbackCalls = 0;
  const harness = monitorHarness({ channelList: [channel(8)], random: () => 1, config: { retryMaxMs: 1_000, jitterRatio: 0.2 },
    fetchImpl: async (url) => {
      if (url.endsWith("/health")) return health([]);
      playbackCalls += 1;
      return response(503, { error: "closed" });
    } });
  let state = await harness.lifecycle.runCycle();
  assert.equal(Date.parse(state.channels[0].next_retry_at) - Date.parse(state.channels[0].last_checked_at), 300);
  harness.advance(300);
  state = await harness.lifecycle.runCycle();
  assert.equal(playbackCalls, 2);
  assert.equal(Date.parse(state.channels[0].next_retry_at) - Date.parse(state.channels[0].last_checked_at), 600);
  harness.advance(600);
  state = await harness.lifecycle.runCycle();
  assert.equal(playbackCalls, 3);
  assert.equal(Date.parse(state.channels[0].next_retry_at) - Date.parse(state.channels[0].last_checked_at), 1_000);
}

// An idle dashboard does not own the local monitoring lease. The lifecycle
// renews it before expiry while frame counters continue progressing.
{
  const calls = [];
  let bytes = 100;
  const harness = monitorHarness({ channelList: [channel(1)], fetchImpl: async (url) => {
    calls.push(url);
    if (url.endsWith("/health")) return health([{ channel: 1, bytes, chunks: bytes / 100, input_idle_ms: 100 }]);
    return lease();
  }});
  let state = await harness.lifecycle.runCycle();
  assert.equal(calls.filter((url) => url.endsWith("/playback")).length, 1);
  assert.equal(state.progressing_channels, 1);
  harness.advance(20_000); bytes = 200;
  await harness.lifecycle.runCycle();
  assert.equal(calls.filter((url) => url.endsWith("/playback")).length, 1);
  harness.advance(11_000); bytes = 300;
  state = await harness.lifecycle.runCycle();
  assert.equal(calls.filter((url) => url.endsWith("/playback")).length, 2);
  assert.equal(state.channels[0].status, "healthy");
}

// A closed source is marked missing, reopened through the read-only playback
// route, and becomes healthy only after a later frame-progress observation.
{
  let cycle = 0;
  const harness = monitorHarness({ channelList: [channel(2)], fetchImpl: async (url) => {
    if (url.endsWith("/health")) {
      cycle += 1;
      return cycle === 1 ? health([]) : health([{ channel: 2, bytes: 500, chunks: 5, input_idle_ms: 50 }]);
    }
    return lease();
  }});
  let state = await harness.lifecycle.runCycle();
  assert.equal(state.channels[0].status, "recovering");
  assert.equal(state.progressing_channels, 0);
  harness.advance(1_000);
  state = await harness.lifecycle.runCycle();
  assert.equal(state.channels[0].status, "healthy");
  assert.equal(state.progressing_channels, 1);
}

// Retry delay is capped and independent per channel. One failed channel cannot
// prevent another channel from acquiring or refreshing its own lease.
{
  const playbackCalls = new Map([[3, 0], [4, 0]]);
  let channelThreeFails = true;
  const harness = monitorHarness({ channelList: [channel(3), channel(4)], fetchImpl: async (url) => {
    if (url.endsWith("/health")) return health([]);
    const number = Number(url.match(/safe-stream-(\d+)/)?.[1]);
    playbackCalls.set(number, playbackCalls.get(number) + 1);
    if (number === 3 && channelThreeFails) return response(503, { error: "source_closed" });
    return lease();
  }});
  let state = await harness.lifecycle.runCycle();
  assert.equal(state.channels.find((item) => item.channel === 3).status, "degraded");
  assert.equal(state.channels.find((item) => item.channel === 4).status, "recovering");
  assert.deepEqual(Object.fromEntries(playbackCalls), { 3: 1, 4: 1 });
  harness.advance(249);
  await harness.lifecycle.runCycle();
  assert.equal(playbackCalls.get(3), 1);
  channelThreeFails = false;
  harness.advance(1);
  state = await harness.lifecycle.runCycle();
  assert.equal(playbackCalls.get(3), 2);
  assert.equal(state.channels.find((item) => item.channel === 3).status, "recovering");
}

// Process restart intentionally does not restore bearer material. A fresh
// lifecycle reacquires a lease from loopback for every currently connected source.
{
  let playbackCalls = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith("/health")) return health([{ channel: 5, bytes: 100, chunks: 1, input_idle_ms: 10 }]);
    playbackCalls += 1;
    return lease();
  };
  const first = monitorHarness({ channelList: [channel(5)], fetchImpl });
  await first.lifecycle.runCycle();
  await first.lifecycle.stop();
  const second = monitorHarness({ channelList: [channel(5)], fetchImpl, startAt: 2_000_000 });
  const state = await second.lifecycle.runCycle();
  assert.equal(playbackCalls, 2);
  assert.equal(state.physical_commands_sent, 0);
}

// Shutdown aborts an in-flight read and completes without waiting for its timeout.
{
  let observedSignal;
  const harness = monitorHarness({ channelList: [channel(6)], fetchImpl: async (_url, options) => {
    observedSignal = options.signal;
    return await new Promise((_resolve, reject) => options.signal.addEventListener("abort", () => {
      reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
    }, { once: true }));
  }});
  const pending = harness.lifecycle.runCycle();
  await Promise.resolve();
  const stopped = harness.lifecycle.stop();
  await Promise.all([pending, stopped]);
  assert.equal(observedSignal.aborted, true);
}

// The component has no route-building authority outside health and playback.
{
  const called = [];
  const harness = monitorHarness({ channelList: [channel(7)], fetchImpl: async (url) => {
    called.push(new URL(url).pathname);
    return url.endsWith("/health") ? health([]) : lease();
  }});
  const state = await harness.lifecycle.runCycle();
  assert.deepEqual(called, ["/health", "/camera/safe-stream-7/playback"]);
  assert.equal(called.some((path) => /prepare|confirm|control|command|action/i.test(path)), false);
  const serialized = JSON.stringify(state);
  assert.equal(serialized.includes("safe-stream-7"), false);
  assert.equal(serialized.includes(secret), false);
  assert.equal(/token|hls_url|private_endpoint/i.test(serialized), false);
}

{
  const runner = readFileSync(new URL("../run-persistent-home-gateway.mjs", import.meta.url), "utf8");
  const monitorStart = runner.lastIndexOf("await continuousMonitor.start();");
  const initialDiscovery = runner.lastIndexOf('await discoverWithRetry("initial");');
  assert(monitorStart > 0 && initialDiscovery > monitorStart, "local monitor must start before cloud-coupled discovery retries");
}

console.log(JSON.stringify({
  status: "PASS",
  cases: ["idle_lease_renewal", "socket_closure_recovery", "partial_channel_failure", "capped_exponential_backoff_with_jitter", "process_restart_reacquire", "shutdown_abort", "readonly_route_boundary", "monitor_starts_before_cloud_sync"],
  physical_commands_sent: 0
}));
