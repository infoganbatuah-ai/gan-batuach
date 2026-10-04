import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { once } from "node:events";
import { selectBoundedMediaIpv6 } from "../../services/video-gateway/push38-bounded-media-network.mjs";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const durationSeconds = Number(option("duration-seconds") || 1200);
const port = Number(option("port") || 18443);
if (!Number.isInteger(durationSeconds) || durationSeconds < 300 || durationSeconds > 1200 ||
  !Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("P38_BOUNDED_MEDIA_WINDOW_INVALID");
const mediaRoot = `${realpathSync(`${homedir()}/Library/Application Support/Digital Observer/push38-media-tls`)}${sep}`;
const checkedMediaPath = (name, privateFile = false) => {
  const path = realpathSync(resolve(option(name)));
  if (!path.startsWith(mediaRoot) || !statSync(path).isFile() || (privateFile && (statSync(path).mode & 0o077) !== 0))
    throw new Error(`P38_BOUNDED_MEDIA_${name.toUpperCase().replace(/-/g, "_")}_UNSAFE`);
  return path;
};
const keyPath = checkedMediaPath("tls-key", true);
const certPath = checkedMediaPath("tls-cert");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const statePath = resolve(option("state-output"));
if (!statePath.startsWith(restricted)) throw new Error("P38_BOUNDED_MEDIA_STATE_PATH_INVALID");
if (existsSync(statePath)) throw new Error("P38_BOUNDED_MEDIA_STATE_ALREADY_EXISTS");
mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });

const runUpnp = (args, failure, timeout = 30_000) => {
  try {
    return execFileSync("/opt/homebrew/bin/upnpc", args, {
      encoding: "utf8", timeout, stdio: ["ignore", "pipe", "pipe"]
    });
  } catch {
    // miniupnpc includes the selected local/public addresses in its errors.
    // Keep those details out of qualification logs and emit only a bounded code.
    throw new Error(failure);
  }
};
const addPinhole = args => {
  try {
    return execFileSync("/opt/homebrew/bin/upnpc", args, {
      encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"]
    });
  } catch (error) {
    const diagnostic = `${String(error?.stdout || "")}\n${String(error?.stderr || "")}`;
    // Some ISP routers expose one shared IPv6-pinhole table and return 701
    // when it is occupied. Keep the route-limited server and temporary DNS
    // alive for an independent off-LAN reachability proof, but never claim
    // ownership of or delete an unknown pre-existing firewall rule.
    if (/code\s+701\s*\(PinholeSpaceExhausted\)/i.test(diagnostic)) return "";
    throw new Error("P38_BOUNDED_MEDIA_PINHOLE_ADD_FAILED");
  }
};
const ifconfig = execFileSync("/sbin/ifconfig", ["en0"], { encoding: "utf8", timeout: 10_000 });
const upnpStatus = runUpnp(["-6", "-m", "en0", "-s"], "P38_BOUNDED_MEDIA_UPNP_DISCOVERY_FAILED", 20_000);
const address = selectBoundedMediaIpv6({ ifconfigOutput: ifconfig, upnpOutput: upnpStatus });
if (!address) throw new Error("P38_BOUNDED_MEDIA_UPNP_IPV6_UNAVAILABLE");

const cloudflarePem = readFileSync(`${homedir()}/.cloudflared/cert.pem`, "utf8");
const encoded = cloudflarePem.split("\n").filter(line => line && !line.startsWith("-----")).join("");
const credential = JSON.parse(Buffer.from(encoded, "base64").toString("utf8"));
if (!credential.apiToken || !credential.zoneID) throw new Error("P38_BOUNDED_MEDIA_CLOUDFLARE_CREDENTIAL_INVALID");
const headers = { authorization: `Bearer ${credential.apiToken}`, "content-type": "application/json" };
const api = async (path, options = {}) => {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...options, headers: { ...headers, ...(options.headers || {}) }, signal: AbortSignal.timeout(15_000)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success !== true) throw new Error(`P38_BOUNDED_MEDIA_CLOUDFLARE_${response.status}`);
  return body.result;
};
const names = ["gateway-media-homeqa.ganbatuach.com", "connector-media-homeqa.ganbatuach.com"];
const list = name => api(`/zones/${credential.zoneID}/dns_records?type=AAAA&name=${encodeURIComponent(name)}`);
for (const name of names) if ((await list(name)).length) throw new Error("P38_BOUNDED_MEDIA_PREEXISTING_DNS");

const records = [];
let pinholeId = null;
let cleaned = false;
let media = null;
const state = {
  contract: "observer-push38-bounded-media-exposure-v1",
  status: "STARTING",
  duration_seconds: durationSeconds,
  port,
  hostnames: names,
  dns_proxied: false,
  dns_ttl_seconds: 60,
  route_limited: true,
  product_authorization_required: true,
  exact_edge_association: true,
  private_camera_credentials_exposed: false,
  recurring_cost_introduced: false,
  address_redacted: true,
  address_source: "UPNP_ACTIVE_LAN_MATCH",
  pinhole_id_recorded: false
};
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx", mode: 0o600 });
async function cleanup(reason) {
  if (cleaned) return false;
  cleaned = true;
  let dnsRemoved = 0;
  let dnsCleanupFailed = 0;
  for (const record of records) {
    try {
      await api(`/zones/${credential.zoneID}/dns_records/${record.id}`, { method: "DELETE" });
      dnsRemoved += 1;
    } catch { dnsCleanupFailed += 1; }
  }
  let pinholeRemoved = pinholeId === null;
  if (pinholeId !== null) {
    try {
      runUpnp(["-6", "-m", "en0", "-D", String(pinholeId)],
        "P38_BOUNDED_MEDIA_PINHOLE_REMOVE_FAILED", 20_000);
      pinholeRemoved = true;
    } catch { pinholeRemoved = false; }
  }
  if (media && media.exitCode === null && media.signalCode === null) {
    media.kill("SIGTERM");
    await Promise.race([once(media, "exit"), new Promise(resolve => setTimeout(resolve, 3_000))]);
  }
  const mediaStopped = !media || media.exitCode !== null || media.signalCode !== null;
  const fullyClosed = dnsRemoved === records.length && pinholeRemoved && mediaStopped;
  const persisted = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : state;
  writeFileSync(statePath, `${JSON.stringify({ ...persisted, status: fullyClosed ? "CLOSED" : "CLEANUP_REQUIRED",
    closed_at: new Date().toISOString(), close_reason: reason, dns_removed: dnsRemoved,
    dns_expected_removed: records.length, dns_cleanup_failed: dnsCleanupFailed,
    pinhole_removed: pinholeRemoved, media_stopped: mediaStopped }, null, 2)}\n`,
  { mode: 0o600 });
  return fullyClosed;
}
try {
  media = spawn(process.execPath, ["scripts/qa/start-push38-https-playback-ingress.mjs",
    `--gateway-host=${names[0]}`, `--connector-host=${names[1]}`, `--port=${port}`,
    `--bind-address=${address}`, `--tls-key=${keyPath}`, `--tls-cert=${certPath}`,
    "--browser-origin=https://gateway.ganbatuach.com"], { stdio: ["ignore", "pipe", "pipe"] });
  const ready = await Promise.race([
    once(media.stdout, "data"),
    once(media, "exit").then(() => { throw new Error("P38_BOUNDED_MEDIA_INGRESS_EXITED"); }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("P38_BOUNDED_MEDIA_INGRESS_TIMEOUT")), 10_000))
  ]);
  if (!String(ready[0]).includes("observer-push38-https-playback-ingress-v1"))
    throw new Error("P38_BOUNDED_MEDIA_INGRESS_NOT_READY");
  media.stdout.resume();
  media.stderr.resume();
  for (const name of names) records.push(await api(`/zones/${credential.zoneID}/dns_records`, {
    method: "POST", body: JSON.stringify({ type: "AAAA", name, content: address, proxied: false, ttl: 60 })
  }));
  const pinhole = addPinhole(["-6", "-m", "en0", "-A", "", "0", address,
    String(port), "TCP", String(durationSeconds)]);
  pinholeId = pinhole ? Number(/unique\s*ID\s*(?:is|:)\s*(\d+)/i.exec(pinhole)?.[1]) : null;
  if (pinhole && !Number.isInteger(pinholeId)) throw new Error("P38_BOUNDED_MEDIA_PINHOLE_ID_MISSING");
  const exposureStatus = pinholeId === null ? "PENDING_EXTERNAL_PROOF" : "ACTIVE";
  const startedAt = new Date(); const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  writeFileSync(statePath, `${JSON.stringify({ ...state, status: exposureStatus, started_at: startedAt.toISOString(),
    expires_at: expiresAt.toISOString(), pinhole_id_recorded: pinholeId !== null,
    firewall_path: pinholeId === null ? "PREEXISTING_REQUIRES_EXTERNAL_PROOF" : "MANAGED_TEMPORARY_PINHOLE" }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: exposureStatus, duration_seconds: durationSeconds, hostnames: names,
    port, address_redacted: true, pinhole_managed: pinholeId !== null,
    auto_cleanup: true, recurring_cost_introduced: false }));
  const timer = setTimeout(async () => process.exit(await cleanup("LEASE_EXPIRED") ? 0 : 1), durationSeconds * 1000);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    clearTimeout(timer); cleanup(signal).then(success => process.exit(success ? 0 : 1));
  });
  await new Promise(() => {});
} catch (error) {
  await cleanup("START_FAILED");
  throw error;
}
