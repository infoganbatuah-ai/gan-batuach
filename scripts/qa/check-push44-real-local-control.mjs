// Opt-in, local-only qualification against the existing Development Auth and
// actual Next.js process. Never run this in CI or with Production credentials.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readFileSync, mkdtempSync, realpathSync, rmSync, statSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { join, isAbsolute, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { ACCESS_ISSUER, ACCESS_OWNER, CONTROL_HOST,
  createPush44AccessVerifier, createPush44ControlLedger, createPush44QaControlIngress
} from "../../services/video-gateway/push44-qa-control-ingress.mjs";

const credentialPath = process.env.PUSH44_QA_DEV_CREDENTIAL_FILE;
const environmentPath = process.env.PUSH44_QA_DEV_ENV_FILE;
if (!credentialPath || !environmentPath || !isAbsolute(credentialPath) ||
  !isAbsolute(environmentPath) || process.env.VERCEL ||
  [credentialPath, environmentPath].some(path => {
    const metadata = statSync(path);
    return !metadata.isFile() || metadata.uid !== process.getuid() ||
      (metadata.mode & 0o077) !== 0;
  }))
  throw new Error("Protected Development inputs required");
const environment = parseEnv(readFileSync(environmentPath, "utf8"));
const backend = new URL(environment.NEXT_PUBLIC_SUPABASE_URL ?? "");
if (backend.protocol !== "http:" || backend.hostname !== "127.0.0.1" ||
  backend.port !== "55421" || backend.pathname !== "/" ||
  !environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  throw new Error("Original local Development backend required");
const credentialText = readFileSync(credentialPath, "utf8");
const email = /^Email:\s*(\S+)\s*$/m.exec(credentialText)?.[1];
const password = /^Password:\s*(\S+)\s*$/m.exec(credentialText)?.[1];
if (email !== "owner-iphone@integration.qa.invalid" || !password)
  throw new Error("Existing dedicated QA identity required");

const health = await fetch(`${backend.origin}/auth/v1/health`, {
  headers: { apikey: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  signal: AbortSignal.timeout(4_000)
});
assert.equal(health.status, 200, "original Development Auth health");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const proxyKey = randomBytes(48).toString("base64url");
const portOccupied = await new Promise(resolve => {
  const socket = createConnection({ host: "127.0.0.1", port: 3001 });
  socket.once("connect", () => { socket.destroy(); resolve(true); });
  socket.once("error", () => resolve(false));
  socket.setTimeout(1000, () => { socket.destroy(); resolve(true); });
});
if (portOccupied) throw new Error("Port 3001 is already owned by another process");
const child = spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3001"],
  { cwd: root, stdio: "ignore", env: {
    PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR,
    NODE_ENV: "development", APP_ENV: "local", NEXT_PUBLIC_APP_ENV: "local",
    INTEGRATION_DEVELOPMENT: "true", INTEGRATION_BACKEND: "LOCAL_SUPABASE",
    NEXT_PUBLIC_SUPABASE_URL: backend.origin + "/",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    PUSH44_QA_CONTROL_ONLY: "1", PUSH44_QA_PROXY_KEY: proxyKey,
    NEXT_TELEMETRY_DISABLED: "1"
  } });
const waitForNext = async () => {
  const until = Date.now() + 30_000;
  while (Date.now() < until && child.exitCode === null) {
    try {
      const response = await fetch("http://127.0.0.1:3001/digital-observer/login?next=%2Fdigital-observer%2Fqa-device-enrollment", {
        headers: { host: CONTROL_HOST, "x-forwarded-proto": "https",
          "x-forwarded-host": CONTROL_HOST }, redirect: "manual",
        signal: AbortSignal.timeout(4_000)
      });
      if (response.status === 200) return;
    } catch { /* wait only for our local child */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error("Actual local Next.js did not become ready");
};

const { publicKey, privateKey } = await generateKeyPair("RS256");
const jwk = { ...await exportJWK(publicKey), kid: "local-qualification", alg: "RS256", use: "sig" };
const audience = randomBytes(32).toString("hex");
const now = Date.now();
const deadline = now + 5 * 60_000;
const assertion = await new SignJWT({ sub: "local-qualification-owner", email: ACCESS_OWNER })
  .setProtectedHeader({ alg: "RS256", kid: "local-qualification" })
  .setIssuer(ACCESS_ISSUER).setAudience(audience)
  .setIssuedAt(Math.floor(now / 1000)).setExpirationTime(Math.floor(now / 1000) + 240)
  .sign(privateKey);
const directory = mkdtempSync(join(realpathSync(tmpdir()), "push44-real-control-"));
const database = new DatabaseSync(":memory:");
const socketPath = join(directory, "control.sock");
const ledger = createPush44ControlLedger(database, deadline);
const ingress = createPush44QaControlIngress({
  proxyKey, socketPath,
  developmentBackendUrl: backend.origin + "/", deadline,
  ledger,
  verifyAccess: createPush44AccessVerifier({ audience,
    keySet: createLocalJWKSet({ keys: [jwk] }) })
});

function call(path, { method = "GET", cookie, body, contentType } = {}) {
  return new Promise((resolve, reject) => {
    const headers = { host: CONTROL_HOST, "x-forwarded-proto": "https",
      "cf-access-jwt-assertion": assertion };
    if (cookie) headers.cookie = cookie;
    if (method === "POST") {
      headers.origin = `https://${CONTROL_HOST}`;
      headers["content-type"] = contentType;
    }
    const request = httpRequest({ socketPath, path, method, headers }, response => {
      const chunks = [];
      response.on("data", chunk => chunks.push(chunk));
      response.on("end", () => resolve({ status: response.statusCode,
        headers: response.headers, body: Buffer.concat(chunks).toString("utf8") }));
    });
    request.on("error", reject);
    request.end(body);
  });
}

try {
  await waitForNext();
  await ingress.listen();
  const enrollmentPath = "/digital-observer/qa-device-enrollment";
  const loginPath = `/digital-observer/login?next=${encodeURIComponent(enrollmentPath)}`;
  const anonymous = await call(enrollmentPath);
  assert.equal(anonymous.status, 307);
  assert.equal(new URL(anonymous.headers.location).hostname, CONTROL_HOST);
  const page = await call(loginPath);
  assert.equal(page.status, 200);
  assert.match(page.headers["content-type"], /^text\/html/);
  const assetPaths = [...new Set([...page.body.matchAll(/\/_next\/static\/[A-Za-z0-9_./%~-]+\.(?:js|css)/g)]
    .map(match => match[0]))];
  assert.ok(assetPaths.length > 0 && assetPaths.length < 50,
    "real login HTML must reference a bounded static asset set");
  for (const path of assetPaths) {
    const asset = await call(path);
    assert.equal(asset.status, 200, `real Next static asset: ${path}`);
    assert.equal(asset.headers["set-cookie"], undefined);
  }
  const form = new URLSearchParams({ email, password, auth_source: "observer",
    next: enrollmentPath, observer_account_type: "home" });
  const login = await call("/api/digital-observer/auth/login", {
    method: "POST", body: form.toString(), contentType: "application/x-www-form-urlencoded"
  });
  assert.equal(login.status, 303, "real Supabase login must redirect");
  assert.equal(login.headers.location, `https://${CONTROL_HOST}${enrollmentPath}`);
  const setCookies = login.headers["set-cookie"] ?? [];
  assert.ok(setCookies.some(value => /^sb-/.test(value)), "real Development session cookie");
  for (const value of setCookies) assert.match(value, /; Path=\/; Secure; HttpOnly; SameSite=Lax$/);
  const cookie = setCookies.map(value => value.split(";", 1)[0]).join("; ");
  const authenticated = await call(enrollmentPath, { cookie });
  assert.equal(authenticated.status, 200, "real authenticated enrollment screen");
  assert.match(authenticated.body, /רישום מכשיר QA/);
  const direct = await fetch(`http://127.0.0.1:3001${enrollmentPath}`, {
    headers: { host: CONTROL_HOST, "x-forwarded-host": CONTROL_HOST,
      "x-forwarded-proto": "https", cookie }, redirect: "manual",
    signal: AbortSignal.timeout(4_000)
  });
  assert.match(await direct.text(), /id="__next-page-redirect"/,
    "direct local Next access cannot display the enrollment screen");
  const denied = await call("/api/digital-observer/qa-device", {
    method: "POST", cookie, contentType: "application/json",
    body: JSON.stringify({ action: "status", publicKey: "invalid", enrollmentRequestId: "invalid" })
  });
  assert.equal(denied.status, 403, "no pending device or approval is created");
  assert.equal((await call("/digital-observer/dashboard", { cookie })).status, 403);
  assert.equal((await call("/api/digital-observer/media/playlist.m3u8", { cookie })).status, 403);
  assert.equal((await call(enrollmentPath, { cookie: "sb-forged=invalid" })).status, 307);
  console.log("PASS: real local Auth, Next login/page/asset, scoped cookies, protected enrollment screen and denial controls");
  const stats = ledger.stats();
  console.log(`Local proxy accounting: ${stats.attempts} attempts (${assetPaths.length} Next assets), ${stats.bytes} reserved+reply bytes, 5-minute test deadline`);
  console.log("NOT PROVEN: physical key request, pending enrollment, Cloudflare delivery and iPhone browser return");
} finally {
  await ingress.close();
  database.close();
  rmSync(directory, { recursive: true });
  child.kill("SIGTERM");
}
