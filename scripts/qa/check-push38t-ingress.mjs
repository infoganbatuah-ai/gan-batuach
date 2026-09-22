import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { request as secureRequest } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPush38tIngress, push38tIngressAllows } from "../../services/video-gateway/push38t-ota-ingress.mjs";

const allowed = [
  ["POST", "/api/digital-observer/gateway-enrollment"],
  ["GET", "/api/video-gateway/edge-updates"],
  ["POST", "/api/video-gateway/edge-updates"],
  ["POST", "/api/video-gateway/edge-updates/download"],
  ["POST", "/api/video-gateway/home-qa-legacy-download"]
];
for (const [method, path] of allowed) assert.equal(push38tIngressAllows(method, path), true);
for (const path of ["/", "/dashboard", "/api/admin/tasks", "/api/digital-observer/gateway-enrollment/other",
  "/api/video-gateway/device-heartbeat", "/supabase", "/_next/webpack-hmr"])
  assert.equal(push38tIngressAllows("GET", path), false);
const origin = createServer((request, response) => response.writeHead(401, { "content-type": "application/json",
  "set-cookie": "should-not-forward=1" }).end(JSON.stringify({ denied: true, path: request.url })));
await new Promise(resolve => origin.listen(0, "127.0.0.1", resolve));
const audit = [];
const proxy = createPush38tIngress({ origin: `http://127.0.0.1:${origin.address().port}`,
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
  assert.equal((await fetch(base + "/api/video-gateway/edge-updates/download?object=other", {
    method: "POST", body: "{}" })).status, 404);
  assert.equal(audit.some(event => event.pathname === "/api/video-gateway/edge-updates" &&
    event.outcome === "FORWARDED" && event.status === 401), true);
  assert.equal(audit.some(event => event.pathname === "/api/video-gateway/edge-updates/download" &&
    event.outcome === "DENIED" && event.status === 404), true);
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
