import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

// Focused recovery utility for an already-enrolled Software Connector whose
// runtime data was left in a temporary directory. It preserves the existing
// device identity and camera binding; it never enrolls or creates cloud rows.
const sourceRoot = resolve(process.argv[2] || "");
if (!sourceRoot || !existsSync(sourceRoot)) throw new Error("EXISTING_CONNECTOR_DATA_REQUIRED");

const required = [
  "secrets/device_gateway_id",
  "secrets/device_observer_site_id",
  "secrets/device_refresh_token",
  "secrets/dvr_profile_json",
  "secrets/dvr_password"
];
for (const relative of required) {
  if (!existsSync(join(sourceRoot, relative))) throw new Error(`EXISTING_CONNECTOR_STATE_INCOMPLETE:${relative}`);
}

const appRoot = join(homedir(), "Applications", "Digital Observer.app");
const resources = join(appRoot, "Contents", "Resources");
const runtimeRoot = join(resources, "runtime");
const node = join(resources, "bin", "node");
const entry = join(runtimeRoot, "scripts", "run-software-connector.mjs");
for (const path of [node, entry]) if (!existsSync(path)) throw new Error("PACKAGED_CONNECTOR_RUNTIME_UNAVAILABLE");

const supportRoot = join(homedir(), "Library", "Application Support", "Digital Observer");
const destinationRoot = join(supportRoot, "Tapo Connector");
const stagedRoot = `${destinationRoot}.staged`;
if (existsSync(stagedRoot)) rmSync(stagedRoot, { recursive: true, force: true });
mkdirSync(supportRoot, { recursive: true, mode: 0o700 });
cpSync(sourceRoot, stagedRoot, { recursive: true, dereference: false });

const copiedGatewayId = readFileSync(join(stagedRoot, "secrets", "device_gateway_id"), "utf8").trim();
const sourceGatewayId = readFileSync(join(sourceRoot, "secrets", "device_gateway_id"), "utf8").trim();
if (!copiedGatewayId || copiedGatewayId !== sourceGatewayId) throw new Error("CONNECTOR_IDENTITY_COPY_MISMATCH");

if (existsSync(destinationRoot)) {
  const installedGatewayId = readFileSync(join(destinationRoot, "secrets", "device_gateway_id"), "utf8").trim();
  if (installedGatewayId !== sourceGatewayId) throw new Error("PERSISTENT_CONNECTOR_IDENTITY_CONFLICT");
  rmSync(stagedRoot, { recursive: true, force: true });
} else {
  renameSync(stagedRoot, destinationRoot);
}
chmodSync(destinationRoot, 0o700);
chmodSync(join(destinationRoot, "secrets"), 0o700);

const label = "com.ganbatuach.software-connector.tapo";
const launchAgents = join(homedir(), "Library", "LaunchAgents");
const plistPath = join(launchAgents, `${label}.plist`);
const logRoot = join(homedir(), "Library", "Logs");
mkdirSync(launchAgents, { recursive: true, mode: 0o700 });
mkdirSync(logRoot, { recursive: true, mode: 0o700 });

const xmlEscape = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${xmlEscape(node)}</string><string>${xmlEscape(entry)}</string></array>
  <key>WorkingDirectory</key><string>${xmlEscape(runtimeRoot)}</string>
  <key>EnvironmentVariables</key><dict>
    <key>OBSERVER_CONNECTOR_DATA_DIR</key><string>${xmlEscape(destinationRoot)}</string>
    <key>OBSERVER_CONNECTOR_SECRET_DIR</key><string>${xmlEscape(join(destinationRoot, "secrets"))}</string>
    <key>VIDEO_GATEWAY_PORT</key><string>18083</string>
    <key>PATH</key><string>${xmlEscape(`${join(resources, "bin")}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin`)}</string>
  </dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>20</integer>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${xmlEscape(join(logRoot, `${label}.out.log`))}</string>
  <key>StandardErrorPath</key><string>${xmlEscape(join(logRoot, `${label}.err.log`))}</string>
</dict></plist>\n`;
const temporaryPlist = `${plistPath}.tmp`;
writeFileSync(temporaryPlist, plist, { mode: 0o600 });
renameSync(temporaryPlist, plistPath);

const domain = `gui/${process.getuid()}`;
try { execFileSync("/bin/launchctl", ["bootout", domain, plistPath], { stdio: "ignore" }); } catch {}
execFileSync("/bin/launchctl", ["bootstrap", domain, plistPath], { stdio: "pipe" });
execFileSync("/bin/launchctl", ["kickstart", "-k", `${domain}/${label}`], { stdio: "pipe" });

console.log(JSON.stringify({
  status: "PERSISTENT_EXISTING_CONNECTOR_STARTED",
  label,
  identity_preserved: true,
  cloud_rows_created: false,
  secrets_printed: false,
  local_port: 18083
}));
