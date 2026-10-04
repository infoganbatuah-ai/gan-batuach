import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { once } from "node:events";

const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const durationSeconds = Number(option("duration-seconds") || 1200);
if (!Number.isInteger(durationSeconds) || durationSeconds < 300 || durationSeconds > 1200)
  throw new Error("P38_BOUNDED_CONTROL_WINDOW_INVALID");
const restricted = `${realpathSync("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
const statePath = resolve(option("state-output"));
if (!statePath.startsWith(restricted) || existsSync(statePath))
  throw new Error("P38_BOUNDED_CONTROL_STATE_PATH_INVALID");
mkdirSync(dirname(statePath), { recursive: true, mode: 0o700 });

const cloudflared = "/opt/homebrew/bin/cloudflared";
const launchctl = "/bin/launchctl";
const sourceConfig = `${homedir()}/.cloudflared/config.yml`;
const launchAgent = `${homedir()}/Library/LaunchAgents/com.cloudflare.cloudflared.plist`;
for (const path of [cloudflared, sourceConfig, launchAgent]) {
  if (!existsSync(path) || !statSync(path).isFile()) throw new Error("P38_BOUNDED_CONTROL_PREREQUISITE_MISSING");
}
const source = readFileSync(sourceConfig, "utf8");
const tunnel = /^tunnel:\s*([0-9a-f-]{36})\s*$/mi.exec(source)?.[1];
const credentials = /^credentials-file:\s*(.+?)\s*$/mi.exec(source)?.[1];
if (!tunnel || !credentials || !realpathSync(credentials).startsWith(`${homedir()}${sep}.cloudflared${sep}`) ||
  !/^\s*-\s+service:\s+http_status:404\s*$/m.test(source))
  throw new Error("P38_BOUNDED_CONTROL_SOURCE_CONFIG_INVALID");

const scopedConfig = resolve(dirname(statePath), "cloudflared-scoped.yml");
if (existsSync(scopedConfig)) throw new Error("P38_BOUNDED_CONTROL_SCOPED_CONFIG_EXISTS");
writeFileSync(scopedConfig, `tunnel: ${tunnel}\ncredentials-file: ${credentials}\n\ningress:\n` +
  `  - hostname: gateway.ganbatuach.com\n    path: ^/push38/remote-playback(/result)?$\n` +
  `    service: https://127.0.0.1:3101\n    originRequest:\n      noTLSVerify: true\n` +
  `  - hostname: gateway.ganbatuach.com\n    path: ^/api/digital-observer/dvr-gateway$\n` +
  `    service: https://127.0.0.1:3101\n    originRequest:\n      noTLSVerify: true\n` +
  `  - service: http_status:404\n`, { flag: "wx", mode: 0o600 });
execFileSync(cloudflared, ["--config", scopedConfig, "tunnel", "ingress", "validate"],
  { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });

const state = {
  contract: "observer-push38-bounded-control-exposure-v1",
  status: "STARTING",
  duration_seconds: durationSeconds,
  hostname: "gateway.ganbatuach.com",
  allowed_routes: ["/push38/remote-playback", "/push38/remote-playback/result", "/api/digital-observer/dvr-gateway"],
  default_deny: true,
  local_origin: "TLS_LOOPBACK_3101",
  secrets_logged: false,
  recurring_cost_introduced: false,
  original_service_restored: false
};
writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`, { flag: "wx", mode: 0o600 });

const domain = `gui/${process.getuid()}`;
let child = null;
let originalStopped = false;
let cleaned = false;
const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms));
async function publicStatus(path) {
  try {
    return (await fetch(`https://gateway.ganbatuach.com${path}`, {
      cache: "no-store", signal: AbortSignal.timeout(5_000)
    })).status;
  } catch { return 0; }
}
async function cleanup(reason) {
  if (cleaned) return false;
  cleaned = true;
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([once(child, "exit"), sleep(5_000)]);
  }
  let restored = false;
  if (originalStopped) {
    try {
      execFileSync(launchctl, ["bootstrap", domain, launchAgent],
        { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
      restored = true;
    } catch { restored = false; }
  }
  const persisted = JSON.parse(readFileSync(statePath, "utf8"));
  writeFileSync(statePath, `${JSON.stringify({ ...persisted,
    status: restored ? "CLOSED" : "CLEANUP_REQUIRED", closed_at: new Date().toISOString(), close_reason: reason,
    scoped_connector_stopped: !child || child.exitCode !== null || child.signalCode !== null,
    original_service_restored: restored }, null, 2)}\n`, { mode: 0o600 });
  return restored;
}
try {
  execFileSync(launchctl, ["bootout", domain, launchAgent],
    { encoding: "utf8", timeout: 20_000, stdio: ["ignore", "pipe", "pipe"] });
  originalStopped = true;
  child = spawn(cloudflared, ["--no-autoupdate", "--config", scopedConfig, "tunnel", "run", tunnel],
    { stdio: ["ignore", "ignore", "ignore"] });
  let ready = false;
  for (let attempt = 0; attempt < 15 && child.exitCode === null; attempt += 1) {
    await sleep(1_000);
    const [page, dashboard, unrelated] = await Promise.all([
      publicStatus("/push38/remote-playback"), publicStatus("/dashboard"), publicStatus("/api/unrelated")
    ]);
    if (page === 200 && dashboard === 404 && unrelated === 404) { ready = true; break; }
  }
  if (!ready) throw new Error("P38_BOUNDED_CONTROL_EXTERNAL_PROOF_FAILED");
  const startedAt = new Date();
  writeFileSync(statePath, `${JSON.stringify({ ...state, status: "ACTIVE", started_at: startedAt.toISOString(),
    expires_at: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
    external_intended_route_status: 200, external_default_deny_status: 404 }, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ status: "ACTIVE", duration_seconds: durationSeconds,
    intended_route_status: 200, default_deny_status: 404, auto_cleanup: true,
    recurring_cost_introduced: false }));
  const timer = setTimeout(async () => process.exit(await cleanup("LEASE_EXPIRED") ? 0 : 1), durationSeconds * 1000);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => {
    clearTimeout(timer); cleanup(signal).then(success => process.exit(success ? 0 : 1));
  });
  await new Promise(() => {});
} catch (error) {
  await cleanup("START_FAILED");
  throw error;
}
