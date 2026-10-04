import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { request as secureRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { classifyPush38tIngressResponse, createPush38tIngress,
  push38tIngressAllows, push38tIngressRequestLimit
} from "../../services/video-gateway/push38t-ota-ingress.mjs";

const allowed = [
  ["POST", "/api/digital-observer/gateway-enrollment"],
  ["GET", "/api/video-gateway/edge-updates"],
  ["POST", "/api/video-gateway/edge-updates"],
  ["POST", "/api/video-gateway/edge-updates/download"],
  ["POST", "/api/video-gateway/home-qa-legacy-download"],
  ["POST", "/api/video-gateway/cloud-discovery"],
  ["POST", "/api/video-gateway/device-heartbeat"],
  ["POST", "/api/video-gateway/cloud-learning"],
  ["POST", "/api/video-gateway/playback-grant"],
  ["POST", "/api/video-gateway/camera-actions"],
  ["GET", "/api/video-gateway/event-manifest"],
  ["POST", "/api/video-gateway/cloud-events"],
  ["POST", "/api/video-gateway/cloud-event-media"],
  ["POST", "/api/digital-observer/dvr-gateway"],
  ["GET", "/push38/remote-playback"],
  ["POST", "/push38/remote-playback/result"]
];
for (const [method, path] of allowed) assert.equal(push38tIngressAllows(method, path), true);
for (const path of ["/", "/dashboard", "/api/admin/tasks", "/api/digital-observer/gateway-enrollment/other",
  "/api/video-gateway/device-heartbeat", "/supabase", "/_next/webpack-hmr"])
  assert.equal(push38tIngressAllows("GET", path), false);
assert.equal(classifyPush38tIngressResponse("GET", "/api/video-gateway/edge-updates", 200,
  Buffer.from('{"data":{"manifest":{"release_id":"qa-release-safe"}}}')), "MANIFEST:qa-release-safe");
assert.equal(classifyPush38tIngressResponse("GET", "/api/video-gateway/edge-updates", 200,
  Buffer.from('{"data":{"manifest":null,"reason":"NO_ELIGIBLE_RELEASE"}}')), "NO_MANIFEST:NO_ELIGIBLE_RELEASE");
assert.equal(classifyPush38tIngressResponse("POST", "/api/video-gateway/edge-updates", 200,
  Buffer.from('{"data":{"accepted":true}}')), null);
assert.equal(push38tIngressRequestLimit("POST", "/api/video-gateway/cloud-discovery"), 64 * 1024);
assert.equal(push38tIngressRequestLimit("POST", "/api/video-gateway/device-heartbeat"), 8192);
assert.equal(push38tIngressRequestLimit("POST", "/api/video-gateway/cloud-event-media"),
  8 * 1024 * 1024 + 64 * 1024);
assert.equal(push38tIngressRequestLimit("GET", "/api/video-gateway/cloud-discovery"), 8192);
const origin = createServer((request, response) => response.writeHead(401, { "content-type": "application/json",
  "set-cookie": "should-not-forward=1" }).end(JSON.stringify({ denied: true, path: request.url })));
await new Promise(resolve => origin.listen(0, "127.0.0.1", resolve));
const audit = [];
const remoteResults = [];
const remoteQualificationDeadline = Date.now() + 60_000;
let qualificationNow = remoteQualificationDeadline - 1;
const remoteSession = { session_id: "short-session-id-1234", expires_at_ms: remoteQualificationDeadline,
  config: { t: "header.payload.signature", r: "qualification-result-token-00000000000000000000",
    s: "00000000-0000-4000-8000-000000000001", c: [] } };
const proxy = createPush38tIngress({ origin: `http://127.0.0.1:${origin.address().port}`,
  remoteResultToken: "qualification-result-token-00000000000000000000",
  remoteResultExpiresAt: remoteQualificationDeadline,
  remoteSession,
  now: () => qualificationNow,
  onRemoteResult: result => remoteResults.push(result),
  onAudit: event => audit.push(event) });
await new Promise(resolve => proxy.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${proxy.address().port}`;
  for (const path of ["/dashboard", "/api/admin/tasks", "/api/video-gateway/device-heartbeat", "/supabase"])
    assert.equal((await fetch(base + path)).status, 404);
  const accepted = await fetch(base + "/api/video-gateway/edge-updates?channel=HOME_QA");
  assert.equal(accepted.status, 401);
  assert.equal(accepted.headers.has("set-cookie"), false);
  const denied = await fetch(base + "/api/digital-observer/gateway-enrollment", { method: "POST",
    headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(denied.status, 401);
  const productDenied = await fetch(base + "/api/digital-observer/dvr-gateway", { method: "POST",
    headers: { "content-type": "application/json" }, body: "{}" });
  assert.equal(productDenied.status, 401);
  assert.equal((await fetch(base + "/push38/remote-playback")).status, 404);
  assert.equal((await fetch(base + "/push38/remote-playback?session=wrong-session-id-1")).status, 404);
  const page = await fetch(base + `/push38/remote-playback?session=${remoteSession.session_id}`);
  assert.equal(page.status, 200);
  assert.equal((await page.text()).includes("accessToken"), true);
  const resultPayload = { protocol: "observer-push38-remote-client-proof-v1",
    started_at: "2026-10-03T00:00:00.000Z", completed_at: "2026-10-03T00:00:12.000Z",
    client_class: "OWNER_PHONE_BROWSER", edge_software_installed: false, pass: true,
    results: [{ label: "DVR CH1", kind: "DVR", authorization_status: 200,
      authorization_expected: true, remote_url_https: true, localhost_absent: true,
      media: { hls_https: true, localhost_absent: true, moving: true, width: 1280, height: 720 } }] };
  assert.equal((await fetch(base + "/push38/remote-playback/result", { method: "POST",
    headers: { "content-type": "application/json", "x-push38-result-token": "wrong-token-000000000000000000000000" },
    body: JSON.stringify(resultPayload) })).status, 401);
  assert.equal((await fetch(base + "/push38/remote-playback/result", { method: "POST",
    headers: { "content-type": "application/json",
      "x-push38-result-token": "qualification-result-token-00000000000000000000" },
    body: JSON.stringify(resultPayload) })).status, 202);
  assert.equal(remoteResults.length, 1);
  assert.equal(remoteResults[0].pass, true);
  const failedPayload = { ...resultPayload, pass: false, error: "REMOTE_CLIENT_FAILED", results: [] };
  assert.equal((await fetch(base + "/push38/remote-playback/result", { method: "POST",
    headers: { "content-type": "application/json",
      "x-push38-result-token": "qualification-result-token-00000000000000000000" },
    body: JSON.stringify(failedPayload) })).status, 202);
  assert.equal(remoteResults.length, 2);
  assert.equal(remoteResults[1].pass, false);
  qualificationNow = remoteQualificationDeadline + 1;
  assert.equal((await fetch(base + `/push38/remote-playback?session=${remoteSession.session_id}`)).status, 404);
  const deviceGrant = await fetch(base + "/api/video-gateway/playback-grant", { method: "POST",
    headers: { "content-type": "application/json", "x-video-gateway-device-token": "test-device-token" },
    body: "{}" });
  assert.equal(deviceGrant.status, 401);
  assert.equal((await fetch(base + "/api/digital-observer/dvr-gateway", { method: "POST",
    headers: { "content-type": "application/json" }, body: "{}" })).status, 404);
  assert.equal((await fetch(base + "/push38/remote-playback/result", { method: "POST",
    headers: { "content-type": "application/json",
      "x-push38-result-token": "qualification-result-token-00000000000000000000" },
    body: JSON.stringify(resultPayload) })).status, 404);
  for (const path of ["/api/video-gateway/cloud-discovery", "/api/video-gateway/device-heartbeat",
    "/api/video-gateway/cloud-learning", "/api/video-gateway/camera-actions", "/api/video-gateway/cloud-events"]) {
    const deviceRequest = await fetch(base + path, { method: "POST", headers: {
      "content-type": "application/json", "x-video-gateway-device-token": "test-device-token",
      "x-video-gateway-id": "test-gateway", "x-video-gateway-timestamp": "2026-10-01T00:00:00.000Z",
      "x-video-gateway-nonce": "test-nonce"
    }, body: "{}" });
    assert.equal(deviceRequest.status, 401);
  }
  assert.equal((await fetch(base + "/api/video-gateway/edge-updates/download?object=other", {
    method: "POST", body: "{}" })).status, 404);
  assert.equal(audit.some(event => event.pathname === "/api/video-gateway/edge-updates" &&
    event.outcome === "FORWARDED" && event.status === 401), true);
  assert.equal(audit.some(event => event.pathname === "/api/video-gateway/edge-updates/download" &&
    event.outcome === "DENIED" && event.status === 404), true);
  assert.equal(audit.filter(event => ["/api/video-gateway/cloud-discovery",
    "/api/video-gateway/device-heartbeat", "/api/video-gateway/cloud-learning",
    "/api/video-gateway/camera-actions", "/api/video-gateway/cloud-events"].includes(event.pathname) &&
    event.outcome === "FORWARDED" && event.status === 401).length, 5);
  assert.equal(audit.some(event => event.pathname === "/api/video-gateway/playback-grant" &&
    event.outcome === "FORWARDED" && event.status === 401), true);
  console.log(JSON.stringify({ status: "PASS", allowedRoutes: allowed.length,
    dashboard: "DENY", admin: "DENY", unrelatedApi: "DENY", supabase: "DENY", anonymousPrivileged: "DENY" }));
} finally {
  await new Promise(resolve => proxy.close(resolve));
  await new Promise(resolve => origin.close(resolve));
}

const tlsRoot = mkdtempSync(join(tmpdir(), "observer-p38t-https-"));
try {
  const keyPath = join(tlsRoot, "qa.key"), certPath = join(tlsRoot, "qa.crt");
  execFileSync("openssl", ["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "1",
    "-keyout", keyPath, "-out", certPath, "-subj", "/CN=localhost",
    "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore", timeout: 15_000 });
  chmodSync(keyPath, 0o644);
  assert.throws(() => createPush38tIngress({ tls: { keyPath, certPath } }), /QA_INGRESS_TLS_MATERIAL_UNSAFE/);
  chmodSync(keyPath, 0o600);
  const upstream = createServer((_request, response) => response.writeHead(401).end());
  await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
  const secure = createPush38tIngress({ origin: `http://127.0.0.1:${upstream.address().port}`,
    tls: { keyPath, certPath } });
  await new Promise(resolve => secure.listen(0, "127.0.0.1", resolve));
  const probe = path => new Promise((resolve, reject) => {
    const request = secureRequest({ hostname: "127.0.0.1", port: secure.address().port,
      path, method: "GET", ca: readFileSync(certPath), rejectUnauthorized: true }, response => {
      response.resume(); response.on("end", () => resolve(response.statusCode));
    });
    request.on("error", reject); request.end();
  });
  try {
    assert.equal(await probe("/api/video-gateway/edge-updates?channel=HOME_QA"), 401);
    for (const path of ["/dashboard", "/api/admin/tasks", "/supabase", "/_next/webpack-hmr"])
      assert.equal(await probe(path), 404);
    console.log(JSON.stringify({ status: "PASS", transport: "HTTPS_TLS_VERIFIED",
      bind: "LOOPBACK", publicSurface: "NONE", unauthorizedPaths: 4 }));
  } finally {
    await new Promise(resolve => secure.close(resolve));
    await new Promise(resolve => upstream.close(resolve));
  }
} finally { rmSync(tlsRoot, { recursive: true, force: true }); }
