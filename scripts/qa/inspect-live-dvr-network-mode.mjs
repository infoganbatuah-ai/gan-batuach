// Read-only DVR network-mode inspection. Sensitive endpoint, credentials,
// serial, MAC and raw responses never enter stdout or the evidence file.
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createEdgeSecretStoreSync } from "../../services/video-gateway/edge-secret-store-sync.mjs";

const output = resolve(process.argv.find(value => value.startsWith("--output="))?.slice(9) || ".");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!output.startsWith(restricted) || existsSync(output)) throw new Error("P38_DVR_NETWORK_RESTRICTED_NEW_OUTPUT_REQUIRED");
const store = createEdgeSecretStoreSync({ keychainService: "com.ganbatuach.video-gateway.runtime" });
const profile = JSON.parse(store.read("dvr_profile_json"));
const password = store.read("dvr_password");
if (!profile?.endpoint || !profile?.username || !password) throw new Error("P38_DVR_NETWORK_PROFILE_UNAVAILABLE");
const base = new URL(String(profile.endpoint).includes("://") ? profile.endpoint : `http://${profile.endpoint}`);
if (base.username || base.password || !["http:", "https:"].includes(base.protocol)) throw new Error("P38_DVR_NETWORK_ENDPOINT_INVALID");
const baseUrl = base.toString().replace(/\/$/, "");

function challenge(value) {
  const result = {};
  for (const match of String(value || "").replace(/^Digest\s+/i, "").matchAll(/([a-z0-9_-]+)=(?:"([^"]*)"|([^,\s]+))/gi))
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? "";
  return result;
}
function digest(algorithm, value) {
  return createHash(String(algorithm || "MD5").toUpperCase() === "SHA-256" ? "sha256" : "md5")
    .update(value, "utf8").digest("hex");
}
const uri = "/API/Web/Login";
const body = JSON.stringify({ data: { remote_terminal_info: "GATEWAY_NETWORK_READ_ONLY" } });
const first = await fetch(`${baseUrl}${uri}`, { method: "POST", headers: {
  "content-type": "application/json", "x-requested-with": "XMLHttpRequest" }, body,
signal: AbortSignal.timeout(3000) });
let response = first;
if (first.status === 401) {
  const auth = challenge(first.headers.get("www-authenticate"));
  if (!auth.realm || !auth.nonce) throw new Error("P38_DVR_NETWORK_DIGEST_CHALLENGE_INVALID");
  const qop = String(auth.qop || "auth").split(",")[0].trim(), nc = "00000001";
  const cnonce = randomBytes(8).toString("hex");
  const ha1 = digest(auth.algorithm, `${profile.username}:${auth.realm}:${password}`);
  const ha2 = digest(auth.algorithm, `POST:${uri}`);
  const answer = digest(auth.algorithm, `${ha1}:${auth.nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  const authorization = [`Digest username="${String(profile.username).replaceAll('"', "")}"`,
    `realm="${auth.realm}"`, `nonce="${auth.nonce}"`, `uri="${uri}"`, `response="${answer}"`,
    `opaque="${auth.opaque || ""}"`, `qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`,
    auth.algorithm ? `algorithm="${auth.algorithm}"` : ""].filter(Boolean).join(", ");
  response = await fetch(`${baseUrl}${uri}`, { method: "POST", headers: {
    "content-type": "application/json", "x-requested-with": "XMLHttpRequest", authorization }, body,
  signal: AbortSignal.timeout(3000) });
}
if (!response.ok) throw new Error("P38_DVR_NETWORK_LOGIN_FAILED");
const token = String(response.headers.get("x-csrftoken") || "").split(",")[0].trim();
const cookie = String(response.headers.get("set-cookie") || "").split(";")[0].trim();
if (!token) throw new Error("P38_DVR_NETWORK_SESSION_INVALID");
async function read(path) {
  const next = await fetch(`${baseUrl}${path}`, { method: "POST", headers: {
    "content-type": "application/json", "x-csrftoken": token, ...(cookie ? { cookie } : {}) },
  body: JSON.stringify({ version: "1.0", data: {} }), signal: AbortSignal.timeout(4000) }).catch(() => null);
  return { path, status: next?.status || 0, body: next?.ok ? await next.json().catch(() => null) : null };
}
const reads = await Promise.all([read("/API/Login/DeviceInfo/Get"), read("/API/SystemInfo/Base/Get"),
  read("/API/SystemInfo/Network/Get"), read("/API/NetworkConfig/NetBase/Get")]);
const identity = JSON.stringify(reads[0].body || {}) + JSON.stringify(reads[1].body || {});
if (!identity.includes("ERO-N7516HR") || !identity.includes("8.2.4.1"))
  throw new Error("P38_DVR_NETWORK_IDENTITY_MISMATCH");
const findings = [];
function walk(value, path = []) {
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    const next = [...path, key];
    const normalized = key.toLowerCase();
    if ((normalized.includes("dhcp") || normalized === "ip_type" || normalized === "address_type" ||
      normalized === "network_mode") && ["boolean", "number", "string"].includes(typeof item)) {
      const safe = String(item).slice(0, 40);
      if (!/\d{1,3}(?:\.\d{1,3}){3}/.test(safe) && !/:/.test(safe)) findings.push({ field: next.join("."), value: safe });
    }
    if (typeof item === "object") walk(item, next);
  }
}
for (const item of reads.slice(2)) if (item.body) walk(item.body);
const unique = [...new Map(findings.map(item => [`${item.field}|${item.value}`, item])).values()];
const evidence = { protocol: "observer-push38-dvr-network-mode-read-only-v1",
  observed_at: new Date().toISOString(), recorder_identity: "PASS",
  supported_reads: reads.map(item => ({ api: item.path, http_status: item.status })),
  network_mode_findings: unique, raw_response_recorded: false, endpoint_recorded: false,
  credentials_recorded: false, settings_changed: false, recorder_restarted: false };
writeFileSync(output, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600, flag: "wx" });
console.log(JSON.stringify({ status: "PASS", recorder_identity: "PASS",
  supported_reads: evidence.supported_reads, network_mode_findings: unique,
  evidence_sha256: createHash("sha256").update(readFileSync(output)).digest("hex"),
  settings_changed: false }));
