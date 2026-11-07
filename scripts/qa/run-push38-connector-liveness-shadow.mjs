// Isolated, no-camera Connector liveness qualification for the signed PUSH 38
// candidate. It exercises the bounded event-workspace reaper for longer than
// the prior live rollback window without touching the installed runtime,
// credentials, HOME_QA rollout, cloud, camera, or service-manager state.
import { execFileSync, spawn } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from
  "../../services/video-gateway/edge-update-contract.mjs";
import { loadPinnedEdgeReleaseKeys, PROTECTED_EDGE_TRUST_REGISTRY_PATH } from
  "../../services/video-gateway/edge-release-trust.mjs";
import { PUSH38_CONNECTOR_LIVENESS_ISOLATION as item } from
  "../../services/video-gateway/push38-home-qa-connector-liveness-isolation.mjs";

const restrictedRoot = `${realpathSync(
  "/Volumes/DIGITAL_OBSERVER/Projects/Gan-Batuach/exports/restricted")}/`;
const artifactPath = `${restrictedRoot}push38-connector-liveness-isolation-82a871d5/connector-remediation.tar.gz`;
const bundlePath = `${restrictedRoot}push38-connector-liveness-isolation-82a871d5/signed-bundle/signed-manifest-bundle.zip`;
const outputPath = resolve(process.env.CONNECTOR_LIVENESS_SHADOW_OUTPUT || ".");
const durationMs = Number(process.env.CONNECTOR_LIVENESS_SHADOW_DURATION_MS || 31 * 60_000);
const port = Number(process.env.CONNECTOR_LIVENESS_SHADOW_PORT || 18085);
if (!outputPath.startsWith(restrictedRoot) || existsSync(outputPath) ||
  !Number.isFinite(durationMs) || durationMs < 30 * 60_000 || durationMs > 35 * 60_000 ||
  !Number.isInteger(port) || port < 1024 || port > 65535 || [18082, 18083, 18084].includes(port)) {
  throw new Error("P38_CONNECTOR_LIVENESS_SHADOW_INPUT_INVALID");
}

function service() {
  const text = execFileSync("/bin/launchctl", ["print",
    `gui/${process.getuid()}/com.ganbatuach.software-connector.tapo`],
  { encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"] });
  return { running: text.includes("state = running"),
    pid: Number(/\bpid = (\d+)/.exec(text)?.[1] || 0) || null };
}
function persist(value) {
  mkdirSync(dirname(outputPath), { recursive: true, mode: 0o700 });
  const temporary = `${outputPath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  renameSync(temporary, outputPath);
  chmodSync(outputPath, 0o600);
}
async function sample(base, path, timeoutMs = 2_000) {
  const startedAt = performance.now();
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(timeoutMs) });
  const body = await response.json();
  return { http: response.status, latency_ms: Number((performance.now() - startedAt).toFixed(3)),
    ok: body.ok === true, status: body.status || null,
    event_loop_max_ms: body.eventLoop?.delay_max_ms ?? null,
    event_loop_p99_ms: body.eventLoop?.delay_p99_ms ?? null,
    uptime_ms: body.uptime_ms ?? null };
}
const sleep = ms => new Promise(resolveWait => setTimeout(resolveWait, ms));

for (const path of [artifactPath, bundlePath]) {
  const info = lstatSync(path);
  if (!info.isFile() || info.isSymbolicLink() || (statSync(path).mode & 0o077) !== 0)
    throw new Error("P38_CONNECTOR_LIVENESS_SHADOW_PROTECTED_INPUT_REQUIRED");
}
const manifest = JSON.parse(execFileSync("unzip", ["-p", bundlePath,
  "connector_remediation_liveness_isolation.json"],
{ encoding: "utf8", timeout: 15_000, maxBuffer: 16_384 }));
const artifact = readFileSync(artifactPath);
const trusted = loadPinnedEdgeReleaseKeys({
  registryPath: PROTECTED_EDGE_TRUST_REGISTRY_PATH }).trustedPublicKeys;
if (!verifyEdgeUpdateManifest(manifest, trusted).ok || !verifyEdgeArtifact(artifact, manifest).ok ||
  manifest.release_id !== item.releaseId || manifest.artifact_sha256 !== item.digest ||
  manifest.artifact_size !== item.size || manifest.profile !== item.profile) {
  throw new Error("P38_CONNECTOR_LIVENESS_SHADOW_SIGNED_RELEASE_INVALID");
}

const extractRoot = mkdtempSync(join(tmpdir(), "observer-p38-connector-liveness-shadow-"));
const isolatedTmp = mkdtempSync(join(tmpdir(), "observer-p38-connector-liveness-tmp-"));
const hlsRoot = mkdtempSync(join(isolatedTmp, "observer-p38-connector-shadow-hls-"));
let child;
let childOutput = { stdout: "", stderr: "" };
const owned = [];
const serviceBefore = service();
const startedAt = Date.now();
const evidence = {
  protocol: "observer-push38-connector-liveness-shadow-v1",
  started_at: new Date(startedAt).toISOString(),
  target_duration_ms: durationMs,
  mode: "ISOLATED_LOOPBACK_NO_CAMERA_NO_CLOUD",
  signed_release: { release_id: manifest.release_id, version: manifest.version,
    build_sha: manifest.build_sha, artifact_sha256: manifest.artifact_sha256,
    artifact_size: manifest.artifact_size, signing_key_id: manifest.signing_key_id,
    signature_verified: true, artifact_verified: true },
  bounded_workspace_entries: 100,
  camera_sessions_opened: 0,
  cloud_requests_enabled: false,
  credentials_loaded: false,
  installed_runtime_writes: 0,
  service_before: serviceBefore,
  checkpoints: []
};

try {
  execFileSync("tar", ["-xzf", artifactPath, "-C", extractRoot],
    { timeout: 120_000, stdio: "ignore" });
  const app = realpathSync(join(extractRoot, "Digital Observer.app"));
  const runtime = realpathSync(join(app, "Contents/Resources/runtime"));
  const node = realpathSync(join(app, "Contents/Resources/bin/node"));
  const bin = realpathSync(join(app, "Contents/Resources/bin"));
  const workspaceModule = await import(pathToFileURL(join(runtime,
    "services/video-gateway/event-capture-workspace.mjs")));
  const workspaceRoot = join(isolatedTmp, "gan-batuach-event-capture-workspaces-v1");
  const workspace = workspaceModule.createEventCaptureWorkspace({ root: workspaceRoot });
  for (let index = 0; index < evidence.bounded_workspace_entries; index += 1) {
    owned.push(workspace.create());
  }
  child = spawn(node, [join(runtime, "services/video-gateway/server.mjs")], {
    cwd: runtime,
    env: { PATH: `${bin}:/usr/bin:/bin:/usr/sbin:/sbin`, HOME: homedir(), TMPDIR: isolatedTmp,
      HOST: "127.0.0.1", VIDEO_GATEWAY_PORT: String(port), VIDEO_GATEWAY_SHADOW_MODE: "1",
      VIDEO_GATEWAY_SHADOW_HLS_ROOT: hlsRoot, OBSERVER_EDGE_DEVICE_TYPE: "SOFTWARE_CONNECTOR",
      OBSERVER_EDGE_VERSION: item.version, OBSERVER_EDGE_BUILD_SHA: item.buildSha,
      GAN_BATUACH_GATEWAY_DISCOVERY: "0", DVR_EXPECTED_CHANNEL_COUNT: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const capture = (stream, key) => stream.on("data", chunk => {
    childOutput[key] = `${childOutput[key]}${String(chunk)}`.slice(-32_768);
  });
  capture(child.stdout, "stdout");
  capture(child.stderr, "stderr");
  const base = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if ((await sample(base, "/health/live").catch(() => null))?.http === 200) break;
    await sleep(250);
  }
  if ((await sample(base, "/health/live").catch(() => null))?.http !== 200)
    throw new Error("P38_CONNECTOR_LIVENESS_SHADOW_START_FAILED");

  let sequence = 0;
  while (Date.now() - startedAt < durationMs) {
    const point = { sequence: ++sequence, observed_at: new Date().toISOString(),
      elapsed_ms: Date.now() - startedAt,
      liveness: await sample(base, "/health/live").catch(error => ({ http: 0,
        error: String(error?.name || "LIVENESS_FAILED") })) };
    if (sequence === 1 || sequence % 30 === 0) {
      point.health = await sample(base, "/health", 4_000).catch(error => ({ http: 0,
        error: String(error?.name || "HEALTH_FAILED") }));
      point.live_connector = await sample("http://127.0.0.1:18083", "/health", 6_000)
        .catch(error => ({ http: 0, error: String(error?.name || "LIVE_HEALTH_FAILED") }));
      process.stdout.write(`${JSON.stringify({ sequence: point.sequence,
        elapsed_ms: point.elapsed_ms, shadow: point.health, live: point.live_connector })}\n`);
    }
    evidence.checkpoints.push(point);
    if (sequence === 1 || sequence % 30 === 0) persist(evidence);
    if (point.liveness.http !== 200 || point.liveness.ok !== true || point.liveness.latency_ms > 2_000)
      throw new Error("P38_CONNECTOR_LIVENESS_SHADOW_CHECKPOINT_FAILED");
    await sleep(1_000);
  }
  const serviceAfter = service();
  const liveness = evidence.checkpoints.map(point => point.liveness.latency_ms);
  const health = evidence.checkpoints.filter(point => point.health);
  evidence.ended_at = new Date().toISOString();
  evidence.duration_ms = Date.now() - startedAt;
  evidence.summary = { checkpoints: evidence.checkpoints.length,
    liveness_failures: evidence.checkpoints.filter(point => point.liveness.http !== 200).length,
    health_failures: health.filter(point => point.health.http !== 200).length,
    maximum_liveness_latency_ms: Math.max(...liveness),
    maximum_health_latency_ms: Math.max(...health.map(point => point.health.latency_ms || 0)),
    service_after: serviceAfter };
  evidence.result = evidence.duration_ms >= 30 * 60_000 && evidence.summary.liveness_failures === 0 &&
    evidence.summary.health_failures === 0 && serviceBefore.running && serviceAfter.running &&
    serviceBefore.pid === serviceAfter.pid && child.exitCode === null ? "PASS" : "FAIL";
  persist(evidence);
  console.log(JSON.stringify({ result: evidence.result, duration_ms: evidence.duration_ms,
    checkpoints: evidence.summary.checkpoints,
    maximum_liveness_latency_ms: evidence.summary.maximum_liveness_latency_ms,
    installed_connector_pid_unchanged: serviceBefore.pid === serviceAfter.pid,
    output: outputPath }));
  if (evidence.result !== "PASS") process.exitCode = 1;
} catch (error) {
  evidence.ended_at = new Date().toISOString();
  evidence.duration_ms = Date.now() - startedAt;
  evidence.result = "FAIL";
  evidence.failure = String(error?.message || "P38_CONNECTOR_LIVENESS_SHADOW_FAILED")
    .replace(/(?:https?|rtsp):\/\/\S+/gi, "[private-source]");
  evidence.child = Object.fromEntries(Object.entries(childOutput).map(([key, value]) => [key,
    value.replace(/(?:https?|rtsp):\/\/\S+/gi, "[private-source]")
      .replace(/[A-Za-z0-9_-]{32,}/g, "[redacted]")]));
  persist(evidence);
  console.error(/^P38_CONNECTOR_LIVENESS_SHADOW_[A-Z0-9_]+$/.test(error?.message || "")
    ? error.message : "P38_CONNECTOR_LIVENESS_SHADOW_FAILED");
  process.exitCode = 1;
} finally {
  if (child?.exitCode === null && !child.killed) child.kill("SIGTERM");
  await sleep(500);
  rmSync(extractRoot, { recursive: true, force: true });
  rmSync(isolatedTmp, { recursive: true, force: true });
  artifact.fill(0);
}
