import { execFileSync } from "node:child_process";
import { copyFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const options = new Map(process.argv.slice(2).map(arg => {
  const [name, ...value] = arg.replace(/^--/, "").split("=");
  return [name, value.join("=")];
}));
const address = options.get("bind-address") || "";
const cert = options.get("tls-cert") || "";
const key = options.get("tls-key") || "";
const gatewayHost = options.get("gateway-host") || "";
const connectorHost = options.get("connector-host") || "";
const installRoot = resolve(options.get("data-root") || "");
const requiredVolume = "/Volumes/DIGITAL_OBSERVER";
const expectedRoot = `${requiredVolume}/Projects/Gan-Batuach/.dev-cache/media-ingress`;
if (!address || !cert || !key || !gatewayHost || !connectorHost ||
  installRoot !== expectedRoot)
  throw new Error("MEDIA_INGRESS_INSTALL_ARGUMENTS_REQUIRED");
if (!execFileSync("/sbin/mount", [], { encoding: "utf8" }).includes(` on ${requiredVolume} (`))
  throw new Error("MEDIA_INGRESS_EXTERNAL_VOLUME_REQUIRED");

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const runtime = join(installRoot, "runtime");
const logRoot = join(installRoot, "logs");
const label = "com.ganbatuach.media-ingress";
const plist = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
const script = join(runtime, "scripts/qa/start-push38-https-playback-ingress.mjs");
const ingress = join(runtime, "services/video-gateway/playback-ingress.mjs");
const installedCert = join(installRoot, "tls/fullchain.pem");
const installedKey = join(installRoot, "tls/privkey.pem");
const escapeXml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[char]);
const array = values => `<array>${values.map(value => `<string>${escapeXml(value)}</string>`).join("")}</array>`;

for (const directory of [installRoot, runtime, logRoot, dirname(script), dirname(ingress), dirname(installedCert), dirname(plist)])
  mkdirSync(directory, { recursive: true, mode: 0o700 });
for (const [from, to] of [
  [join(sourceRoot, "scripts/qa/start-push38-https-playback-ingress.mjs"), script],
  [join(sourceRoot, "services/video-gateway/playback-ingress.mjs"), ingress],
  [cert, installedCert], [key, installedKey]
]) copyFileSync(from, to);
for (const path of [script, ingress, installedCert]) chmodSync(path, 0o600);
chmodSync(installedKey, 0o600);
const expiry = execFileSync("/usr/bin/openssl", ["x509", "-noout", "-enddate", "-in", installedCert], { encoding: "utf8" }).trim();
const certificate = readFileSync(installedCert, "utf8");
const privateKey = readFileSync(installedKey, "utf8");
if (!certificate.includes("BEGIN CERTIFICATE") || !privateKey.includes("PRIVATE KEY"))
  throw new Error("MEDIA_INGRESS_INSTALL_CERTIFICATE_INVALID");
const args = [
  process.execPath, script,
  `--gateway-host=${gatewayHost}`,
  `--connector-host=${connectorHost}`,
  "--port=18443", `--bind-address=${address}`,
  `--required-volume=${requiredVolume}`,
  `--log-file=${join(logRoot, `${label}.log`)}`,
  `--tls-key=${installedKey}`, `--tls-cert=${installedCert}`,
  "--browser-origin=https://gan-batuach.vercel.app",
  "--gateway-origin=http://127.0.0.1:18082",
  "--connector-origin=http://127.0.0.1:18083"
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key>${array(args)}\n<key>WorkingDirectory</key><string>${escapeXml(runtime)}</string>\n<key>RunAtLoad</key><true/>\n<key>KeepAlive</key><true/>\n<key>ThrottleInterval</key><integer>10</integer>\n</dict></plist>\n`;
writeFileSync(plist, xml, { mode: 0o600 });
chmodSync(plist, 0o600);
const domain = `gui/${process.getuid()}`;
try { execFileSync("/bin/launchctl", ["bootout", domain, plist], { stdio: "ignore" }); } catch { /* not installed */ }
execFileSync("/bin/launchctl", ["bootstrap", domain, plist], { stdio: "ignore" });
execFileSync("/bin/launchctl", ["kickstart", "-k", `${domain}/${label}`], { stdio: "ignore" });
process.stdout.write(`${JSON.stringify({ label, installed: true, certificate_expiry: expiry, source: "installed_copy" })}\n`);
