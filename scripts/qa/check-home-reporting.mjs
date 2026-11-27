import assert from "node:assert/strict";
import test from "node:test";
import { observeHomeReporting } from "./observe-home-reporting.mjs";

const at = Date.parse("2026-01-01T00:00:00Z");
function run({ listener = "listening", modify = () => {} } = {}) {
  return observeHomeReporting({ now: () => at, listener: async () => listener, probe: async port => {
    const recorder = port === 18082;
    const body = { contract: "observer-edge-health-v1", ok: true, observed_at: new Date(at).toISOString(),
      deviceAuthorization: { status: "ready" }, edgeRuntime: { device_type: recorder ? "PHYSICAL_GATEWAY" : "SOFTWARE_CONNECTOR" },
      mediaHeartbeat: { progressingRelays: recorder ? 10 : 1 }, private_data: "must_never_appear" };
    modify(body, recorder);
    return { http_status: 200, body };
  } });
}

test("healthy local evidence never promotes Product or iPhone proof", async () => {
  const result = await run();
  assert.deepEqual(result.blockers, []);
  assert.equal(result.product_source_update, "not_observed");
  assert.equal(result.iphone_playback, "not_observed");
  assert.ok(!JSON.stringify(result).includes("must_never_appear"));
});

test("a progressing recorder stays distinct from cloud authorization and the standalone camera", async () => {
  const result = await run({ listener: "refused", modify(body, recorder) {
    body.deviceAuthorization.status = "unavailable";
    if (!recorder) { body.ok = false; body.mediaHeartbeat.progressingRelays = 0; }
  } });
  assert.deepEqual(result.components.map(d => d.progressing), [10, 0]);
  assert.deepEqual(result.blockers, ["qa_listener_refused", "recorder_authorization_unavailable",
    "standalone_authorization_unavailable", "standalone_local_health_incomplete"]);
});

test("wrong device and stale samples cannot qualify a component", async () => {
  const result = await run({ modify(body, recorder) {
    if (recorder) body.edgeRuntime.device_type = "SOFTWARE_CONNECTOR";
    else body.observed_at = new Date(at - 16000).toISOString();
  } });
  assert.deepEqual(result.blockers, ["recorder_missing_fresh_health", "standalone_missing_fresh_health"]);
});

test("malformed status and count fail closed without leaking raw values", async () => {
  const result = await run({ modify(body) {
    body.deviceAuthorization.status = "must_never_appear"; body.mediaHeartbeat.progressingRelays = "10";
  } });
  assert.equal(result.blockers.length, 4);
  assert.ok(result.components.every(d => d.progressing === null && d.authorization === "unknown"));
  assert.ok(!JSON.stringify(result).includes("must_never_appear"));
});
