// Bounded Home-DVR session-scope probe. It temporarily pauses the exact signed
// live Gateway, opens two recorder logins and one bounded channel handoff, and
// proves whether Logout for the first login leaves the second login and media
// usable. The live Gateway and OTA agent are restored from their canonical
// launchd plists in a finally block.
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";

const option = name => process.argv.find(value =>
  value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const output = resolve(option("output") || ".");
const expectedVersion = option("expected-version");
const expectedBuild = option("expected-build");
const restrictedRoot = `${realpathSync(
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (output === resolve(".") || !output.startsWith(restrictedRoot) || existsSync(output) ||
  !/^0\.2\.\d+-p38-health$/.test(expectedVersion) || !/^[a-f0-9]{40}$/.test(expectedBuild))
  throw new Error("P38_NVR_SESSION_SCOPE_ARGUMENTS_INVALID");

const domain = `gui/${process.getuid()}`;
const gatewayLabel = "com.ganbatuach.video-gateway";
const agentLabel = "com.ganbatuach.video-gateway.ota-agent";
const gatewayPlist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.plist");
const agentPlist = join(homedir(), "Library/LaunchAgents/com.ganbatuach.video-gateway.ota-agent.plist");
if (![gatewayPlist, agentPlist].every(existsSync))
  throw new Error("P38_NVR_SESSION_SCOPE_PLIST_MISSING");

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
const probeChannels = [1];

const pause = ms => new Promise(resolvePause => setTimeout(resolvePause, ms));
function launchctl(args) {
  return execFileSync("/bin/launchctl", args, { encoding: "utf8", timeout: 20_000,
    stdio: ["ignore", "pipe", "pipe"] });
}
function loaded(label) {
  try { launchctl(["print", `${domain}/${label}`]); return true; } catch { return false; }
}
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return true; } catch {}
    await pause(500);
  }
  return false;
}
async function liveHealth() {
  const response = await fetch("http://127.0.0.1:18082/health", {
    signal: AbortSignal.timeout(5_000)
  });
  if (!response.ok) throw new Error(`gateway_health_${response.status}`);
  return response.json();
}
function safeHealth(value) {
  return { status: value?.status ?? null,
    version: value?.edgeRuntime?.software_version ?? null,
    build_sha: value?.edgeRuntime?.build_sha ?? null,
    assigned: value?.lastDiscovery?.assignedCount ?? null,
    connected: value?.lastDiscovery?.connectedCount ?? null,
    failed: value?.lastDiscovery?.failedAssignedCount ?? null,
    empty: value?.lastDiscovery?.unassignedCount ?? null,
    progressing: value?.mediaHeartbeat?.progressingRelays ?? null,
    stalled: value?.mediaHeartbeat?.stalledRelays ?? null };
}
function baselineMatches(value) {
  return value?.edgeRuntime?.software_version === expectedVersion &&
    value?.edgeRuntime?.build_sha === expectedBuild &&
    value?.lastDiscovery?.assignedCount === 10 && value?.lastDiscovery?.unassignedCount === 6 &&
    Number(value?.lastDiscovery?.connectedCount) >= 8 &&
    Number(value?.lastDiscovery?.connectedCount) <= 9 &&
    Number(value?.lastDiscovery?.failedAssignedCount) >= 1 &&
    Number(value?.lastDiscovery?.failedAssignedCount) <= 2 &&
    [8, 9].includes(value?.mediaHeartbeat?.progressingRelays);
}
function digestHex(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256"
    ? "sha256" : "md5").update(value, "utf8").digest("hex");
}
function parseDigestChallenge(value) {
  const fields = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "")
    .matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi))
    fields[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  return fields;
}
async function boundedJson(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 16_384) throw new Error("P38_NVR_SESSION_SCOPE_RESPONSE_TOO_LARGE");
  try { return JSON.parse(bytes.toString("utf8")); } catch { return null; }
}
async function login(label) {
  const rangeResponse = await fetch(`${baseUrl}/API/Login/Range`, { method: "POST",
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body: JSON.stringify({ version: "1.0", data: {} }),
    signal: AbortSignal.timeout(5_000) });
  const range = await boundedJson(rangeResponse);
  const uri = "/API/Web/Login";
  const body = JSON.stringify({ data: { remote_terminal_info: `GATEWAY_QA_${label}` } });
  const common = { method: "POST", redirect: "error",
    headers: { "content-type": "application/json", "x-requested-with": "XMLHttpRequest" },
    body, signal: AbortSignal.timeout(5_000) };
  const first = await fetch(`${baseUrl}${uri}`, common);
  const challenge = parseDigestChallenge(first.headers.get("www-authenticate"));
  if (first.status !== 401 || !challenge.realm || !challenge.nonce)
    throw new Error("P38_NVR_SESSION_SCOPE_DIGEST_INVALID");
  const qop = String(challenge.qop || "auth").split(",")[0].trim();
  const nc = "00000001", cnonce = randomBytes(8).toString("hex");
  const ha1 = digestHex(challenge.algorithm,
    `${profile.username}:${challenge.realm}:${password}`);
  const ha2 = digestHex(challenge.algorithm, `POST:${uri}`);
  const responseDigest = digestHex(challenge.algorithm,
    `${ha1}:${challenge.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = [
    `Digest username="${String(profile.username).replaceAll('"', "")}"`,
    `realm="${challenge.realm}"`, `nonce="${challenge.nonce}"`, `uri="${uri}"`,
    `response="${responseDigest}"`, `opaque="${challenge.opaque || ""}"`,
    `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`,
    challenge.algorithm ? `algorithm="${challenge.algorithm}"` : ""
  ].filter(Boolean).join(", ");
  const response = await fetch(`${baseUrl}${uri}`, { ...common,
    headers: { ...common.headers, authorization } });
  const payload = await boundedJson(response);
  const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
  const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
  if (!response.ok || !token) throw new Error("P38_NVR_SESSION_SCOPE_LOGIN_FAILED");
  return { token, cookie, contract: { http_status: response.status,
    result: payload?.result || null,
    login_exclusivity: range?.data?.login_exclusivity ?? null } };
}
async function heartbeat(session) {
  const response = await fetch(`${baseUrl}/API/Login/Heartbeat`, { method: "POST",
    redirect: "error", headers: { "content-type": "application/json",
      "x-csrftoken": session.token, ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data: {} }),
    signal: AbortSignal.timeout(5_000) }).catch(error => ({ status: 0, ok: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      transport_error: error?.code || error?.name || "FETCH_FAILED" }));
  const payload = await boundedJson(response);
  return { http_status: response.status, ok: response.ok === true,
    result: payload?.result || null,
    error_code: payload?.error_code ?? payload?.data?.error_code ?? null,
    transport_error: response.transport_error || null };
}
async function logout(session) {
  const response = await fetch(`${baseUrl}/API/Web/Logout`, { method: "POST",
    redirect: "error", headers: { "content-type": "application/json",
      "x-csrftoken": session.token, ...(session.cookie ? { cookie: session.cookie } : {}) },
    body: JSON.stringify({ version: "1.0", data: {} }),
    signal: AbortSignal.timeout(5_000) }).catch(error => ({ status: 0, ok: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      transport_error: error?.code || error?.name || "FETCH_FAILED" }));
  const payload = await boundedJson(response);
  return { http_status: response.status, ok: response.ok === true,
    result: payload?.result || null,
    error_code: payload?.error_code ?? payload?.data?.error_code ?? null,
    transport_error: response.transport_error || null };
}
const activeMedia = [];
async function openMedia(session, channel, sessionPhase) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/live.mp4?channel=${channel - 1}&type=1&chrome=1`, {
    headers: { "x-csrftoken": session.token, "cache-control": "no-cache",
      ...(session.cookie ? { cookie: session.cookie } : {}) },
    signal: controller.signal
  });
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (![200, 400].includes(response.status) || !response.body ||
    contentType && !contentType.includes("video/") &&
      !contentType.includes("application/octet-stream")) {
    controller.abort();
    throw new Error("P38_NVR_SESSION_SCOPE_MEDIA_OPEN_FAILED");
  }
  const state = { channel, session_phase: sessionPhase,
    before_bytes: 0, after_bytes: 0, phase: "before",
    ended: false, error: null };
  const reader = response.body.getReader();
  const pump = (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) { state.ended = true; break; }
        state[`${state.phase}_bytes`] += value?.byteLength || 0;
      }
    } catch (error) {
      if (!controller.signal.aborted)
        state.error = error?.cause?.code || error?.name || "MEDIA_READ_FAILED";
    }
  })();
  const media = { controller, state, pump };
  activeMedia.push(media);
  return media;
}

const evidence = { protocol: "observer-push38-private-nvr-session-scope-v1",
  started_at: new Date().toISOString(), read_only: true, media_streams_opened: 0,
  settings_changed: false, credentials_exposed: false,
  endpoint_fingerprint_sha256: createHash("sha256").update(baseUrl).digest("hex"),
  baseline_before: null, baseline_after: null, probe: null,
  exact_live_release_restored: false, result: "FAIL" };
let restored = false;
async function restore() {
  if (restored) return;
  restored = true;
  if (!loaded(gatewayLabel)) launchctl(["bootstrap", domain, gatewayPlist]);
  const healthy = await waitFor(async () => baselineMatches(await liveHealth()), 4 * 60_000);
  if (!loaded(agentLabel)) launchctl(["bootstrap", domain, agentPlist]);
  if (!healthy || !await waitFor(() => loaded(agentLabel), 20_000))
    throw new Error("P38_NVR_SESSION_SCOPE_RESTORE_FAILED");
  evidence.baseline_after = safeHealth(await liveHealth());
  evidence.exact_live_release_restored = true;
}

try {
  if (!loaded(gatewayLabel) || !loaded(agentLabel) ||
    !await waitFor(async () => baselineMatches(await liveHealth()), 90_000))
    throw new Error("P38_NVR_SESSION_SCOPE_BASELINE_INVALID");
  const before = await liveHealth();
  evidence.baseline_before = safeHealth(before);
  launchctl(["bootout", domain, agentPlist]);
  launchctl(["bootout", domain, gatewayPlist]);
  if (!await waitFor(async () => {
    try { await liveHealth(); return false; } catch { return true; }
  }, 20_000)) throw new Error("P38_NVR_SESSION_SCOPE_GATEWAY_DID_NOT_STOP");
  await pause(90_000);
  const first = await login("SESSION_SCOPE_A");
  const firstMedia = [];
  for (const channel of probeChannels)
    firstMedia.push(await openMedia(first, channel, "PRIOR_SESSION"));
  if (!await waitFor(() => firstMedia.every(stream =>
    stream.state.before_bytes >= 64 * 1024), 15_000))
    throw new Error("P38_NVR_SESSION_SCOPE_PRIOR_MEDIA_NOT_PROGRESSING");
  const second = await login("SESSION_SCOPE_B");
  const beforeLogout = await heartbeat(second);
  const media = [];
  for (const [index, channel] of probeChannels.entries()) {
    const replacement = await openMedia(second, channel, "REPLACEMENT_SESSION");
    media.push(replacement);
    if (!await waitFor(() => replacement.state.before_bytes >= 64 * 1024, 10_000))
      throw new Error("P38_NVR_SESSION_SCOPE_REPLACEMENT_MEDIA_NOT_PROGRESSING");
    firstMedia[index].controller.abort();
    await firstMedia[index].pump;
  }
  for (const stream of media) stream.state.phase = "after";
  const firstLogout = await logout(first);
  await pause(30_000);
  const secondAfterLogout = await heartbeat(second);
  const mediaContinued = media.every(stream =>
    stream.state.after_bytes >= 256 * 1024 &&
    stream.state.ended === false && stream.state.error === null);
  for (const stream of media) stream.controller.abort();
  await Promise.allSettled(media.map(stream => stream.pump));
  const secondLogout = await logout(second);
  evidence.probe = {
    login_exclusivity: second.contract.login_exclusivity,
    tokens_equal: first.token === second.token,
    cookies_equal: first.cookie === second.cookie,
    second_heartbeat_before_first_logout: beforeLogout,
    prior_media_handoff: { streams: firstMedia.map(stream => stream.state),
      all_replacements_opened_before_logout: media.length === probeChannels.length },
    first_logout: firstLogout,
    second_heartbeat_after_first_logout: secondAfterLogout,
    second_media_after_first_logout: { streams: media.map(stream => stream.state),
      continued: mediaContinued },
    second_logout: secondLogout,
    first_logout_scoped_to_own_session: secondAfterLogout.ok === true && mediaContinued
  };
  evidence.result = "PASS";
} catch (error) {
  evidence.failure = String(error?.message || error?.name || "SESSION_SCOPE_PROBE_FAILED");
} finally {
  for (const media of activeMedia) media.controller.abort();
  await Promise.allSettled(activeMedia.map(media => media.pump));
  try { await restore(); } catch (error) {
    evidence.restore_failure = String(error?.message || error?.name || "RESTORE_FAILED");
    evidence.result = "FAIL";
  }
  evidence.ended_at = new Date().toISOString();
  writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  chmodSync(output, 0o600);
}
console.log(JSON.stringify({ result: evidence.result, output,
  exact_live_release_restored: evidence.exact_live_release_restored,
  tokens_equal: evidence.probe?.tokens_equal ?? null,
  first_logout_scoped_to_own_session:
    evidence.probe?.first_logout_scoped_to_own_session ?? null }));
if (evidence.result !== "PASS") process.exitCode = 1;
