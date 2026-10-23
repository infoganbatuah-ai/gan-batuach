// Renew the bounded, loopback-only HOME_QA TLS certificate without changing
// device credentials, release state, functional runtimes, or public exposure.
import { execFileSync } from "node:child_process";
import { createHash, createPrivateKey, createPublicKey, randomUUID, X509Certificate } from "node:crypto";
import { chmodSync, existsSync, lstatSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, join, resolve, sep } from "node:path";

const apply = process.argv.includes("--apply");
const option = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) || "";
const certPath = resolve(option("cert"));
const keyPath = resolve(option("key"));
const restrictedRoot = `${resolve("/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}${sep}`;
if (!apply || !certPath.startsWith(restrictedRoot) || !keyPath.startsWith(restrictedRoot) ||
  !/^push38t-ota-loopback-[0-9]{8}\.crt$/.test(basename(certPath)) ||
  !/^push38t-ota-loopback-[0-9]{8}\.key$/.test(basename(keyPath)) ||
  dirname(certPath) !== dirname(keyPath) || existsSync(certPath) || existsSync(keyPath))
  throw new Error("P38_HOME_QA_TLS_RENEWAL_SCOPE_INVALID");

const run = (binary, args) => execFileSync(binary, args, {
  encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "pipe"]
});
run("openssl", ["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "7",
  "-keyout", keyPath, "-out", certPath, "-subj", "/CN=push38-home-qa-loopback",
  "-addext", "subjectAltName=IP:127.0.0.1"]);
chmodSync(keyPath, 0o600); chmodSync(certPath, 0o600);

const certBytes = readFileSync(certPath), keyBytes = readFileSync(keyPath);
const certificate = new X509Certificate(certBytes);
const certPublic = certificate.publicKey.export({ format: "der", type: "spki" });
const keyPublic = createPublicKey(createPrivateKey(keyBytes)).export({ format: "der", type: "spki" });
if (!certificate.subjectAltName?.includes("IP Address:127.0.0.1") ||
  !certificate.verify(certificate.publicKey) || !certPublic.equals(keyPublic) ||
  Date.parse(certificate.validTo) < Date.now() + 6 * 24 * 60 * 60_000 ||
  [certPath, keyPath].some(path => lstatSync(path).isSymbolicLink() || !lstatSync(path).isFile() ||
    (lstatSync(path).mode & 0o077) !== 0))
  throw new Error("P38_HOME_QA_TLS_RENEWAL_VERIFY_FAILED");

const certificateSha256 = createHash("sha256").update(certBytes).digest("hex");
const targets = [
  { root: "observer-connector", profile: "SOFTWARE_CONNECTOR",
    deviceId: "db267b52-6282-4944-bcee-5d4857698fb0",
    label: "com.ganbatuach.software-connector.tapo.ota-agent" },
  { root: "observer-gateway", profile: "PHYSICAL_GATEWAY",
    deviceId: "62df97e2-3c0b-427f-9108-bde029bc10e7",
    label: "com.ganbatuach.video-gateway.ota-agent" }
];
function atomic(path, bytes) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.renewal`;
  writeFileSync(temporary, bytes, { mode: 0o600, flag: "wx" });
  renameSync(temporary, path); chmodSync(path, 0o600);
}
for (const target of targets) {
  const managedRoot = join(homedir(), "Library/Application Support/Digital Observer", target.root, "ota");
  const configPath = join(managedRoot, "agent-config.json");
  const installedCertPath = join(managedRoot, "qa-control-plane-ca.crt");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  if (config.managedRoot !== managedRoot || config.profile !== target.profile ||
    config.deviceId !== target.deviceId || config.channel !== "HOME_QA" ||
    config.qaTlsCaPath !== installedCertPath || !/^[a-f0-9]{64}$/.test(config.qaTlsCaSha256 || ""))
    throw new Error("P38_HOME_QA_TLS_RENEWAL_CONFIG_INVALID");
  atomic(installedCertPath, certBytes);
  atomic(configPath, `${JSON.stringify({ ...config, qaTlsCaSha256: certificateSha256 }, null, 2)}\n`);
}
for (const target of targets)
  run("/bin/launchctl", ["kickstart", "-k", `gui/${process.getuid()}/${target.label}`]);

console.log(JSON.stringify({ status: "PUSH38_HOME_QA_LOOPBACK_TLS_RENEWED",
  certificate_sha256: certificateSha256, valid_to: certificate.validTo,
  subject_alt_name: "IP:127.0.0.1", targets: targets.map(target => target.profile),
  ingress_scope: "LOOPBACK_ONLY", functional_runtime_changed: false }));
