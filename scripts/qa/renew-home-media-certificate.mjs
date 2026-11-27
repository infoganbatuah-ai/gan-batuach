import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, chmodSync, copyFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const requiredVolume = "/Volumes/DIGITAL_OBSERVER";
const root = `${requiredVolume}/Projects/Gan-Batuach/.dev-cache/media-ingress`;
if (!execFileSync("/sbin/mount", [], { encoding: "utf8", timeout: 3000 }).includes(` on ${requiredVolume} (`))
  throw new Error("MEDIA_CERT_EXTERNAL_VOLUME_REQUIRED");
const certbot = join(root, "certbot");
const name = "gateway-media-homeqa.ganbatuach.com";
const live = join(certbot, "config/live", name);
const installedCert = join(root, "tls/fullchain.pem");
const installedKey = join(root, "tls/privkey.pem");
const label = "com.ganbatuach.media-cert-renewal";
const service = `gui/${process.getuid()}/com.ganbatuach.media-ingress`;
const writeLog = (event, details = {}) => appendFileSync(join(root, "logs", `${label}.log`),
  `${JSON.stringify({ time: new Date().toISOString(), event, ...details })}\n`, { mode: 0o600 });
process.on("uncaughtException", error => {
  try { writeLog("fatal", { code: String(error?.code || error?.name || "unknown") }); } catch { /* exit anyway */ }
  process.exit(1);
});
const digest = path => createHash("sha256").update(readFileSync(path)).digest("hex");
const xml = value => String(value).replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
})[char]);

if (process.argv.includes("--install")) {
  const target = join(root, "runtime/scripts/qa/renew-home-media-certificate.mjs");
  const plist = join(homedir(), "Library/LaunchAgents", `${label}.plist`);
  mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  mkdirSync(dirname(plist), { recursive: true, mode: 0o700 });
  copyFileSync(fileURLToPath(import.meta.url), target);
  chmodSync(target, 0o600);
  const args = [process.execPath, target];
  const content = `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>\n<key>Label</key><string>${label}</string>\n<key>ProgramArguments</key><array>${args.map(arg => `<string>${xml(arg)}</string>`).join("")}</array>\n<key>RunAtLoad</key><true/>\n<key>StartInterval</key><integer>3600</integer>\n</dict></plist>\n`;
  writeFileSync(plist, content, { mode: 0o600 });
  chmodSync(plist, 0o600);
  const domain = `gui/${process.getuid()}`;
  try { execFileSync("/bin/launchctl", ["bootout", domain, plist], { stdio: "ignore" }); } catch { /* not installed */ }
  execFileSync("/bin/launchctl", ["bootstrap", domain, plist], { stdio: "ignore" });
  execFileSync("/bin/launchctl", ["kickstart", "-k", `${domain}/${label}`], { stdio: "ignore" });
  process.stdout.write(`${JSON.stringify({ installed: true, label, interval_seconds: 3600, external_volume_required: true })}\n`);
} else {
  const certbotBinary = "/opt/homebrew/bin/certbot";
  execFileSync(certbotBinary, ["renew", "--non-interactive", "--quiet", "--no-random-sleep-on-renew", "--cert-name", name,
    "--config-dir", join(certbot, "config"), "--work-dir", join(certbot, "work"),
    "--logs-dir", join(certbot, "log")], { stdio: "ignore", timeout: 300_000 });
  const renewedCert = join(live, "fullchain.pem");
  const renewedKey = join(live, "privkey.pem");
  if (digest(renewedCert) !== digest(installedCert)) {
    for (const [source, target] of [[renewedCert, installedCert], [renewedKey, installedKey]]) {
      const temporary = `${target}.${process.pid}.tmp`;
      copyFileSync(source, temporary);
      chmodSync(temporary, 0o600);
      renameSync(temporary, target);
    }
    execFileSync("/bin/launchctl", ["kickstart", "-k", service], { stdio: "ignore" });
    writeLog("certificate_updated", { service_restarted: true });
  } else writeLog("certificate_current");
}
