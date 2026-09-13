import assert from "node:assert/strict";
import { probeLocalHealth } from "./soak-health-probe.mjs";

const at = Date.parse("2026-09-13T00:00:00.000Z");
const response = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const valid = { contract: "observer-edge-health-v1", observed_at: new Date(at).toISOString(), ok: true, mediaHeartbeat: { progressingRelays: 1 }, status: "healthy" };
const check = async (fetchImpl) => probeLocalHealth(18083, { fetchImpl, now: () => at });
assert.equal((await check(async () => response(200, valid))).ok, true);
assert.equal((await check(async () => response(503, valid))).reason, "SERVICE_BUSY");
assert.equal((await check(async () => response(401, valid))).reason, "AUTH_FAILURE");
assert.equal((await check(async () => response(200, { ...valid, observed_at: new Date(at - 30_000).toISOString() }))).reason, "STALE_PAYLOAD");
assert.equal((await check(async () => response(200, { ok: true }))).reason, "INVALID_PAYLOAD");
assert.equal((await check(async () => ({ status: 200, ok: true, json: async () => { throw Error("bad_json"); } }))).reason, "MALFORMED_PAYLOAD");
assert.equal((await check(async () => { throw Object.assign(Error("refused"), { cause: { code: "ECONNREFUSED" } }); })).reason, "CONNECTION_REFUSED");
assert.equal((await check(async () => { throw Object.assign(Error("timeout"), { name: "TimeoutError" }); })).reason, "TIMEOUT");
const split = await check(async (url) => url.endsWith("/health/live")
  ? response(200, { contract: "observer-edge-liveness-v1", ok: true })
  : { status: 200, ok: true, json: async () => { throw Error("bad_json"); } });
assert.equal(split.reason, "MALFORMED_PAYLOAD");
assert.equal(split.liveness.ok, true);
console.log("push38c health probe classification: PASS");
