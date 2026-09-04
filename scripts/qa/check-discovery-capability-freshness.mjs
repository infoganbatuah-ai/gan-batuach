import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

// Execute only the reviewed discovery function, with every external operation
// replaced. Never import/start the runner, access credentials, or open a stream.
const path = resolve(process.argv[2] ?? "scripts/run-persistent-home-gateway.mjs");
const source = readFileSync(path, "utf8");
const start = source.indexOf("async function discover() {");
const end = source.indexOf("\nasync function runDiscoveryWithRetry", start);
assert(start >= 0 && end > start, "Expected bounded discovery function");
const discovery = source.slice(start, end);
assert(!/\b(?:import|process|require|spawn|eval)\b/.test(discovery), "Unexpected process operation in discovery function");

async function run({ discoveryFails = false, healthFails = false, readinessAfterDiscovery = true } = {}) {
  let discovered = false;
  const calls = [], uploads = [];
  const contract = ready => ({ version: 1, models: { loaded: ready }, capability_test: { passed: ready } });
  const context = vm.createContext({
    gatewayUrl: "http://fixture.invalid", gatewaySecret: "fixture-secret",
    config: { endpoint: "fixture.invalid", port: 80, username: "fixture", vendor: "fixture", channel_count: 2 },
    password: "fixture-only", gatewayId: "fixture-gateway", observerSiteId: "fixture-site",
    DISCOVERY_REQUEST_TIMEOUT_MS: 100, EMPTY_DISCOVERY_CONFIRMATIONS: 3,
    VERIFIED_CONNECTED_COUNT_KEY: "fixture-count", consecutiveEmptyDiscoveries: 0, channels: [],
    AbortSignal: { timeout: () => undefined }, crypto: { randomUUID: () => "fixture-discovery" },
    keychainSecret: () => "0", storeKeychainSecret: () => {},
    fetch: async (url, options) => {
      assert.equal(new URL(url).origin, "http://fixture.invalid");
      const route = new URL(url).pathname;
      calls.push(route);
      if (route === "/health") {
        if (healthFails) throw Error("fixture-health-unavailable");
        const observed = contract(discovered ? readinessAfterDiscovery : !readinessAfterDiscovery);
        return { ok: true, json: async () => ({ edge_capability_contract: observed }) };
      }
      assert.equal(route, "/dvr/connect");
      assert.equal(options.method, "POST");
      assert.equal(JSON.parse(options.body).metadata.read_only_requested, true);
      // Readiness changes during real discovery. A pre-discovery snapshot is stale.
      discovered = true;
      return { ok: !discoveryFails, json: async () => ({ channels: [1, 2].map(channel => ({ channel,
        stream_id: `fixture-stream-${channel}`, status: "connected", health_status: "healthy" })), latency_ms: 1 }) };
    },
    signedPost: async (route, payload, options) => {
      assert.equal(route, "/api/video-gateway/cloud-discovery");
      assert.equal(options.deviceAccess, true);
      uploads.push(JSON.parse(JSON.stringify(payload)));
      return { data: { channels: [] } };
    }
  });
  const invoke = new vm.Script(`${discovery}\ndiscover`, { filename: "isolated-discovery-fixture" }).runInContext(context, { timeout: 1000 });
  if (discoveryFails) {
    await assert.rejects(invoke(), /DVR discovery failed/);
    assert.equal(uploads.length, 0, "Failed discovery cannot publish a healthy replay");
    return;
  }
  await invoke();
  assert.equal(uploads.length, 1);
  assert.equal(uploads[0].channel_count, 2);
  assert.equal(uploads[0].connected_channel_count, 2);
  assert.equal(calls.filter(route => route === "/dvr/connect").length, 1);
  const published = uploads[0].metadata.edge_capability_contract;
  if (healthFails) assert.equal(published, null, "Health failure must not invent readiness");
  else {
    assert.equal(published?.models.loaded, readinessAfterDiscovery, "Published capability must be read AFTER discovery completes");
    assert.equal(published?.capability_test.passed, readinessAfterDiscovery);
    assert(calls.lastIndexOf("/health") > calls.indexOf("/dvr/connect"));
  }
}

await run();
await run({ readinessAfterDiscovery: false });
await run({ discoveryFails: true });
await run({ healthFails: true });
console.log("Discovery capability freshness: 4 cases passed; no real network, credentials, model, or video.");
