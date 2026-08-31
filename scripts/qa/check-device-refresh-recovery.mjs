import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as enrollment from "../../lib/domain/gateway-device-enrollment.ts";
import { refreshDeviceCredentials, pendingDeviceRefreshAccount } from "../../services/video-gateway/device-refresh.mjs";

const gatewayId = randomUUID(), siteId = randomUUID();
let clock = Date.now(), row, writes = [], requests = 0, dropResponse = false, rejectWrite = false;
const secrets = new Map();
const fakeDate = class extends Date { static now() { return clock; } };
const admin = { from(table) {
  const filters = [], chain = { patch: null,
    select: () => chain, eq: (key, value) => { filters.push([key, value]); return chain; },
    update: patch => { chain.patch = patch; return chain; },
    insert: value => { writes.push({ table, value }); return Promise.resolve({ error: null }); },
    maybeSingle: async () => {
      assert.equal(table, "video_gateway_device_enrollments");
      if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
      if (chain.patch) { row = { ...row, ...chain.patch }; writes.push({ table, value: chain.patch }); }
      return { data: structuredClone(row), error: null };
    }
  }; return chain;
} };
const modules = {
  "node:crypto": { randomUUID }, zod: { z },
  "@/lib/api": { ok: (data, status = 200) => Response.json({ data }, { status }), fail: (error, status) => Response.json({ error }, { status }), handleRouteError: () => Response.json({ error: "invalid" }, { status: 400 }) },
  "@/lib/domain/digital-observer/access": { getDigitalObserverApiUser: () => { throw new Error("Refresh cannot use browser credentials"); } },
  "@/lib/domain/gateway-device-enrollment": enrollment,
  "@/lib/supabase/admin": { createAdminClient: () => admin }
};
const route = {};
runInNewContext(ts.transpileModule(readFileSync("app/api/digital-observer/gateway-enrollment/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, {
  exports: route, Request, Response, Date: fakeDate, process: { env: { VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET: "synthetic-cloud-secret" } },
  require: name => { assert.ok(name in modules, name); return modules[name]; }
});
const reset = () => {
  secrets.clear(); writes = []; requests = 0; dropResponse = false; rejectWrite = false;
  const token = enrollment.newGatewayRefreshToken();
  secrets.set("device_refresh_token", token);
  row = { id: randomUUID(), gateway_id: gatewayId, observer_site_id: siteId, status: "delivered", refresh_token_hash: enrollment.hashGatewayEnrollmentToken(token), metadata: {} };
};
const options = {
  gatewayId, cloudBaseUrl: "https://synthetic.invalid", readSecret: key => secrets.get(key) || "",
  writeSecret: (key, value) => { if (rejectWrite) throw new Error("synthetic Keychain unavailable"); secrets.set(key, value); },
  removeSecret: key => secrets.delete(key),
  fetcher: async (url, init) => {
    requests++;
    assert.ok(secrets.has(pendingDeviceRefreshAccount), "Recovery material must be durable before the request");
    const response = await route.POST(new Request(url, init));
    if (dropResponse) { dropResponse = false; throw new Error("synthetic lost response"); }
    return response;
  }
};
reset();
dropResponse = true;
await assert.rejects(refreshDeviceCredentials(options), /lost response/);
const pending = JSON.parse(secrets.get(pendingDeviceRefreshAccount));
assert.equal(row.refresh_token_hash, enrollment.hashGatewayEnrollmentToken(pending.next));
assert.equal(secrets.get("device_refresh_token"), pending.previous);
clock += 5 * 60_000;
const recovered = await refreshDeviceCredentials(options);
assert.ok(recovered.accessToken);
assert.equal(secrets.get("device_refresh_token"), pending.next);
assert.equal(secrets.has(pendingDeviceRefreshAccount), false);
assert.equal(requests, 3, "After grace expiry only the prepared current key can recover");
assert.equal(JSON.stringify(writes).includes(pending.next), false, "Cloud writes contain hashes only");
assert.equal(JSON.stringify(writes).includes(pending.previous), false);
assert.equal(row.gateway_id, gatewayId); assert.equal(row.observer_site_id, siteId);

reset();
let failPromotion = true;
const failedPromotionOptions = { ...options, writeSecret: (key, value) => {
  if (key === "device_refresh_token" && failPromotion) throw new Error("synthetic promotion failure");
  secrets.set(key, value);
} };
await assert.rejects(refreshDeviceCredentials(failedPromotionOptions), /promotion failure/);
clock += 5 * 60_000;
failPromotion = false;
await refreshDeviceCredentials(failedPromotionOptions);
assert.equal(secrets.has(pendingDeviceRefreshAccount), false, "Restart also recovers a failed local promotion after server commit");
assert.equal(row.refresh_token_hash, enrollment.hashGatewayEnrollmentToken(secrets.get("device_refresh_token")));

reset();
await assert.rejects(refreshDeviceCredentials({ ...options, fetcher: async () => { throw new Error("synthetic offline"); } }), /offline/);
await refreshDeviceCredentials(options);
assert.equal(secrets.has(pendingDeviceRefreshAccount), false, "Failure before server commit retries the saved original transaction");

reset(); rejectWrite = true;
await assert.rejects(refreshDeviceCredentials(options), /Keychain unavailable/);
assert.equal(requests, 0, "Do not rotate if local recovery cannot be saved");
reset();
const old = secrets.get("device_refresh_token");
row.status = "revoked";
await assert.rejects(refreshDeviceCredentials(options), error => error.code === "device_relink_required");
assert.equal(secrets.get("device_refresh_token"), old);
assert.equal(writes.length, 0, "Recovery never reactivates a revoked device");
reset();
const legacy = await route.POST(new Request("https://synthetic.invalid/refresh", { method: "POST", body: JSON.stringify({ action: "refresh", gateway_id: gatewayId, refresh_token: secrets.get("device_refresh_token") }) }));
assert.equal(legacy.status, 200); assert.equal((await legacy.json()).data.rotation_protocol, 1);
assert.notEqual(row.refresh_token_hash, enrollment.hashGatewayEnrollmentToken(secrets.get("device_refresh_token")));
const implementation = readFileSync("services/video-gateway/device-refresh.mjs", "utf8");
assert.doesNotMatch(implementation, /node:fs|writeFile|console\.|process\.env/);
console.log("Device refresh lost-response/restart recovery, Keychain-before-network, revocation, scope, hash-only cloud writes and legacy compatibility PASS");
