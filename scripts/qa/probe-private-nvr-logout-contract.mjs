// Read-only, no-media recorder session probe. It owns one temporary login,
// records the non-secret Logout response and the response to a repeated Logout,
// and never changes recorder configuration or prints credentials/endpoints.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const option = name => process.argv.find(value =>
  value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const restrictedRoot = `${realpathSync(
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (output === resolve(".") || !output.startsWith(restrictedRoot) || existsSync(output))
  throw new Error("P38_NVR_LOGOUT_PROBE_OUTPUT_INVALID");

const service = "com.ganbatuach.video-gateway.runtime";
const keychain = args => execFileSync("/usr/bin/security",
  ["find-generic-password", "-s", service, ...args, "-w"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"] }).trim();
const profile = JSON.parse(keychain(["-a", "dvr_profile_json"]));
const password = keychain(["-a", "dvr_password"]);
const endpoint = new URL(profile.endpoint.includes("://")
  ? profile.endpoint : `http://${profile.endpoint}`);
const baseUrl = `http://${endpoint.hostname}:${Number(profile.port || 80)}`;

function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256"
    ? "sha256" : "md5").update(value, "utf8").digest("hex");
}
function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "")
    .matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}
async function boundedJson(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 16_384) throw new Error("P38_NVR_RESPONSE_TOO_LARGE");
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}
async function login() {
  const uri = "/API/Web/Login";
  const body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_QA_LOGOUT_PROBE" } });
  const common = { method: "POST", redirect: "error",
    headers: { "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest" }, body,
    signal: AbortSignal.timeout(5_000) };
  const first = await fetch(`${baseUrl}${uri}`, common);
  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  if (first.status !== 401 || !challenge.realm || !challenge.nonce)
    throw new Error("P38_NVR_DIGEST_CHALLENGE_INVALID");
  const qop = String(challenge.qop || "auth").split(",")[0].trim();
  const nc = "00000001", cnonce = randomBytes(8).toString("hex");
  const ha1 = digestHex(challenge.algorithm,
    `${profile.username}:${challenge.realm}:${password}`);
  const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
  const responseDigest = digestHex(challenge.algorithm,
    `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = [
    `Digest username="${String(profile.username).replaceAll('"', "")}"`,
    `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`,
    `uri="${uri}"`, `response="${responseDigest}"`,
    `opaque="${challenge.opaque || ""}"`, `qop=${qop}`, `nc=${nc}`,
    `cnonce="${cnonce}"`, challenge.algorithm
      ? `algorithm="${challenge.algorithm}"` : ""
  ].filter(Boolean).join(", ");
  const response = await fetch(`${baseUrl}${uri}`, { ...common,
    headers: { ...common.headers, authorization } });
  await boundedJson(response);
  const token = String(response.headers.get("x-csrftoken") || "")
    .split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "")
    .split(";")[0].trim();
  if (!response.ok || !token) throw new Error("P38_NVR_LOGIN_FAILED");
  return { token, cookie };
}
async function logout(session) {
  const response = await fetch(`${baseUrl}/API/Web/Logout`, { method: "POST",
    redirect: "error", headers: { "content-type": "application/json",
      "x-csrftoken": session.token,
      ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data: {} }),
    signal: AbortSignal.timeout(5_000) }).catch(error => ({ status: 0,
      ok: false, arrayBuffer: async () => new ArrayBuffer(0),
      transport_error: error?.code || error?.name || "FETCH_FAILED" }));
  const payload = await boundedJson(response);
  return { http_status: response.status, ok: response.ok === true,
    result: payload?.result || null,
    reason: payload?.reason || payload?.data?.reason || null,
    error_code: payload?.error_code ?? payload?.data?.error_code ?? null,
    transport_error: response.transport_error || null };
}

const startedAt = new Date().toISOString();
const session = await login();
const first = await logout(session);
const repeated = await logout(session);
const evidence = {
  protocol: "observer-push38-private-nvr-logout-contract-v1",
  started_at: startedAt,
  ended_at: new Date().toISOString(),
  read_only: true,
  media_streams_opened: 0,
  settings_changed: false,
  credentials_exposed: false,
  endpoint_fingerprint_sha256: createHash("sha256").update(baseUrl).digest("hex"),
  first,
  repeated
};
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`,
  { mode: 0o600, flag: "wx" });
chmodSync(output, 0o600);
console.log(JSON.stringify({ status: first.ok ? "PASS" : "FAIL", output,
  first, repeated }));
if (!first.ok) process.exitCode = 1;
