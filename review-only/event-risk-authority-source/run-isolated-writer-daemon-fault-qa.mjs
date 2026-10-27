#!/usr/bin/env node
// Disposable Kingston scratch guest only. Deliberately leaves original gbi untouched.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const scratchPrefix = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.wg.";
const scratch = mkdtempSync(scratchPrefix);
const guest = `f${process.pid}`;
const env = { LIMA_HOME: scratch };
const sourceSocket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const cachedBase = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3";
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const imageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const service = `qa-writer-${process.pid}.service`;
const restoredService = `qa-writer-restored-${process.pid}.service`;
const client = `qa-existing-${process.pid}.service`;
const watchdog = `qa-watchdog-${process.pid}.service`;
const volume = `qa-writer-${process.pid}`;
const observed = { status: "FAIL", syntheticOnly: true, reason: null,
  isolated: false, existingClientWroteBeforeBarrier: false,
  existingAndNewTcpAndUnixDeniedDuringWindow: false,
  dockerAdminVolumeBypassObserved: false, daemonPidChanged: false,
  exactIdsResumedAfterDaemonRestart: false, guestRulesRemoved: false,
  startLimitPolicyObserved: false, nonRecoveryTimeoutFailClosed: false,
  allScratchCleaned: false, writerServiceState: null, writerServiceRecentLog: null, writerProbeErrors: null,
  baselineWrites: null, writesAfterClient: null, killCommandExit: null, killCommandDiagnostic: null };
let created = false;
let started = false;
let containers = [];

function run(label, bin, args, opts = {}) {
  const result = spawnSync(bin, args, { encoding: "utf8", timeout: opts.timeout || 30000,
    maxBuffer: 1_000_000, env: { ...process.env, ...env, ...(opts.env || {}) } });
  if (result.error || (result.status !== 0 && !opts.allowFailure)) throw new Error(`${label}_FAILED`);
  return result;
}
function lima(label, args, timeout) { return run(label, "/opt/homebrew/bin/limactl", args, { timeout }); }
function guestRun(label, args, timeout) {
  return lima(label, ["shell", "--tty=false", guest, "--", ...args], timeout).stdout.trim();
}
function guestTry(args, timeout = 10000) {
  try {
    return run("GUEST_TRY", "/opt/homebrew/bin/limactl", ["shell", "--tty=false", guest, "--", ...args],
      { timeout, allowFailure: true }).status === 0;
  } catch { return false; }
}
function limaTry(args, timeout = 60000) {
  try { return run("LIMA_CLEANUP", "/opt/homebrew/bin/limactl", args,
    { timeout, allowFailure: true }).status === 0; }
  catch { return false; }
}
function docker(label, args, timeout) { return guestRun(label, ["sudo", "docker", ...args], timeout); }
async function waitFor(test, attempts = 30, interval = 300) {
  for (let n = 0; n < attempts; n++) {
    try { if (test()) return true; } catch { /* daemon may be between restarts */ }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  return false;
}
const writeAttemptCode = `import socket,sys\nk=sys.argv[1]\ns=socket.socket(socket.AF_UNIX if k=='unix' else socket.AF_INET,socket.SOCK_STREAM)\ns.settimeout(0.8)\ns.connect('/tmp/qa-writer.sock' if k=='unix' else ('127.0.0.1',18080 if k=='api' else 15432))\ns.sendall(b'W\\n')\nassert s.recv(3)==b'OK\\n'\ns.close()`;
function writeAttempt(kind) { return guestTry(["python3", "-c", writeAttemptCode, kind], 5000); }
function countWrites() {
  return Number(guestRun("COUNT", ["sudo", "sh", "-lc", "test -f /tmp/qa-writer-events && wc -c </tmp/qa-writer-events || echo 0"]));
}
function paused(id) { return docker("INSPECT_PAUSE", ["inspect", id, "--format", "{{.State.Paused}}"]) === "true"; }
function rulePresent(port) { return guestTry(["sudo", "iptables", "-C", "INPUT", "-i", "lo", "-p", "tcp", "--dport", String(port), "-j", "REJECT"]); }

try {
  assert.ok(existsSync(cachedBase), "CACHED_BASE_ABSENT");
  const config = join(scratch, "lima.yaml");
  writeFileSync(config, `vmType: vz\narch: aarch64\nimages:\n  - location: ${cachedBase}\n    arch: aarch64\ncpus: 2\nmemory: 2GiB\ndisk: 6GiB\nmounts: []\nnetworks: []\nportForwards: []\npropagateProxyEnv: false\ncontainerd:\n  system: false\n  user: false\nssh:\n  loadDotSSHPubKeys: false\n  forwardAgent: false\nhostResolver:\n  enabled: false\nprovision: []\n`, { mode: 0o600, flag: "wx" });
  lima("VALIDATE", ["validate", config]);
  created = true;
  lima("START", ["start", "--tty=false", "--name", guest, "--plain", "--mount-none", "--containerd", "none", config], 180000);
  started = true;
  observed.isolated = guestRun("MOUNTS", ["sh", "-lc", "mount | grep -c virtiofs || true"]) === "0" &&
    !guestRun("FORWARDS", ["sh", "-lc", "ss -lntH | grep -E ':(15432|18080) ' || true"]);
  assert.ok(observed.isolated, "GUEST_ISOLATION_FAILED");
  guestRun("DOCKER_START", ["sudo", "systemctl", "start", "docker"]);
  const actualImage = run("SOURCE_IMAGE_INSPECT", "/opt/homebrew/bin/docker",
    ["-H", sourceSocket, "image", "inspect", image, "--format", "{{.Id}}"] ).stdout.trim();
  assert.equal(actualImage, imageId, "CACHED_IMAGE_CHANGED");
  const tar = join(scratch, "image.tar");
  run("SOURCE_IMAGE_SAVE", "/opt/homebrew/bin/docker", ["-H", sourceSocket, "image", "save", "-o", tar, image], { timeout: 120000 });
  lima("COPY_IMAGE", ["copy", "--backend=scp", tar, `${guest}:/tmp/qa-image.tar`], 120000);
  docker("LOAD_IMAGE", ["image", "load", "-i", "/tmp/qa-image.tar"], 120000);
  guestRun("REMOVE_IMAGE_TAR", ["rm", "-f", "/tmp/qa-image.tar"]);
  rmSync(tar);
  const sourceId = run("SOURCE_DAEMON_ID", "/opt/homebrew/bin/docker",
    ["-H", sourceSocket, "info", "--format", "{{.ID}}"] ).stdout.trim();
  assert.notEqual(docker("GUEST_DAEMON_ID", ["info", "--format", "{{.ID}}"]), sourceId);
  for (const file of ["synthetic-writer-server.py", "synthetic-writer-watchdog.sh"])
    lima("COPY_SCRIPT", ["copy", "--backend=scp", join(here, file), `${guest}:/tmp/${file}`], 30000);
  guestRun("START_WRITER", ["sudo", "systemd-run", `--unit=${service.replace(/\.service$/, "")}`,
    "--property=RuntimeMaxSec=80s", "/usr/bin/python3", "/tmp/synthetic-writer-server.py"]);
  assert.ok(await waitFor(() => writeAttempt("api") && writeAttempt("db") && writeAttempt("unix")), "WRITERS_NOT_OPEN");
  const baseline = countWrites();
  observed.baselineWrites = baseline;
  const existingCode = "import socket,time\ns=socket.create_connection(('127.0.0.1',18080)); s.settimeout(1)\nfor _ in range(60):\n try:\n  s.sendall(b'W\\n'); s.recv(3)\n except Exception: break\n time.sleep(0.2)\ns.close()";
  guestRun("START_EXISTING_CLIENT", ["sudo", "systemd-run", `--unit=${client.replace(/\.service$/, "")}`,
    "--property=RuntimeMaxSec=20s", "/usr/bin/python3", "-c", existingCode]);
  observed.existingClientWroteBeforeBarrier = await waitFor(() => countWrites() > baseline + 1);
  assert.ok(observed.existingClientWroteBeforeBarrier, "EXISTING_CLIENT_NOT_ESTABLISHED");
  docker("CREATE_VOLUME", ["volume", "create", volume]);
  for (let n = 0; n < 2; n++) {
    const id = docker("CREATE_MOCK_CONTAINER", ["run", "--detach", "--network", "none", "--pull", "never",
      "--entrypoint", "/bin/sleep", image, "120"], 60000);
    assert.match(id, /^[0-9a-f]{64}$/);
    containers.push(id);
  }
  const daemonBefore = guestRun("DAEMON_PID_BEFORE", ["sudo", "systemctl", "show", "docker.service", "-P", "MainPID"]);
  const restartPolicy = guestRun("RESTART_POLICY", ["sudo", "systemctl", "show", "docker.service", "-p", "Restart", "-p", "StartLimitBurst", "-p", "StartLimitIntervalUSec"]);
  observed.startLimitPolicyObserved = /Restart=always/.test(restartPolicy) && /StartLimitBurst=/.test(restartPolicy);
  assert.ok(observed.startLimitPolicyObserved, "DAEMON_RESTART_POLICY_UNKNOWN");

  // The guest-only barrier stops all pre-existing mock sockets, then rejects
  // new TCP connections. The Unix pathname is checked independently.
  guestRun("STOP_WRITER", ["sudo", "systemctl", "stop", service]);
  for (const port of [18080, 15432]) guestRun("ADD_RULE", ["sudo", "iptables", "-I", "INPUT", "1", "-i", "lo",
    "-p", "tcp", "--dport", String(port), "-j", "REJECT"]);
  const countAtBarrier = countWrites();
  observed.existingAndNewTcpAndUnixDeniedDuringWindow = true;
  for (let n = 0; n < 3; n++) {
    observed.existingAndNewTcpAndUnixDeniedDuringWindow &&=
      !writeAttempt("api") && !writeAttempt("db") && !writeAttempt("unix") && countWrites() === countAtBarrier;
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert.ok(observed.existingAndNewTcpAndUnixDeniedDuringWindow, "WRITER_BARRIER_LEAKED");

  // Deliberate negative proof: root Docker-admin bypasses a network/service-only barrier.
  observed.dockerAdminVolumeBypassObserved = guestTry(["sudo", "docker", "run", "--rm", "--network", "none", "--pull", "never",
    "--volume", `${volume}:/data`, "--entrypoint", "/bin/sh", image, "-c", "printf x >/data/admin-bypass"], 30000);
  observed.dockerAdminVolumeBypassObserved &&= guestTry(["sudo", "docker", "run", "--rm", "--network", "none", "--pull", "never",
    "--volume", `${volume}:/data`, "--entrypoint", "/bin/sh", image, "-c", "test -s /data/admin-bypass"], 30000);
  assert.ok(observed.dockerAdminVolumeBypassObserved, "EXPECTED_ADMIN_BYPASS_NOT_OBSERVED");
  for (const id of containers) docker("PAUSE_MOCK", ["pause", id]);
  assert.ok(containers.every(paused), "MOCK_PAUSE_FAILED");

  guestRun("ARM_WATCHDOG", ["sudo", "systemd-run", `--unit=${watchdog.replace(/\.service$/, "")}`,
    "--on-active=5s", "/bin/sh", "/tmp/synthetic-writer-watchdog.sh", ...containers, service, "15", restoredService]);
  const killResult = run("KILL_DISPOSABLE_DAEMON", "/opt/homebrew/bin/limactl",
    ["shell", "--tty=false", guest, "--", "sudo", "systemctl", "kill", "-s", "KILL", "docker.service"],
    { timeout: 15000, allowFailure: true });
  observed.killCommandExit = killResult.status;
  observed.killCommandDiagnostic = killResult.stderr.trim().slice(-240) || null;
  observed.daemonPidChanged = await waitFor(() => {
    const now = guestRun("DAEMON_PID_AFTER", ["sudo", "systemctl", "show", "docker.service", "-P", "MainPID"]);
    return now !== "0" && now !== daemonBefore;
  }, 40, 300);
  assert.ok(observed.daemonPidChanged, "DAEMON_FAULT_NOT_OBSERVED");
  observed.exactIdsResumedAfterDaemonRestart = await waitFor(() => containers.every(id => !paused(id)), 60, 300);
  observed.guestRulesRemoved = await waitFor(() => !rulePresent(18080) && !rulePresent(15432), 30, 300);
  assert.ok(observed.exactIdsResumedAfterDaemonRestart && observed.guestRulesRemoved, "WATCHDOG_RESUME_FAILED");
  assert.ok(await waitFor(() => writeAttempt("api") && writeAttempt("db") && writeAttempt("unix")), "WRITER_RESTORE_FAILED");

  // Force the watchdog's Docker client to an unavailable socket. It must time
  // out nonzero and reopen guest-only ingress; it cannot unpause in this state.
  for (const port of [18080, 15432]) guestRun("ADD_TIMEOUT_RULE", ["sudo", "iptables", "-I", "INPUT", "1", "-i", "lo",
    "-p", "tcp", "--dport", String(port), "-j", "REJECT"]);
  const failed = run("NONRECOVERY", "/opt/homebrew/bin/limactl", ["shell", "--tty=false", guest, "--",
    "sudo", "env", "DOCKER_HOST=unix:///tmp/qa-no-daemon.sock", "/bin/sh", "/tmp/synthetic-writer-watchdog.sh",
    ...containers, service, "3", restoredService], { timeout: 15000, allowFailure: true });
  observed.nonRecoveryTimeoutFailClosed = failed.status !== 0 && !rulePresent(18080) && !rulePresent(15432);
  assert.ok(observed.nonRecoveryTimeoutFailClosed, "NONRECOVERY_TIMEOUT_NOT_FAIL_CLOSED");
  observed.status = "SYNTHETIC_PARTIAL_PASS_DOCKER_ADMIN_BYPASS_BLOCKS_SOURCE";
} catch (error) {
  observed.reason = String(error.message).slice(0, 160);
  if (started && observed.reason === "WRITERS_NOT_OPEN") {
    try {
      observed.writerServiceState = guestRun("WRITER_SERVICE_STATE", ["sudo", "systemctl", "show", service,
        "-p", "ActiveState", "-p", "Result", "-p", "ExecMainStatus"]);
      observed.writerServiceRecentLog = guestRun("WRITER_SERVICE_LOG", ["sudo", "journalctl", "-u", service,
        "-n", "8", "--no-pager", "--output=cat"]).slice(-800);
      observed.writerProbeErrors = ["api", "db", "unix"].map(kind => {
        const probe = run("PROBE_DIAGNOSTIC", "/opt/homebrew/bin/limactl",
          ["shell", "--tty=false", guest, "--", "python3", "-c", writeAttemptCode, kind],
          { timeout: 5000, allowFailure: true });
        return { kind, status: probe.status, stderr: probe.stderr.slice(-300) };
      });
    } catch { /* cleanup still takes priority */ }
  }
  if (started && observed.reason === "EXISTING_CLIENT_NOT_ESTABLISHED") {
    try {
      observed.writesAfterClient = countWrites();
      observed.writerServiceState = guestRun("CLIENT_SERVICE_STATE", ["sudo", "systemctl", "show", client,
        "-p", "ActiveState", "-p", "Result", "-p", "ExecMainStatus"]);
      observed.writerServiceRecentLog = guestRun("CLIENT_SERVICE_LOG", ["sudo", "journalctl", "-u", client,
        "-n", "8", "--no-pager", "--output=cat"]).slice(-800);
    } catch { /* cleanup still takes priority */ }
  }
} finally {
  if (started) {
    for (const port of [18080, 15432]) guestTry(["sudo", "iptables", "-D", "INPUT", "-i", "lo", "-p", "tcp", "--dport", String(port), "-j", "REJECT"]);
    guestTry(["sudo", "systemctl", "stop", client]);
    guestTry(["sudo", "systemctl", "stop", service]);
    guestTry(["sudo", "systemctl", "stop", restoredService]);
    for (const id of containers) {
      guestTry(["sudo", "docker", "unpause", id]);
      guestTry(["sudo", "docker", "stop", "--time", "1", id]);
    }
    guestTry(["sudo", "docker", "volume", "rm", volume]);
    if (limaTry(["stop", guest]) || limaTry(["stop", "--force", guest])) started = false;
  }
  if (created && !started) {
    if ((limaTry(["delete", guest]) || limaTry(["delete", "--force", guest])) && scratch.startsWith(scratchPrefix)) {
      rmSync(scratch, { recursive: true });
      observed.allScratchCleaned = true;
    }
  }
  if (!created && scratch.startsWith(scratchPrefix)) {
    rmSync(scratch, { recursive: true });
    observed.allScratchCleaned = true;
  }
  console.log(JSON.stringify(observed));
  // The full source gate deliberately fails while Docker-admin bypass exists.
  process.exitCode = 1;
}
