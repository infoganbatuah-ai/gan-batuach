#!/usr/bin/env node
// Disposable architecture probe only: synthetic sentinel; never Development data.
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const worktree = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const cachedBase = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3";
const sourceDocker = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const pgImage = "public.ecr.aws/supabase/postgres:17.6.1.167";
const pgImageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const scratch = mkdtempSync(join(worktree, ".restore-architecture-qa."));
const image = join(scratch, "target.sparsebundle");
const mount = mkdtempSync("/private/tmp/do-restore-qa.");
const secret = randomBytes(48).toString("base64url");
const guest = "isolated-restore-qa";
let attached = false;
let started = false;
let startAttempted = false;
let cleanupSafe = false;
const evidence = { status: "BLOCKED", reason: null, targetImagePath: image,
  encrypted: false, isolatedHome: false, guestDiskInsideEncryptedVolume: false,
  noHostMounts: false, noProxyEnv: false, guestHasDefaultRoute: null,
  guestIpv4OutputDrop: false, guestIpv6OutputDrop: false,
  guestIpv4ForwardDrop: false, guestIpv6ForwardDrop: false,
  managementSurvivedFirewall: false, dnsHasNoAllowRule: false,
  ipv4EgressProbeDenied: false, ipv6EgressProbeDenied: false,
  dnsResolutionProbeDenied: false, egressProbesDeniedAfterReboot: false,
  firewallPersistence: "NOT_TESTED", bootRouteAbsentBeforePolicy: false,
  bootIpv6RouteAbsentBeforePolicy: false,
  rebootVerified: false, postgresSentinelAfterReboot: false,
  storageSentinelAfterReboot: false, sentinelRecoveredAfterReattach: false,
  postgresTool: false, pgNetworkNone: false, storageNetworkNone: false,
  postgresVersion: null, pgSentinel: false, storageSentinel: false,
  originalVolumesAbsent: false, payloadHiddenAfterDetach: false, scratchCleaned: false };

function run(bin, args, { input, env, timeout = 30000, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, {
    input, env: env ? { ...process.env, ...env } : process.env,
    encoding: "utf8", timeout, maxBuffer: 2_000_000,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${bin.split("/").at(-1)} exited ${result.status}: ${result.stderr.trim().slice(0, 800)}`);
  }
  return result;
}
function guestRun(args, env, timeout = 30000) {
  return run("/opt/homebrew/bin/limactl", ["shell", guest, "--", ...args], { env, timeout });
}
function guestDocker(args, env, timeout = 30000) {
  return guestRun(["sudo", "docker", ...args], env, timeout);
}
function firewallRules(family, chain, env) {
  return guestRun(["sudo", family, "-S", chain], env).stdout.trim().split(/\r?\n/);
}
function verifyFirewall(env, peerIp, guestSshPort) {
  const v4out = firewallRules("iptables", "OUTPUT", env);
  const v6out = firewallRules("ip6tables", "OUTPUT", env);
  const v4forward = firewallRules("iptables", "FORWARD", env);
  const v6forward = firewallRules("ip6tables", "FORWARD", env);
  const managementRule = `-A OUTPUT -d ${peerIp}/32 -p tcp -m tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT`;
  evidence.guestIpv4OutputDrop = v4out[0] === "-P OUTPUT DROP" &&
    v4out.includes("-A OUTPUT -o lo -j ACCEPT") && v4out.includes(managementRule) &&
    v4out.filter(line => line.startsWith("-A OUTPUT ")).length === 2;
  evidence.guestIpv6OutputDrop = JSON.stringify(v6out) ===
    JSON.stringify(["-P OUTPUT DROP", "-A OUTPUT -o lo -j ACCEPT"]);
  evidence.guestIpv4ForwardDrop = v4forward.find(line => line.startsWith("-A FORWARD ")) === "-A FORWARD -j DROP";
  evidence.guestIpv6ForwardDrop = v6forward.find(line => line.startsWith("-A FORWARD ")) === "-A FORWARD -j DROP";
  evidence.dnsHasNoAllowRule = [...v4out, ...v6out].every(line => !/--dport 53.*-j ACCEPT/.test(line));
  assert.ok(evidence.guestIpv4OutputDrop && evidence.guestIpv6OutputDrop &&
    evidence.guestIpv4ForwardDrop && evidence.guestIpv6ForwardDrop &&
    evidence.dnsHasNoAllowRule, "GUEST_EGRESS_POLICY_NOT_FAIL_CLOSED");
}
function verifyDeniedEgress(env) {
  // These probes run before any source data is present. Policy inspection alone
  // cannot establish that packets are denied on the actual guest path.
  guestRun(["sh", "-lc", "command -v timeout >/dev/null && command -v bash >/dev/null && command -v getent >/dev/null"], env);
  const denied = args => {
    const result = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", ...args],
      { env, timeout: 10000, allowFailure: true });
    return result.status !== 0 && result.status !== null && !result.error;
  };
  const ipv4 = denied(["timeout", "3", "bash", "-c", "exec 3<>/dev/tcp/1.1.1.1/443"]);
  const ipv6 = denied(["timeout", "3", "bash", "-c", "exec 3<>/dev/tcp/2606:4700:4700::1111/443"]);
  const dns = denied(["timeout", "3", "getent", "ahostsv4", "cloudflare.com"]);
  assert.ok(ipv4 && ipv6 && dns, "GUEST_EGRESS_PROBE_SUCCEEDED");
  evidence.ipv4EgressProbeDenied = ipv4;
  evidence.ipv6EgressProbeDenied = ipv6;
  evidence.dnsResolutionProbeDenied = dns;
}

try {
  assert.ok(existsSync(cachedBase), "LOCAL_BASE_IMAGE_MISSING");
  assert.ok(statSync(cachedBase).size > 300_000_000,
    "LOCAL_BASE_IMAGE_INVALID");
  run("/usr/bin/hdiutil", ["create", "-size", "8g", "-type", "SPARSEBUNDLE",
    "-encryption", "AES-256", "-stdinpass", "-fs", "APFS", "-volname",
    "DO_RESTORE_QA", "-nospotlight", image], { input: `${secret}\n`, timeout: 120000 });
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "on", "-stdinpass", "-mountpoint", mount, image],
    { input: `${secret}\n`, timeout: 120000 });
  attached = true;
  const imageInfo = run("/usr/bin/hdiutil", ["info"]).stdout;
  assert.ok(imageInfo.includes(image), "SCRATCH_IMAGE_NOT_ATTACHED");
  const mountedEntry = imageInfo.slice(imageInfo.indexOf(image));
  const encryptionLine = mountedEntry.match(/^image-encrypted[^\n]*/m)?.[0] ?? "missing";
  assert.ok(/:\s*(true|yes)/i.test(encryptionLine),
    `SCRATCH_IMAGE_ENCRYPTION_UNVERIFIED:${encryptionLine}`);
  evidence.encrypted = true;
  const mountInfo = run("/usr/sbin/diskutil", ["info", mount]).stdout;
  const ownersLine = mountInfo.match(/^\s*Owners:\s*[^\n]*/m)?.[0] ?? "Owners: unknown";
  assert.ok(/Owners:\s*Enabled/i.test(ownersLine),
    `SCRATCH_VOLUME_OWNERSHIP_NOT_ENABLED:${ownersLine.trim()}`);

  const sentinel = join(mount, "synthetic-sentinel.txt");
  writeFileSync(sentinel, "synthetic restore sentinel only\n", { mode: 0o600, flag: "wx" });
  assert.equal(readFileSync(sentinel, "utf8"), "synthetic restore sentinel only\n");
  const limaHome = join(mount, "lima");
  mkdirSync(limaHome, { mode: 0o700 });
  const config = join(mount, "isolated-lima.yaml");
  writeFileSync(config, `vmType: vz\narch: aarch64\nimages:\n  - location: ${cachedBase}\n    arch: aarch64\ncpus: 2\nmemory: 2GiB\ndisk: 6GiB\nmounts: []\nnetworks: []\nportForwards: []\npropagateProxyEnv: false\ncontainerd:\n  system: false\n  user: false\nssh:\n  loadDotSSHPubKeys: false\n  forwardAgent: false\nhostResolver:\n  enabled: false\nprovision: []\n`, { mode: 0o600, flag: "wx" });
  const env = { LIMA_HOME: limaHome };
  run("/opt/homebrew/bin/limactl", ["validate", config], { env });
  evidence.isolatedHome = true;
  startAttempted = true;
  run("/opt/homebrew/bin/limactl", ["start", "--tty=false", "--name", guest,
    "--plain", "--mount-none", "--containerd", "none", config],
  { env, timeout: 180000 });
  started = true;
  const guestFiles = readdirSync(join(limaHome, guest));
  evidence.guestDiskInsideEncryptedVolume = guestFiles.some(name => /disk/i.test(name));
  assert.ok(evidence.guestDiskInsideEncryptedVolume, "SCRATCH_VM_DISK_NOT_INSIDE_ENCRYPTED_IMAGE");
  const guestState = guestRun(["sh", "-lc",
    "printf 'MOUNTS='; mount | grep -c 'virtiofs' || true; printf 'ROUTES='; ip -4 route | grep -c '^default ' || true; printf 'DOCKER='; command -v docker || true; printf 'POSTGRES='; command -v postgres || true"],
  env).stdout;
  evidence.noHostMounts = /MOUNTS=0(?:\r?\n|$)/.test(guestState);
  evidence.noProxyEnv = guestRun(["sh", "-lc",
    "env | cut -d= -f1 | grep -Eic '^(http_proxy|https_proxy|all_proxy|no_proxy)$' || true"], env).stdout.trim() === "0";
  evidence.guestHasDefaultRoute = /ROUTES=1(?:\r?\n|$)/.test(guestState);
  evidence.postgresTool = /(?:DOCKER|POSTGRES)=\//.test(guestState);
  assert.ok(evidence.noHostMounts, "GUEST_HAS_HOST_MOUNT");
  assert.ok(evidence.noProxyEnv, "GUEST_INHERITED_PROXY_ENV");
  assert.ok(evidence.postgresTool, "GUEST_HAS_NO_OFFLINE_POSTGRES_RUNTIME");

  // This scratch Docker daemon must not rewrite the forwarding chain after
  // the fail-closed rule is installed. Only --network none is used below.
  guestRun(["sudo", "test", "!", "-e", "/etc/docker/daemon.json"], env);
  const daemonConfig = join(mount, "docker-daemon-qa.json");
  writeFileSync(daemonConfig, '{"iptables":false,"ip6tables":false,"bridge":"none"}\n',
    { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", daemonConfig,
    `${guest}:/tmp/docker-daemon-qa.json`], { env, timeout: 30000 });
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0644",
    "/tmp/docker-daemon-qa.json", "/etc/docker/daemon.json"], env);
  // Before any guest test data, start only the scratch guest's local Docker
  // daemon, then install the persistent firewall service.
  guestRun(["sudo", "systemctl", "start", "docker"], env, 30000);
  const sshParts = guestRun(["sh", "-lc", "printf '%s' \"$SSH_CONNECTION\""], env).stdout.trim().split(/\s+/);
  assert.equal(sshParts.length, 4, "GUEST_MANAGEMENT_PEER_UNKNOWN");
  const [peerIp, , , guestSshPort] = sshParts;
  assert.match(peerIp, /^(?:\d{1,3}\.){3}\d{1,3}$/);
  assert.match(guestSshPort, /^\d{1,5}$/);
  const initial4 = firewallRules("iptables", "OUTPUT", env);
  const initial6 = firewallRules("ip6tables", "OUTPUT", env);
  assert.deepEqual(initial4, ["-P OUTPUT ACCEPT"], "UNEXPECTED_GUEST_IPV4_OUTPUT_RULES");
  assert.deepEqual(initial6, ["-P OUTPUT ACCEPT"], "UNEXPECTED_GUEST_IPV6_OUTPUT_RULES");
  // This dedicated scratch guest may be discarded if management is lost.
  // Unlike the previous probe, there is no timer that can reopen egress.
  const lockScript = join(mount, "do-qa-egress-lock");
  const lockUnit = join(mount, "do-qa-egress-lock.service");
  writeFileSync(lockScript, `#!/bin/sh
set -eu
ip -4 route show default | wc -l > /run/do-qa-default-route-before-lock
ip -6 route show default | wc -l > /run/do-qa-ipv6-default-route-before-lock
iptables -I FORWARD 1 -j DROP
ip6tables -I FORWARD 1 -j DROP
iptables -C OUTPUT -o lo -j ACCEPT 2>/dev/null || iptables -A OUTPUT -o lo -j ACCEPT
ip6tables -C OUTPUT -o lo -j ACCEPT 2>/dev/null || ip6tables -A OUTPUT -o lo -j ACCEPT
iptables -C OUTPUT -d ${peerIp}/32 -p tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT 2>/dev/null || iptables -A OUTPUT -d ${peerIp}/32 -p tcp --sport ${guestSshPort} -m conntrack --ctstate ESTABLISHED -j ACCEPT
iptables -P OUTPUT DROP
ip6tables -P OUTPUT DROP
`, { mode: 0o600, flag: "wx" });
  writeFileSync(lockUnit, `[Unit]
Description=Disposable QA fail-closed egress boundary
DefaultDependencies=no
After=local-fs.target
Before=sysinit.target network-pre.target systemd-networkd.service NetworkManager.service docker.service
Wants=network-pre.target
FailureAction=poweroff

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/do-qa-egress-lock
RemainAfterExit=yes

[Install]
WantedBy=sysinit.target
`, { mode: 0o600, flag: "wx" });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", lockScript,
    `${guest}:/tmp/do-qa-egress-lock`], { env, timeout: 30000 });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", lockUnit,
    `${guest}:/tmp/do-qa-egress-lock.service`], { env, timeout: 30000 });
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0700",
    "/tmp/do-qa-egress-lock", "/usr/local/sbin/do-qa-egress-lock"], env);
  guestRun(["sudo", "install", "-o", "root", "-g", "root", "-m", "0644",
    "/tmp/do-qa-egress-lock.service", "/etc/systemd/system/do-qa-egress-lock.service"], env);
  guestRun(["sudo", "systemctl", "daemon-reload"], env);
  guestRun(["sudo", "systemctl", "enable", "do-qa-egress-lock.service"], env);
  guestRun(["sudo", "systemctl", "start", "do-qa-egress-lock.service"], env);
  assert.equal(guestRun(["systemctl", "is-enabled", "do-qa-egress-lock.service"], env).stdout.trim(), "enabled");
  assert.equal(guestRun(["systemctl", "is-active", "do-qa-egress-lock.service"], env).stdout.trim(), "active");
  verifyFirewall(env, peerIp, guestSshPort);
  verifyDeniedEgress(env);
  guestRun(["true"], env);
  evidence.managementSurvivedFirewall = true;

  const localImageId = run("/opt/homebrew/bin/docker", ["-H", sourceDocker,
    "image", "inspect", pgImage, "--format", "{{.Id}}"], { timeout: 30000 }).stdout.trim();
  assert.equal(localImageId, pgImageId, "CACHED_POSTGRES_IMAGE_CHANGED");
  const imageTar = join(mount, "cached-postgres-image.tar");
  run("/opt/homebrew/bin/docker", ["-H", sourceDocker, "image", "save", "-o", imageTar, pgImage],
    { timeout: 120000 });
  run("/opt/homebrew/bin/limactl", ["copy", "--backend=scp", imageTar,
    `${guest}:/tmp/cached-postgres-image.tar`], { env, timeout: 120000 });
  guestDocker(["image", "load", "-i", "/tmp/cached-postgres-image.tar"], env, 120000);
  guestRun(["rm", "-f", "/tmp/cached-postgres-image.tar"], env);
  assert.equal(guestDocker(["image", "inspect", pgImage, "--format", "{{.Id}}"], env).stdout.trim(),
    pgImageId, "GUEST_POSTGRES_IMAGE_MISMATCH");
  const initialVolumes = guestDocker(["volume", "ls", "--format", "{{.Name}}"], env).stdout.trim();
  assert.equal(initialVolumes, "", "ISOLATED_GUEST_HAS_PREEXISTING_VOLUMES");

  guestDocker(["volume", "create", "qa_pgdata"], env);
  guestDocker(["run", "--rm", "--network", "none", "--pull", "never", "--user", "root",
    "--volume", "qa_pgdata:/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "chown postgres:postgres /data"], env);
  const pg = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
    "--volume", "qa_pgdata:/var/lib/postgresql/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "initdb -D /var/lib/postgresql/data -A trust --no-instructions >/dev/null && exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp"],
  env, 60000).stdout.trim();
  assert.match(pg, /^[0-9a-f]{64}$/);
  assert.equal(guestDocker(["inspect", pg, "--format", "{{.HostConfig.NetworkMode}}"], env).stdout.trim(), "none");
  evidence.pgNetworkNone = true;
  let pgReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const readiness = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
      "exec", pg, "pg_isready", "-h", "/tmp", "-U", "postgres"],
    { env, timeout: 10000, allowFailure: true });
    if (readiness.status === 0) { pgReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(pgReady, "ISOLATED_POSTGRES_NOT_READY");
  evidence.postgresVersion = guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U",
    "postgres", "-d", "postgres", "-At", "-c", "SELECT current_setting('server_version');"], env).stdout.trim();
  assert.match(evidence.postgresVersion, /^17\.6(?:\s|$)/);
  guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U", "postgres", "-d", "postgres",
    "-v", "ON_ERROR_STOP=1", "-c", "CREATE TABLE qa_sentinel (value text NOT NULL); INSERT INTO qa_sentinel VALUES ('synthetic-only');"], env);
  const pgValue = guestDocker(["exec", pg, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-At", "-c", "SELECT value FROM qa_sentinel;"], env).stdout.trim();
  evidence.pgSentinel = pgValue === "synthetic-only";
  assert.ok(evidence.pgSentinel, "POSTGRES_SENTINEL_MISSING");

  guestDocker(["volume", "create", "qa_storage"], env);
  const storage = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--volume", "qa_storage:/mnt", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "sleep 45"], env).stdout.trim();
  assert.match(storage, /^[0-9a-f]{64}$/);
  assert.equal(guestDocker(["inspect", storage, "--format", "{{.HostConfig.NetworkMode}}"], env).stdout.trim(), "none");
  evidence.storageNetworkNone = true;
  guestDocker(["exec", storage, "sh", "-ec", "printf synthetic-storage-only > /mnt/object"], env);
  evidence.storageSentinel = guestDocker(["exec", storage, "cat", "/mnt/object"], env).stdout.trim() === "synthetic-storage-only";
  assert.ok(evidence.storageSentinel, "STORAGE_SENTINEL_MISSING");
  const volumes = guestDocker(["volume", "ls", "--format", "{{.Name}}"], env).stdout.trim().split(/\r?\n/).sort();
  evidence.originalVolumesAbsent = JSON.stringify(volumes) === JSON.stringify(["qa_pgdata", "qa_storage"]);
  assert.ok(evidence.originalVolumesAbsent, "ORIGINAL_OR_UNEXPECTED_VOLUME_PRESENT");
  verifyFirewall(env, peerIp, guestSshPort); // Fail if Docker rewrote the forwarding boundary.
  guestDocker(["stop", storage, pg], env, 30000);
  const bootIdBefore = guestRun(["cat", "/proc/sys/kernel/random/boot_id"], env).stdout.trim();
  run("/opt/homebrew/bin/limactl", ["stop", guest], { env, timeout: 60000 });
  started = false;
  run("/opt/homebrew/bin/limactl", ["start", "--tty=false", guest], { env, timeout: 180000 });
  started = true;
  const bootIdAfter = guestRun(["cat", "/proc/sys/kernel/random/boot_id"], env).stdout.trim();
  assert.notEqual(bootIdAfter, bootIdBefore, "SCRATCH_VM_DID_NOT_REBOOT");
  assert.equal(guestRun(["systemctl", "is-active", "do-qa-egress-lock.service"], env).stdout.trim(), "active");
  verifyFirewall(env, peerIp, guestSshPort);
  verifyDeniedEgress(env);
  evidence.egressProbesDeniedAfterReboot = true;
  evidence.bootRouteAbsentBeforePolicy = guestRun(["cat", "/run/do-qa-default-route-before-lock"], env).stdout.trim() === "0";
  evidence.bootIpv6RouteAbsentBeforePolicy = guestRun(["cat", "/run/do-qa-ipv6-default-route-before-lock"], env).stdout.trim() === "0";
  assert.ok(evidence.bootRouteAbsentBeforePolicy, "NETWORK_ROUTE_PRECEDED_BOOT_FIREWALL");
  assert.ok(evidence.bootIpv6RouteAbsentBeforePolicy, "IPV6_ROUTE_PRECEDED_BOOT_FIREWALL");
  evidence.rebootVerified = true;
  evidence.firewallPersistence = "REAPPLIED_BEFORE_NETWORK_AFTER_REBOOT";
  guestRun(["sudo", "systemctl", "start", "docker"], env);
  verifyFirewall(env, peerIp, guestSshPort);
  const resumedPg = guestDocker(["run", "--detach", "--rm", "--network", "none", "--pull", "never",
    "--read-only", "--tmpfs", "/tmp:rw,nosuid,nodev,size=64m", "--user", "postgres",
    "--volume", "qa_pgdata:/var/lib/postgresql/data", "--entrypoint", "/bin/sh", pgImage,
    "-ec", "exec postgres -D /var/lib/postgresql/data -c listen_addresses= -c unix_socket_directories=/tmp"],
  env, 60000).stdout.trim();
  assert.match(resumedPg, /^[0-9a-f]{64}$/);
  let resumedReady = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    const result = run("/opt/homebrew/bin/limactl", ["shell", guest, "--", "sudo", "docker",
      "exec", resumedPg, "pg_isready", "-h", "/tmp", "-U", "postgres"],
    { env, timeout: 10000, allowFailure: true });
    if (result.status === 0) { resumedReady = true; break; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(resumedReady, "REBOOTED_POSTGRES_NOT_READY");
  evidence.postgresSentinelAfterReboot = guestDocker(["exec", resumedPg, "psql", "-X", "-h", "/tmp", "-U",
    "postgres", "-d", "postgres", "-At", "-c", "SELECT value FROM qa_sentinel;"], env).stdout.trim() === "synthetic-only";
  evidence.storageSentinelAfterReboot = guestDocker(["run", "--rm", "--network", "none", "--pull", "never",
    "--volume", "qa_storage:/mnt:ro", "--entrypoint", "/bin/cat", pgImage, "/mnt/object"], env).stdout.trim() === "synthetic-storage-only";
  assert.ok(evidence.postgresSentinelAfterReboot && evidence.storageSentinelAfterReboot,
    "SYNTHETIC_SENTINEL_LOST_AFTER_REBOOT");
  verifyFirewall(env, peerIp, guestSshPort);
  guestDocker(["stop", resumedPg], env);
  run("/opt/homebrew/bin/limactl", ["stop", guest], { env, timeout: 60000 });
  started = false;
  run("/usr/bin/hdiutil", ["detach", mount], { timeout: 60000 });
  attached = false;
  assert.ok(!existsSync(sentinel), "SENTINEL_VISIBLE_AFTER_DETACH");
  run("/usr/bin/hdiutil", ["attach", "-nobrowse", "-owners", "on", "-stdinpass",
    "-mountpoint", mount, image], { input: `${secret}\n`, timeout: 120000 });
  attached = true;
  evidence.sentinelRecoveredAfterReattach = readFileSync(sentinel, "utf8") === "synthetic restore sentinel only\n" &&
    readdirSync(join(mount, "lima", guest)).some(name => /disk/i.test(name));
  assert.ok(evidence.sentinelRecoveredAfterReattach, "ENCRYPTED_VOLUME_SENTINEL_NOT_RECOVERED");
  evidence.status = "ARCHITECTURE_PROBE_PASS";
} catch (error) {
  evidence.reason = String(error.message).slice(0, 900);
} finally {
  if (startAttempted) {
    const env = { LIMA_HOME: join(mount, "lima") };
    const listed = run("/opt/homebrew/bin/limactl", ["list", "--json"],
      { env, timeout: 30000, allowFailure: true });
    if (listed.status !== 0) {
      started = true;
      evidence.reason = "SCRATCH_VM_STATUS_UNVERIFIED";
    } else {
      const guestInfo = listed.stdout.split(/\r?\n/).map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).find(item => item?.name === guest);
      if (guestInfo?.status === "Running") {
        const stopped = run("/opt/homebrew/bin/limactl", ["stop", guest],
          { env, timeout: 60000, allowFailure: true });
        if (stopped.status !== 0) {
          started = true;
          evidence.reason = "SCRATCH_VM_STOP_FAILED";
        } else started = false;
      } else if (guestInfo?.status === "Stopped" || !guestInfo) started = false;
      else {
        started = true;
        evidence.reason = "SCRATCH_VM_STATE_UNSAFE_FOR_DETACH";
      }
    }
  }
  if (!started && attached) {
    const detached = run("/usr/bin/hdiutil", ["detach", mount],
      { timeout: 60000, allowFailure: true });
    if (detached.status !== 0) evidence.reason = "SCRATCH_IMAGE_DETACH_FAILED";
    else attached = false;
  }
  if (!started && !attached) {
    evidence.payloadHiddenAfterDetach = ["synthetic-sentinel.txt", "lima", "cached-postgres-image.tar"]
      .every(name => !existsSync(join(mount, name)));
    cleanupSafe = evidence.payloadHiddenAfterDetach && scratch.startsWith(`${worktree}/.restore-architecture-qa.`);
    if (cleanupSafe) {
      rmSync(scratch, { recursive: true });
      rmdirSync(mount);
      evidence.scratchCleaned = true;
    }
  }
  if (!evidence.scratchCleaned) evidence.reason ??= "SCRATCH_CLEANUP_INCOMPLETE";
  if (!evidence.scratchCleaned) evidence.status = "BLOCKED";
  console.log(JSON.stringify(evidence));
  if (evidence.status !== "ARCHITECTURE_PROBE_PASS" || !evidence.scratchCleaned) process.exitCode = 1;
}
