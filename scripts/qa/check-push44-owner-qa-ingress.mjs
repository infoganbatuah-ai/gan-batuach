import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { allowedQaRequest, createQaProxy, safeQaRedirect } from "./push44-owner-qa-proxy.mjs";

for (const path of [
  "/digital-observer", "/digital-observer/login", "/digital-observer/dashboard",
  "/digital-observer/sites", "/_next/static/chunks/test.js",
  "/_next/static/chunks/%5Bturbopack%5D_browser_dev_hmr-client.js", "/api/development/version",
  "/api/digital-observer/mobile/runtime", "/api/digital-observer/cameras"
]) assert.equal(allowedQaRequest("GET", path), true, path);

for (const [method, path] of [
  ["GET", "/"], ["GET", "/api/health"], ["GET", "/api/auth/admin"],
  ["POST", "/api/digital-observer/camera-actions"], ["POST", "/api/digital-observer/onboarding"],
  ["GET", "/api/digital-observer/event-clips/123/media"], ["GET", "/api/digital-observer/admin/fleet"],
  ["GET", "/api/digital-observer/external/v1/sites"], ["GET", "/api/digital-observer/provider-callbacks"],
  ["GET", "/api/digital-observer/payment-provider-callbacks"], ["GET", "/rest/v1/profiles"],
  ["GET", "/auth/v1/settings"], ["GET", "/_next/image?url=http://127.0.0.1"],
  ["GET", "//internal.invalid/api"], ["GET", "/digital-observer/%2f../api"],
  ["GET", "/_next/static/%2fapi/health"], ["GET", "/_next/static/%252fapi/health"],
  ["DELETE", "/digital-observer/cameras"], ["POST", "/digital-observer/dashboard"]
]) assert.equal(allowedQaRequest(method, path), false, `${method} ${path}`);

assert.equal(allowedQaRequest("POST", "/api/digital-observer/auth/login"), true);
assert.equal(allowedQaRequest("POST", "/api/auth/logout"), true);
assert.equal(safeQaRedirect("https://localhost:3000/digital-observer/dashboard", "owner-qa.trycloudflare.com"), "/digital-observer/dashboard");
assert.equal(safeQaRedirect("http://127.0.0.1:3000/digital-observer/login?error=invalid_login", "owner-qa.trycloudflare.com"), "/digital-observer/login?error=invalid_login");
assert.equal(safeQaRedirect("https://evil.example/digital-observer/dashboard", "owner-qa.trycloudflare.com"), null);
assert.equal(safeQaRedirect("http://owner-qa.trycloudflare.com/digital-observer/dashboard", "owner-qa.trycloudflare.com"), null);
assert.equal(safeQaRedirect("https://localhost:3000/api/health", "owner-qa.trycloudflare.com"), null);

const upstream = createServer((_request, response) => {
  if (_request.url === "/digital-observer/redirect-test") {
    response.writeHead(303, { location: "https://localhost:3000/digital-observer/dashboard", "set-cookie": "qa_test=1; HttpOnly; SameSite=Lax" });
    response.end();
    return;
  }
  response.writeHead(200, { "content-type": "text/plain" });
  response.end("isolated-qa-origin");
});
await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
const proxy = createQaProxy({ upstream: `http://127.0.0.1:${upstream.address().port}` });
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
try {
  const base = `http://127.0.0.1:${proxy.address().port}`;
  const product = await fetch(`${base}/digital-observer/login`);
  assert.equal(product.status, 200);
  assert.equal(await product.text(), "isolated-qa-origin");
  const redirect = await fetch(`${base}/digital-observer/redirect-test`, {
    redirect: "manual", headers: { host: "owner-qa.trycloudflare.com" }
  });
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("location"), "/digital-observer/dashboard");
  assert.match(redirect.headers.get("set-cookie") ?? "", /; Secure/);
  for (const path of ["/api/health", "/rest/v1/profiles", "/api/digital-observer/event-clips/x/media"]) {
    const denied = await fetch(`${base}${path}`);
    assert.equal(denied.status, 404, path);
    assert.equal(denied.headers.get("cache-control"), "no-store");
    assert.equal(denied.headers.get("x-robots-tag"), "noindex, nofollow");
  }
  const mutation = await fetch(`${base}/api/digital-observer/camera-actions`, { method: "POST" });
  assert.equal(mutation.status, 404);
} finally {
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
}

const temp = mkdtempSync(join(tmpdir(), "push44-qa-config-"));
const source = new URL("../../ios/qa-personal-team/capacitor.config.json", import.meta.url);
const target = join(temp, "capacitor.config.json");
const prepare = new URL("./prepare-push44-iphone-qa-config.mjs", import.meta.url);
execFileSync(process.execPath, [prepare.pathname, source.pathname, target,
  "https://owner-qa.trycloudflare.com/digital-observer"], { stdio: "pipe" });
const config = JSON.parse(readFileSync(target, "utf8"));
assert.equal(config.server.url, "https://owner-qa.trycloudflare.com/digital-observer");
assert.equal(config.server.cleartext, false);
assert.deepEqual(config.server.allowNavigation, [
  "owner-qa.trycloudflare.com", "login.trycloudflare.com", "cf-cloudflare-quicktunnels.cloudflareaccess.com"
]);
assert(!config.packageClassList.includes("PushNotificationsPlugin"));
for (const invalid of ["http://owner-qa.trycloudflare.com/digital-observer",
  "https://ganbatuach.com/digital-observer", "https://owner-qa.trycloudflare.com/",
  "https://owner-qa.trycloudflare.com/digital-observer?token=bad"]) {
  assert.throws(() => execFileSync(process.execPath, [prepare.pathname, source.pathname, target, invalid], { stdio: "pipe" }));
}

const runtime = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
assert.match(runtime, /Capacitor\.isPluginAvailable\("PushNotifications"\)/);
assert.match(runtime, /Push כבוי בבניית QA זו/);
const xcode = readFileSync(new URL("../../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8");
assert.match(xcode, /PUSH44_QA_HTTPS_URL/);
const configProbe = "const config = (await import('./next.config.ts')).default; console.log(JSON.stringify(config.allowedDevOrigins ?? []))";
const devConfig = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "development", PUSH44_QA_DEV_ORIGIN_HOST: "owner-qa.trycloudflare.com" }
}).toString().trim();
assert.deepEqual(JSON.parse(devConfig), ["owner-qa.trycloudflare.com"]);
const prodConfig = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "production", PUSH44_QA_DEV_ORIGIN_HOST: "owner-qa.trycloudflare.com" }
}).toString().trim();
assert.deepEqual(JSON.parse(prodConfig), []);
assert.throws(() => execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "development", PUSH44_QA_DEV_ORIGIN_HOST: "*.trycloudflare.com" },
  stdio: "pipe"
}));
console.log("PUSH 44 owner-only QA ingress contracts PASS: limited routes, bounded config, no media/API mutation/Production path, QA Push disabled");
