import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { evaluateQualificationHostReadiness,
  inspectQualificationHost } from "./qualification-host-readiness.mjs";
import { probeLocalHealth } from "./soak-health-probe.mjs";
import { assertQualificationFailureGate, assertQualificationRunStart,
  assertQualificationServiceAvailable, buildQualificationFailureBlocker,
  sha256File } from "./qualification-run-guard.mjs";

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const action = String(args.get("action") || "status");
const evidenceRoot = resolve(String(args.get("output-dir") || ""));
if (!args.get("output-dir")) throw new Error("durable_soak_output_dir_required");
const stage = String(args.get("stage") || "PRE_SOAK").toUpperCase();
if (!new Set(["CANARY", "PRE_SOAK", "V8"]).has(stage)) throw new Error("durable_soak_stage_invalid");
const runId = String(args.get("run-id") || evidenceRoot.split("/").at(-1)).replace(/[^a-zA-Z0-9._-]/g, "");
if (!runId) throw new Error("durable_soak_run_id_invalid");
const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const qualificationRoot = join(homedir(), "Library", "Application Support", "Digital Observer",
  "push38-qualification");
const outputRoot = join(qualificationRoot, runId);
const runtimeRoot = join(outputRoot, "runtime");
const runtimeFiles = Object.freeze([
  "scripts/qa/run-real-home-soak.mjs",
  "scripts/qa/soak-health-probe.mjs",
  "scripts/qa/qualification-host-readiness.mjs",
  "scripts/qa/qualification-run-guard.mjs",
  "scripts/qa/measure-real-home-ai-routing.mjs",
  "lib/domain/digital-observer/reliability-qualification.mjs",
  "lib/domain/digital-observer/qualification-monitor-lifecycle.mjs",
  "services/video-gateway/ai-job-contract.mjs",
  "services/video-gateway/durable-ai-job-queue.mjs",
  "services/video-gateway/portable-inference-worker.mjs",
  "services/video-gateway/ai-routing-policy.mjs",
  "services/video-gateway/object-inference-client.mjs",
  "services/video-gateway/preprocessing-policy.mjs"
]);
const statePath = join(outputRoot, "state.json");
const resultPath = join(outputRoot, "result.json");
const controllerPath = join(outputRoot, "launchd-controller.json");
const evidencePlistPath = join(outputRoot, "qualification-monitor.plist");
const failureBlockerPath = join(qualificationRoot, "active-failure-blocker.json");
const runFailureBlockerPath = join(outputRoot, "failure-blocker.json");
const labelSuffix = createHash("sha256").update(`${repositoryRoot}:${runId}`).digest("hex").slice(0, 12);
const label = `com.ganbatuach.push38.qualification.${labelSuffix}`;
const activePlistPath = join(homedir(), "Library", "LaunchAgents", `${label}.plist`);
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const evidenceFiles = ["state.json", "result.json", "checkpoints.ndjson", "launchd-controller.json",
  "qualification-monitor.plist", "runtime-bundle.json", "monitor.stdout.log", "monitor.stderr.log",
  "failure-blocker.json"];
const syncEvidence = () => {
  mkdirSync(evidenceRoot, { recursive: true, mode: 0o700 });
  for (const name of evidenceFiles) {
    const source = join(outputRoot, name), destination = join(evidenceRoot, name);
    if (!existsSync(source)) continue;
    copyFileSync(source, destination);
    chmodSync(destination, 0o600);
  }
};
const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const readJson = path => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
const atomicJson = (path, value) => {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
};
const buildRuntimeBundle = () => {
  const files = runtimeFiles.map(relativePath => {
    const source = join(repositoryRoot, relativePath), destination = join(runtimeRoot, relativePath);
    mkdirSync(resolve(destination, ".."), { recursive: true, mode: 0o700 });
    copyFileSync(source, destination);
    chmodSync(destination, 0o600);
    return { path: relativePath,
      sha256: createHash("sha256").update(readFileSync(destination)).digest("hex") };
  });
  const manifest = { contract: "observer-durable-qualification-runtime-bundle-v1",
    created_at: new Date().toISOString(), files };
  writeFileSync(join(outputRoot, "runtime-bundle.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  return manifest;
};
const serviceState = () => {
  try {
    const output = execFileSync("/bin/launchctl", ["print", service], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return {
      loaded: true,
      running: /\bstate = running\b/.test(output),
      pid: Number(/\bpid = (\d+)/.exec(output)?.[1] || 0) || null,
      last_exit_code: Number(/\blast exit code = (-?\d+)/.exec(output)?.[1] || 0)
    };
  } catch {
    return { loaded: false, running: false, pid: null, last_exit_code: null };
  }
};
const summary = () => ({
  contract: "observer-durable-qualification-monitor-v1",
  label,
  service,
  stage,
  run_id: runId,
  output_root: outputRoot,
  evidence_root: evidenceRoot,
  launchd: serviceState(),
  active_failure_blocker: readJson(failureBlockerPath),
  state: readJson(statePath),
  result: readJson(resultPath)
});

if (action === "seal-failure") {
  mkdirSync(qualificationRoot, { recursive: true, mode: 0o700 });
  syncEvidence();
  const blocker = buildQualificationFailureBlocker({ runId, stage, resultPath,
    checkpointsPath: join(outputRoot, "checkpoints.ndjson") });
  const existing = readJson(failureBlockerPath);
  if (existing && existing.failed_run?.run_id !== runId)
    throw new Error("durable_soak_unresolved_failure_blocker_exists");
  atomicJson(runFailureBlockerPath, blocker);
  atomicJson(failureBlockerPath, blocker);
  syncEvidence();
  console.log(JSON.stringify({ status: "FAILURE_SEALED", blocker,
    blocker_path: failureBlockerPath }, null, 2));
  process.exit(0);
}

if (action === "status") {
  const value = summary();
  syncEvidence();
  console.log(JSON.stringify(value, null, 2));
  process.exit(0);
}
if (action === "cleanup") {
  if (serviceState().loaded) execFileSync("/bin/launchctl", ["bootout", service], { stdio: "pipe" });
  syncEvidence();
  if (existsSync(activePlistPath)) unlinkSync(activePlistPath);
  console.log(JSON.stringify(summary(), null, 2));
  process.exit(0);
}
if (action !== "start" && action !== "dry-run") throw new Error("durable_soak_action_invalid");
assertQualificationServiceAvailable(serviceState());
const runGuard = assertQualificationRunStart({ outputRoot, runId,
  resume: Boolean(args.get("resume")),
  expectedStartedAt: args.get("resume-started-at") || null,
  expectedSequence: args.get("resume-sequence") || null });
let failureClosureGate = null;
if (existsSync(failureBlockerPath)) {
  const closurePath = args.get("failure-closure")
    ? resolve(String(args.get("failure-closure"))) : null;
  const closure = closurePath ? readJson(closurePath) : null;
  const candidateSha = execFileSync("/usr/bin/git", ["rev-parse", "HEAD"], {
    cwd: repositoryRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  failureClosureGate = { ...assertQualificationFailureGate({
    blocker: readJson(failureBlockerPath),
    closure, stage, candidateSha }),
    ...(closurePath ? { closure_path: closurePath,
      closure_sha256: sha256File(closurePath) } : {}), candidate_sha: candidateSha };
  try {
    execFileSync("/usr/bin/git", ["merge-base", "--is-ancestor",
      closure.fix.commit_sha, candidateSha], {
      cwd: repositoryRoot, stdio: ["ignore", "ignore", "ignore"] });
  } catch {
    throw new Error("durable_soak_failure_closure_fix_not_in_candidate");
  }
}
const hostReadinessSamples = [];
for (let sampleIndex = 0; sampleIndex < 5; sampleIndex += 1) {
  const [host, gateway, connector] = await Promise.all([
    inspectQualificationHost(), probeLocalHealth(18082), probeLocalHealth(18083)
  ]);
  hostReadinessSamples.push({ host,
    gateway: { ok: gateway.ok, latency_ms: gateway.latency_ms,
      status: gateway.body?.status ?? null,
      authorization: gateway.body?.deviceAuthorization?.status ?? null },
    connector: { ok: connector.ok, latency_ms: connector.latency_ms,
      status: connector.body?.status ?? null,
      authorization: connector.body?.deviceAuthorization?.status ?? null } });
  if (sampleIndex < 4) await new Promise(resolveWait => setTimeout(resolveWait, 1_000));
}
const hostReadiness = evaluateQualificationHostReadiness(hostReadinessSamples);
if (hostReadiness.status !== "PASS") {
  const error = new Error("durable_soak_host_readiness_failed");
  error.cause = hostReadiness;
  console.error(JSON.stringify(hostReadiness, null, 2));
  throw error;
}
mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
const runtimeBundle = buildRuntimeBundle();
const forwarded = [
  `--stage=${stage}`,
  `--run-id=${runId}`,
  `--output-dir=${outputRoot}`,
  args.get("duration-ms") ? `--duration-ms=${args.get("duration-ms")}` : null,
  args.get("interval-ms") ? `--interval-ms=${args.get("interval-ms")}` : null,
  args.get("deep-probe-ms") ? `--deep-probe-ms=${args.get("deep-probe-ms")}` : null,
  args.get("dvr-upstream-unavailable") ? `--dvr-upstream-unavailable=${args.get("dvr-upstream-unavailable")}` : null,
  args.get("dvr-source-available") ? `--dvr-source-available=${args.get("dvr-source-available")}` : null,
  args.get("resume") ? "--resume" : null,
  args.get("resume-started-at") ? `--resume-started-at=${args.get("resume-started-at")}` : null,
  args.get("resume-sequence") ? `--resume-sequence=${args.get("resume-sequence")}` : null
].filter(Boolean);
const programArguments = ["/usr/bin/caffeinate", "-ims", process.execPath,
  join(runtimeRoot, "scripts/qa/run-real-home-soak.mjs"), ...forwarded];
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>${programArguments.map(value => `<string>${xml(value)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${xml(outputRoot)}</string>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${xml(join(outputRoot, "monitor.stdout.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(outputRoot, "monitor.stderr.log"))}</string>
<key>ThrottleInterval</key><integer>10</integer>
</dict></plist>\n`;
writeFileSync(evidencePlistPath, plist, { mode: 0o600 });
const controller = {
  contract: "observer-durable-qualification-monitor-controller-v1",
  action,
  created_at: new Date().toISOString(),
  owner: "PUSH_38_QUALIFICATION",
  execution_owner: "MACOS_LAUNCHD_USER_DOMAIN",
  terminal_session_independent: true,
  auto_restart: false,
  sleep_assertion: "CAFFEINATE_IDLE_DISK_AC_POWER",
  host_readiness: hostReadiness,
  run_guard: runGuard,
  failure_closure_gate: failureClosureGate,
  label,
  service,
  stage,
  run_id: runId,
  output_root: outputRoot,
  evidence_root: evidenceRoot,
  program_arguments: programArguments,
  runtime_bundle: runtimeBundle,
  plist_path: activePlistPath,
  evidence_plist_path: evidencePlistPath,
  shutdown: `launchctl bootout ${service}`
};
writeFileSync(controllerPath, `${JSON.stringify(controller, null, 2)}\n`, { mode: 0o600 });
if (action === "dry-run") {
  syncEvidence();
  console.log(JSON.stringify({ ...controller, status: "DRY_RUN_PASS" }, null, 2));
  process.exit(0);
}
mkdirSync(join(homedir(), "Library", "LaunchAgents"), { recursive: true, mode: 0o700 });
writeFileSync(activePlistPath, plist, { mode: 0o600 });
execFileSync("/bin/launchctl", ["bootstrap", domain, activePlistPath], { stdio: "pipe" });
syncEvidence();
console.log(JSON.stringify({ ...controller, status: "STARTED", launchd: serviceState() }, null, 2));
