import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
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
const qaHost = "qa-iphone-contract.ganbatuach.com";
const ownerToken = "a".repeat(64);
assert.throws(() => createQaProxy(), /temporary owner token/);
const proxy = createQaProxy({ upstream: `http://127.0.0.1:${upstream.address().port}`, qaHost, ownerToken });
await new Promise((resolve) => proxy.listen(0, "127.0.0.1", resolve));
function requestQa(path, { method = "GET", headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const call = request({ hostname: "127.0.0.1", port: proxy.address().port, path, method,
      headers: { host: qaHost, ...headers } }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    call.on("error", reject);
    call.end();
  });
}
try {
  const unauthenticated = await requestQa("/digital-observer/login");
  assert.equal(unauthenticated.status, 401);
  const forgedHost = await requestQa("/digital-observer/login", { headers: { host: "attacker.example" } });
  assert.equal(forgedHost.status, 421);
  const badBootstrap = await requestQa(`/__push44/bootstrap?t=${"b".repeat(64)}`);
  assert.equal(badBootstrap.status, 401);
  const bootstrap = await requestQa(`/__push44/bootstrap?t=${ownerToken}`);
  assert.equal(bootstrap.status, 303);
  assert.equal(bootstrap.headers.location, "/digital-observer/login");
  assert.match(bootstrap.headers["set-cookie"]?.[0] ?? "", /HttpOnly; Secure; SameSite=Lax/);
  const ownerCookie = bootstrap.headers["set-cookie"]?.[0]?.split(";")[0];
  const authorizedHeaders = { host: qaHost, cookie: ownerCookie };
  const product = await requestQa("/digital-observer/login", { headers: authorizedHeaders });
  assert.equal(product.status, 200);
  assert.equal(product.body, "isolated-qa-origin");
  const redirect = await requestQa("/digital-observer/redirect-test", { headers: authorizedHeaders });
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.location, "/digital-observer/dashboard");
  assert.match(redirect.headers["set-cookie"]?.[0] ?? "", /; Secure/);
  for (const path of ["/api/health", "/rest/v1/profiles", "/api/digital-observer/event-clips/x/media"]) {
    const denied = await requestQa(path, { headers: authorizedHeaders });
    assert.equal(denied.status, 404, path);
    assert.equal(denied.headers["cache-control"], "no-store");
    assert.equal(denied.headers["x-robots-tag"], "noindex, nofollow");
  }
  const mutation = await requestQa("/api/digital-observer/camera-actions", {
    method: "POST", headers: authorizedHeaders
  });
  assert.equal(mutation.status, 404);
} finally {
  await new Promise((resolve) => proxy.close(resolve));
  await new Promise((resolve) => upstream.close(resolve));
}

const temp = mkdtempSync(join(tmpdir(), "push44-qa-config-"));
const source = new URL("../../ios/qa-personal-team/capacitor.config.json", import.meta.url);
const target = join(temp, "capacitor.config.json");
const prepare = new URL("./prepare-push44-iphone-qa-config.mjs", import.meta.url);
const tokenFile = join(temp, "owner-token");
writeFileSync(tokenFile, ownerToken, { mode: 0o600 });
const prepareEnv = { ...process.env, PUSH44_QA_HOST: qaHost, PUSH44_QA_TOKEN_FILE: tokenFile };
execFileSync(process.execPath, [prepare.pathname, source.pathname, target,
  `https://${qaHost}/digital-observer`], { stdio: "pipe", env: prepareEnv });
const config = JSON.parse(readFileSync(target, "utf8"));
assert.equal(config.server.url, `https://${qaHost}/__push44/bootstrap?t=${ownerToken}`);
assert.equal(config.server.cleartext, false);
assert.deepEqual(config.server.allowNavigation, [qaHost]);
assert(!config.packageClassList.includes("PushNotificationsPlugin"));
for (const invalid of [`http://${qaHost}/digital-observer`,
  "https://ganbatuach.com/digital-observer", `https://${qaHost}/`,
  `https://${qaHost}/digital-observer?token=bad`]) {
  assert.throws(() => execFileSync(process.execPath, [prepare.pathname, source.pathname, target, invalid], {
    stdio: "pipe", env: prepareEnv
  }));
}

const runtime = readFileSync(new URL("../../components/digital-observer/observer-mobile-runtime.tsx", import.meta.url), "utf8");
assert.match(runtime, /Capacitor\.isPluginAvailable\("PushNotifications"\)/);
assert.match(runtime, /Push כבוי בבניית QA זו/);
const xcode = readFileSync(new URL("../../ios/App/App.xcodeproj/project.pbxproj", import.meta.url), "utf8");
assert.match(xcode, /PUSH44_QA_HTTPS_URL/);
const configProbe = "const config = (await import('./next.config.ts')).default; console.log(JSON.stringify(config.allowedDevOrigins ?? []))";
const devConfig = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "development", PUSH44_QA_DEV_ORIGIN_HOST: qaHost }
}).toString().trim();
assert.deepEqual(JSON.parse(devConfig), [qaHost]);
const prodConfig = execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "production", PUSH44_QA_DEV_ORIGIN_HOST: qaHost }
}).toString().trim();
assert.deepEqual(JSON.parse(prodConfig), []);
assert.throws(() => execFileSync(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", configProbe], {
  cwd: new URL("../../", import.meta.url),
  env: { ...process.env, NODE_ENV: "development", PUSH44_QA_DEV_ORIGIN_HOST: "*.trycloudflare.com" },
  stdio: "pipe"
}));
console.log("PUSH 44 owner-only QA ingress contracts PASS: limited routes, bounded config, no media/API mutation/Production path, QA Push disabled");
