import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPush38tIngress, push38tIngressAllows } from "../../services/video-gateway/push38t-ota-ingress.mjs";

const allowed = [
  ["POST", "/api/digital-observer/gateway-enrollment"],
  ["GET", "/api/video-gateway/edge-updates"],
  ["POST", "/api/video-gateway/edge-updates/download"]
];
for (const [method, path] of allowed) assert.equal(push38tIngressAllows(method, path), true);
for (const path of ["/", "/dashboard", "/api/admin/tasks", "/api/digital-observer/gateway-enrollment/other",
  "/api/video-gateway/device-heartbeat", "/supabase", "/_next/webpack-hmr"])
  assert.equal(push38tIngressAllows("GET", path), false);
const origin = createServer((request, response) => response.writeHead(401, { "content-type": "application/json",
  "set-cookie": "should-not-forward=1" }).end(JSON.stringify({ denied: true, path: request.url })));
await new Promise(resolve => origin.listen(0, "127.0.0.1", resolve));
const proxy = createPush38tIngress({ origin: `http://127.0.0.1:${origin.address().port}` });
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
  console.log(JSON.stringify({ status: "PASS", allowedRoutes: allowed.length,
    dashboard: "DENY", admin: "DENY", unrelatedApi: "DENY", supabase: "DENY", anonymousPrivileged: "DENY" }));
} finally {
  await new Promise(resolve => proxy.close(resolve));
  await new Promise(resolve => origin.close(resolve));
}
