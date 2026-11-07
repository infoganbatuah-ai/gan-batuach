// Explicit local-runtime probe, never part of an automatic live-provider gate.
// Start Wrangler --local first. Identity/control replies below are SYNTHETIC.
import { request } from "node:https";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { SYNTHETIC_QA as scope } from "../../services/video-gateway/push44-ch1-private-media.mjs";
import { issueGatewayPlaybackGrant } from "../../lib/domain/gateway-device-enrollment.ts";
const certificate = process.argv.find(x => x.startsWith("--certificate="))?.slice(14);
if (!/^\/private\/tmp\/p44-synthetic-tls\.[A-Za-z0-9]+\/cert\.pem$/.test(certificate || "")) throw new Error("LOCAL_TEST_CERT_REQUIRED");
const ca = readFileSync(certificate);
const control = "synthetic-local-only-control-key-0000000000000000000000000000";
const secret = "synthetic-local-only-grant-key-000000000000000000000000000000";
const call = (path, method = "GET", body, headers = {}) => new Promise((resolve, reject) => {
  const req = request({ hostname: "127.0.0.1", port: 28744, path, method, ca,
    headers: { ...headers, ...(body ? { "content-length": Buffer.byteLength(body) } : {}) }, timeout: 5000 }, res => {
    const chunks = []; res.on("data", chunk => chunks.push(chunk));
    res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
  });
  req.on("error", reject); req.on("timeout", () => req.destroy(new Error("LOCAL_TEST_TIMEOUT"))); req.end(body);
});
const operator = (path, body) => call(`/control/${path}`, body === undefined ? "GET" : "POST",
  body === undefined ? undefined : JSON.stringify(body), { authorization: `Bearer ${control}` });
let ready = false;
for (let i = 0; i < 20; i++) {
  try { if ((await operator("status")).status === 200) { ready = true; break; } } catch { /* bounded startup */ }
  await new Promise(resolve => setTimeout(resolve, 200));
}
assert(ready, "LOCAL_RUNTIME_NOT_READY");
assert.equal((await operator("prepare", {})).status, 200, "LOCAL_PREPARATION");
const code = randomBytes(32).toString("base64url");
const cookie = `__Host-DOCH1QA=${randomBytes(32).toString("base64url")}`;
let done = false, active = true;
const polling = (async () => {
  while (!done) {
    const result = await operator("poll"); if (result.status !== 200) break;
    for (const job of JSON.parse(result.body)) {
      const grant = issueGatewayPlaybackGrant({ gateway_id: scope.gatewayId, observer_site_id: scope.siteId,
        camera_source_id: scope.sourceId, gateway_stream_id: scope.streamId }, secret);
      const allowed = active && (job.type === "authenticate" ? job.cookie === cookie : job.code === code);
      await operator("respond", { id: job.id, result: allowed ? { cookie, principal: { verified: true,
        active: true, viewerId: scope.viewerId, environment: "LOCAL_SUPABASE", sessionId: "synthetic-runtime-session",
        deviceId: "synthetic-runtime-client" }, grant, grantExpires: Date.now() + 45000 } : {} });
    }
    await new Promise(resolve => setTimeout(resolve, 20));
  }
})();
try {
  const login = await call("/session", "POST", `code=${code}`, { origin: "https://127.0.0.1:28744" });
  assert.equal(login.status, 200, "LOCAL_SYNTHETIC_BINDING");
  const read = path => call(path, "GET", undefined, { cookie });
  const playlist = await read("/ch1/index.m3u8"); assert.equal(playlist.status, 200, "LOCAL_PLAYLIST");
  const path = playlist.body.toString().split("\n").find(x => x.startsWith("/ch1/segment-"));
  const segment = await read(path); assert.equal(segment.status, 200, "LOCAL_SEGMENT");
  assert.equal(segment.body.length, 48316);
  active = false; const revoked = await read(path); assert.equal(revoked.status, 403, "LOCAL_REVOKED_PRINCIPAL");
  done = true; await polling;
  const state = JSON.parse((await operator("status")).body);
  const cleanup = await operator("revoke", {}); assert.equal(cleanup.status, 200);
  console.log(JSON.stringify({ environment: "LOCAL_WORKERD_SYNTHETIC_ONLY_NOT_IPHONE", tlsVerified: true,
    login: login.status, playlist: playlist.status, segment: segment.status, syntheticSegmentBytes: segment.body.length,
    revokedPrincipal: revoked.status, edgeResponseBytes: state.bytes, media: state.media,
    cleanup: cleanup.status, externalMediaBytes: 0 }));
} finally { done = true; await polling; }
