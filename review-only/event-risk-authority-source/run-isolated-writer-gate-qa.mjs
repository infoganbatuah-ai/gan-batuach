#!/usr/bin/env node
// Disposable, synthetic-only control/ingress experiment. Never touches gbi services.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const scratchPrefix = "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/.wg.";
const scratch = mkdtempSync(scratchPrefix);
// Lima's socket path is limited to 104 bytes; keep the real VM disk on Kingston.
const limaHome = scratch;
const guest = `g${process.pid}`;
const cachedBase = "/Volumes/DIGITAL_OBSERVER/Development/gan-batuach/cache/caches/b0992ab88f5a3c0c436bbb3065c01466f20dc1dd0eb0a60299d410176f21a1c3";
const sourceSocket = "unix:///Volumes/DIGITAL_OBSERVER/Development/gan-batuach/colima/gbi/docker.sock";
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const imageId = "sha256:6942962433a569e87f228b4d4ab7e11db5deca64e43babb3a038443ad6c4f1bb";
const evidence = { status: "BLOCKED", reason: null, syntheticOnly: true,
  noHostMounts: false, noPortForwards: false, distinctDockerDaemon: false,
  primaryClientSocketFailure: false, guestTimerAutoUnpaused: false,
  apiAndDbPortsInitiallyOpen: false, apiAndDbPortsDeniedThroughoutWindow: false,
  apiAndDbPortsReopenedAfterRollback: false, scratchCleaned: false };
let started = false;
let created = false;
let container = null;

function run(bin, args, { env, timeout = 30000, allowFailure = false } = {}) {
  const result = spawnSync(bin, args, { encoding: "utf8", timeout,
    env: env ? { ...process.env, ...env } : process.env, maxBuffer: 1_000_000 });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) throw new Error(`${bin.split("/").at(-1)}_EXIT_${result.status}: ${(result.stderr || "").trim().slice(0, 500)}`);
  return result;
}
const env = { LIMA_HOME: limaHome };
function lima(args, timeout) { return run("/opt/homebrew/bin/limactl", args, { env, timeout }); }
function guestRun(args, timeout) { return lima(["shell", "--tty=false", guest, "--", ...args], timeout); }
function guestTry(args, timeout = 10000) {
  return run("/opt/homebrew/bin/limactl", ["shell", "--tty=false", guest, "--", ...args],
    { env, timeout, allowFailure: true }).status === 0;
}
function guestDocker(args, timeout) { return guestRun(["sudo", "docker", ...args], timeout); }
function portOpen(port) {
  return guestTry(["python3", "-c", "import socket,sys; s=socket.socket(); s.settimeout(1); x=s.connect_ex(('127.0.0.1',int(sys.argv[1]))); s.close(); sys.exit(0 if x==0 else 1)", String(port)]);
}
async function waitFor(test, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    if (test()) return true;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  return false;
}

try {
  assert.ok(existsSync(cachedBase), "CACHED_LOCAL_BASE_MISSING");
  const config = join(scratch, "lima.yaml");
  writeFileSync(config, `vmType: vz\narch: aarch64\nimages:\n  - location: ${cachedBase}\n    arch: aarch64\ncpus: 2\nmemory: 2GiB\ndisk: 6GiB\nmounts: []\nnetworks: []\nportForwards: []\npropagateProxyEnv: false\ncontainerd:\n  system: false\n  user: false\nssh:\n  loadDotSSHPubKeys: false\n  forwardAgent: false\nhostResolver:\n  enabled: false\nprovision: []\n`,
    { mode: 0o600, flag: "wx" });
  lima(["validate", config]);
  created = true;
  lima(["start", "--tty=false", "--name", guest, "--plain", "--mount-none", "--containerd", "none", config], 180000);
  started = true;
  evidence.noHostMounts = guestRun(["sh", "-lc", "mount | grep -c virtiofs || true"]).stdout.trim() === "0";
  evidence.noPortForwards = !guestRun(["sh", "-lc", "ss -lntH | grep -E ':(15432|18080) ' || true"]).stdout.trim();
  assert.ok(evidence.noHostMounts && evidence.noPortForwards, "SCRATCH_ISOLATION_FAILED");
  guestRun(["sudo", "systemctl", "start", "docker"], 30000);
  const sourceId = run("/opt/homebrew/bin/docker", ["-H", sourceSocket, "image", "inspect", image,
    "--format", "{{.Id}}"], { timeout: 30000 }).stdout.trim();
  assert.equal(sourceId, imageId, "CACHED_IMAGE_CHANGED");
  const imageTar = join(scratch, "image.tar");
  run("/opt/homebrew/bin/docker", ["-H", sourceSocket, "image", "save", "-o", imageTar, image],
    { timeout: 120000 });
  lima(["copy", "--backend=scp", imageTar, `${guest}:/tmp/writer-gate-image.tar`], 120000);
  guestDocker(["image", "load", "-i", "/tmp/writer-gate-image.tar"], 120000);
  guestRun(["rm", "-f", "/tmp/writer-gate-image.tar"]);
  rmSync(imageTar);
  evidence.distinctDockerDaemon = guestDocker(["info", "--format", "{{.ID}}"]).stdout.trim() !==
    run("/opt/homebrew/bin/docker", ["-H", sourceSocket, "info", "--format", "{{.ID}}"],
      { timeout: 30000 }).stdout.trim();
  assert.ok(evidence.distinctDockerDaemon, "SCRATCH_DOCKER_NOT_DISTINCT");
  container = guestDocker(["run", "--detach", "--network", "none", "--pull", "never",
    "--entrypoint", "/bin/sleep", image, "120"], 60000).stdout.trim();
  assert.match(container, /^[0-9a-f]{64}$/);
  assert.equal(guestDocker(["inspect", container, "--format", "{{.HostConfig.NetworkMode}}"]).stdout.trim(), "none");
  guestRun(["sudo", "systemd-run", `--unit=qa-resume-${process.pid}`, "--on-active=5s",
    "/usr/bin/docker", "unpause", container]);
  guestDocker(["pause", container]);
  assert.equal(guestDocker(["inspect", container, "--format", "{{.State.Paused}}"]).stdout.trim(), "true");
  evidence.primaryClientSocketFailure = run("/opt/homebrew/bin/docker", ["-H",
    `unix://${join(scratch, "nonexistent-docker.sock")}`, "inspect", container],
  { timeout: 5000, allowFailure: true }).status !== 0;
  assert.ok(evidence.primaryClientSocketFailure, "PRIMARY_CLIENT_FAILURE_NOT_SIMULATED");
  evidence.guestTimerAutoUnpaused = await waitFor(() =>
    guestDocker(["inspect", container, "--format", "{{.State.Paused}}"]).stdout.trim() === "false", 40);
  assert.ok(evidence.guestTimerAutoUnpaused, "GUEST_TIMER_DID_NOT_AUTO_RESUME");
  guestDocker(["stop", "--time", "1", container]);
  container = null;

  guestRun(["sudo", "systemd-run", `--unit=qa-api-${process.pid}`, "--property=RuntimeMaxSec=45s",
    "/usr/bin/python3", "-m", "http.server", "18080", "--bind", "127.0.0.1", "--directory", "/tmp"]);
  guestRun(["sudo", "systemd-run", `--unit=qa-db-${process.pid}`, "--property=RuntimeMaxSec=45s",
    "/usr/bin/python3", "-m", "http.server", "15432", "--bind", "127.0.0.1", "--directory", "/tmp"]);
  evidence.apiAndDbPortsInitiallyOpen = await waitFor(() => portOpen(18080) && portOpen(15432));
  assert.ok(evidence.apiAndDbPortsInitiallyOpen, "SYNTHETIC_PORTS_NOT_OPEN");
  for (const port of [18080, 15432]) guestRun(["sudo", "iptables", "-I", "INPUT", "1", "-i", "lo",
    "-p", "tcp", "--dport", String(port), "-j", "REJECT"]);
  evidence.apiAndDbPortsDeniedThroughoutWindow = true;
  for (let i = 0; i < 3; i++) {
    evidence.apiAndDbPortsDeniedThroughoutWindow &&= !portOpen(18080) && !portOpen(15432);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  assert.ok(evidence.apiAndDbPortsDeniedThroughoutWindow, "SYNTHETIC_NEW_CLIENT_NOT_BLOCKED");
  for (const port of [18080, 15432]) guestRun(["sudo", "iptables", "-D", "INPUT", "-i", "lo",
    "-p", "tcp", "--dport", String(port), "-j", "REJECT"]);
  evidence.apiAndDbPortsReopenedAfterRollback = portOpen(18080) && portOpen(15432);
  assert.ok(evidence.apiAndDbPortsReopenedAfterRollback, "SYNTHETIC_ROLLBACK_FAILED");
  evidence.status = "SYNTHETIC_PASS_REAL_GBI_NOT_TESTED";
} catch (error) {
  evidence.reason = String(error.message).slice(0, 600);
} finally {
  if (started) {
    if (container) guestTry(["sudo", "docker", "unpause", container]);
    if (container) guestTry(["sudo", "docker", "stop", "--time", "1", container]);
    guestTry(["sudo", "systemctl", "stop", `qa-api-${process.pid}.service`]);
    guestTry(["sudo", "systemctl", "stop", `qa-db-${process.pid}.service`]);
    const stop = run("/opt/homebrew/bin/limactl", ["stop", guest],
      { env, timeout: 60000, allowFailure: true });
    if (stop.status === 0) started = false;
  }
  if (created && !started) {
    const del = run("/opt/homebrew/bin/limactl", ["delete", guest],
      { env, timeout: 60000, allowFailure: true });
    if (del.status === 0 && scratch.startsWith(scratchPrefix)) {
      rmSync(scratch, { recursive: true });
      evidence.scratchCleaned = true;
    }
  }
  if (!created && scratch.startsWith(scratchPrefix)) {
    rmSync(scratch, { recursive: true });
    evidence.scratchCleaned = true;
  }
  console.log(JSON.stringify(evidence));
  if (evidence.status !== "SYNTHETIC_PASS_REAL_GBI_NOT_TESTED" || !evidence.scratchCleaned) process.exitCode = 1;
}
