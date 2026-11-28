import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { managedEdgeLaunchAgent,
  trustedHomeQaRuntimeCertificate } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";

const legacy = {
  Label: "com.ganbatuach.software-connector.tapo",
  ProgramArguments: ["/usr/bin/caffeinate", "-i", "-m", "-s", "/signed/node", "/signed/runner.mjs"],
  RunAtLoad: true,
  KeepAlive: true,
  ThrottleInterval: 20,
  ProcessType: "Background",
  EnvironmentVariables: { OBSERVER_EDGE_DEVICE_TYPE: "SOFTWARE_CONNECTOR" }
};
const managed = managedEdgeLaunchAgent(legacy);

assert.equal(managed.ProcessType, undefined);
assert.equal(legacy.ProcessType, "Background");
assert.deepEqual(managed.ProgramArguments, legacy.ProgramArguments);
assert.deepEqual(managed.EnvironmentVariables, legacy.EnvironmentVariables);
assert.equal(managed.Label, legacy.Label);
assert.equal(managed.KeepAlive, true);

const temporary = realpathSync(mkdtempSync(join(tmpdir(), "push38-runtime-ca-")));
try {
  const certificate = join(temporary, "qa-control-plane-ca.crt");
  execFileSync("openssl", ["req", "-x509", "-nodes", "-newkey", "rsa:2048", "-days", "2",
    "-keyout", join(temporary, "key.pem"), "-out", certificate,
    "-subj", "/CN=push38-home-qa-loopback", "-addext", "subjectAltName=IP:127.0.0.1"],
  { stdio: "ignore" });
  chmodSync(certificate, 0o600);
  const digest = createHash("sha256").update(readFileSync(certificate)).digest("hex");
  const config = join(temporary, "agent-config.json");
  writeFileSync(config, JSON.stringify({ channel: "HOME_QA", managedRoot: temporary,
    profile: "PHYSICAL_GATEWAY", qaTlsCaPath: certificate, qaTlsCaSha256: digest }), { mode: 0o600 });
  assert.equal(trustedHomeQaRuntimeCertificate(temporary, "PHYSICAL_GATEWAY"), certificate);
  assert.throws(() => trustedHomeQaRuntimeCertificate(temporary, "SOFTWARE_CONNECTOR"),
    /HOME_QA_CERTIFICATE_UNSAFE/);
} finally { rmSync(temporary, { recursive: true, force: true }); }

const desktopHost = readFileSync(new URL(
  "../../services/connector-desktop/macos/DesktopHost.swift", import.meta.url), "utf8");
assert.doesNotMatch(desktopHost, /"ProcessType"\s*:\s*"Background"/);

console.log(JSON.stringify({ status: "PASS", managed_edge_background_priority_removed: true,
  service_manager_preserved: true, runtime_bytes_changed: false }));
