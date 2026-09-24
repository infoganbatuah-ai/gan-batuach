// Read-only recorder-session observation. It opens one bounded web session,
// follows the recorder UI's Login/Heartbeat contract, records only redacted
// protocol evidence, and closes its own session when the observation ends.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const durationMs = Number(option("duration-ms") || 7 * 60_000);
const intervalMs = Number(option("interval-ms") || 10_000);
const output = resolve(option("output") || ".");
const restrictedRoot = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!Number.isInteger(durationMs) || durationMs < 60_000 || durationMs > 15 * 60_000 ||
  !Number.isInteger(intervalMs) || intervalMs < 5_000 || intervalMs > 30_000 ||
  output === resolve(".") || !output.startsWith(restrictedRoot) || existsSync(output)) {
  throw new Error("P38_NVR_HEARTBEAT_OBSERVATION_ARGUMENTS_INVALID");
}

const service = "com.ganbatuach.video-gateway.runtime";
const keychain = joinArgs => execFileSync("/usr/bin/security",
  ["find-generic-password", "-s", service, ...joinArgs, "-w"],
  { encoding: "utf8", timeout: 15_000, maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"] }).trim();
const profile = JSON.parse(keychain(["-a", "dvr_profile_json"]));
const password = keychain(["-a", "dvr_password"]);
const endpoint = new URL(profile.endpoint.includes("://") ? profile.endpoint : `http://${profile.endpoint}`);
const baseUrl = `http://${endpoint.hostname}:${Number(profile.port || 80)}`;
const originFingerprint = createHash("sha256").update(baseUrl).digest("hex");
const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));

function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5")
    .update(value, "utf8").digest("hex");
}
function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "")
    .matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi)) {
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  }
  return fields;
}
function cookieName(value) { return String(value || "").split("=", 1)[0].trim() || null; }
function cookieAttributes(value) {
  const parts = String(value || "").split(";").slice(1).map(part => part.trim());
  const maxAge = parts.find(part => /^max-age=/i.test(part));
  const expires = parts.find(part => /^expires=/i.test(part));
  return { max_age_seconds: maxAge ? Number(maxAge.split("=")[1]) : null,
    expires_present: Boolean(expires), http_only: parts.some(part => /^httponly$/i.test(part)),
    secure: parts.some(part => /^secure$/i.test(part)), same_site_present: parts.some(part => /^samesite=/i.test(part)) };
}
async function readBounded(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 16_384) throw new Error("P38_NVR_RESPONSE_TOO_LARGE");
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}
async function login() {
  const range = await fetch(`${baseUrl}/API/Login/Range`, { method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(5_000) });
  const rangeBody = await readBounded(range);
  const uri = "/API/Web/Login", body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_QA_OBSERVER" } });
  const common = { method: "POST", headers: { "content-type": "application/json",
    "x-requested-with": "XMLHttpRequest" }, body, signal: AbortSignal.timeout(5_000) };
  const first = await fetch(`${baseUrl}${uri}`, common);
  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  if (first.status !== 401 || !challenge.realm || !challenge.nonce) throw new Error("P38_NVR_DIGEST_CHALLENGE_INVALID");
  const qop = String(challenge.qop || "auth").split(",")[0].trim();
  const nc = "00000001", cnonce = randomBytes(8).toString("hex");
  const ha1 = digestHex(challenge.algorithm, `${profile.username}:${challenge.realm}:${password}`);
  const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
  const responseDigest = digestHex(challenge.algorithm,
    `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = [
    `Digest username="${String(profile.username).replaceAll('"', "")}"`, `realm="${challenge.realm}"`,
    `nonce="${challenge.nonce}"`, `uri="${uri}"`, `response="${responseDigest}"`,
    `opaque="${challenge.opaque || ""}"`, `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`,
    challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
  ].filter(Boolean).join(", ");
  const response = await fetch(`${baseUrl}${uri}`, { ...common,
    headers: { ...common.headers, authorization } });
  const payload = await readBounded(response);
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const setCookie = String(response.headers.get("set-cookie") || "");
  const cookie = setCookie.split(";")[0].trim();
  if (!response.ok || !token || !cookie) throw new Error("P38_NVR_LOGIN_FAILED");
  return { token, cookie, range: { status: range.status, result: rangeBody?.result || null,
    login_exclusivity: rangeBody?.data?.login_exclusivity ?? null,
    http_api_version: rangeBody?.data?.http_api_version ?? null,
    site_version: rangeBody?.data?.site_version ?? null },
    login: { status: response.status, result: payload?.result || null,
      cookie_name: cookieName(setCookie), cookie_attributes: cookieAttributes(setCookie),
      response_token_present: true } };
}

const startedAt = Date.now(), session = await login(), checkpoints = [];
try {
  let sequence = 0;
  while (Date.now() - startedAt < durationMs) {
    const scheduledAt = startedAt + sequence * intervalMs;
    await pause(Math.max(0, scheduledAt - Date.now()));
    const response = await fetch(`${baseUrl}/API/Login/Heartbeat`, { method: "POST", redirect: "error",
      headers: { "content-type": "application/json", "x-csrftoken": session.token, cookie: session.cookie },
      body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(5_000) })
      .catch(error => ({ ok: false, status: 0, headers: new Headers(), arrayBuffer: async () => new ArrayBuffer(0),
        transport_error: error?.code || error?.name || "FETCH_FAILED" }));
    const payload = await readBounded(response);
    const nextToken = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
    const nextCookie = String(response.headers.get("set-cookie") || "");
    checkpoints.push({ sequence: ++sequence, sampled_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt, http_status: response.status, ok: response.ok === true,
      result: payload?.result || null, reason: payload?.reason || payload?.data?.reason || null,
      error_code: payload?.error_code ?? payload?.data?.error_code ?? null,
      transport_error: response.transport_error || null,
      response_token_present: Boolean(nextToken), response_token_changed: Boolean(nextToken && nextToken !== session.token),
      set_cookie_present: Boolean(nextCookie), set_cookie_name: cookieName(nextCookie),
      set_cookie_attributes: nextCookie ? cookieAttributes(nextCookie) : null });
    if (sequence * intervalMs >= durationMs) break;
  }
} finally {
  await fetch(`${baseUrl}/API/Web/Logout`, { method: "POST", redirect: "error",
    headers: { "content-type": "application/json", "x-csrftoken": session.token, cookie: session.cookie },
    body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(5_000) }).catch(() => null);
}

const evidence = { protocol: "observer-push38-private-nvr-heartbeat-observation-v1",
  started_at: new Date(startedAt).toISOString(), ended_at: new Date().toISOString(),
  elapsed_ms: Date.now() - startedAt, interval_ms: intervalMs, endpoint_fingerprint_sha256: originFingerprint,
  read_only: true, settings_changed: false, media_streams_opened: 0, credentials_exposed: false,
  recorder: session.range, login: session.login, checkpoints,
  summary: { samples: checkpoints.length, successful: checkpoints.filter(point => point.ok && point.result !== "failed" && point.result !== "error").length,
    failed: checkpoints.filter(point => !point.ok || point.result === "failed" || point.result === "error").length,
    first_failure_elapsed_ms: checkpoints.find(point => !point.ok || point.result === "failed" || point.result === "error")?.elapsed_ms ?? null,
    response_token_rotations: checkpoints.filter(point => point.response_token_changed).length,
    response_cookie_updates: checkpoints.filter(point => point.set_cookie_present).length } };
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
chmodSync(output, 0o600);
console.log(JSON.stringify({ status: "PASS", output, ...evidence.summary,
  login_exclusivity: session.range.login_exclusivity, cookie_attributes: session.login.cookie_attributes }));
