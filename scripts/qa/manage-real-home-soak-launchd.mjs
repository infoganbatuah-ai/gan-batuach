import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";

const args = new Map(process.argv.slice(2).map(value => {
  const [key, ...rest] = value.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const action = String(args.get("action") || "status");
const outputRoot = resolve(String(args.get("output-dir") || ""));
if (!args.get("output-dir")) throw new Error("durable_soak_output_dir_required");
const stage = String(args.get("stage") || "PRE_SOAK").toUpperCase();
if (!new Set(["CANARY", "PRE_SOAK", "V8"]).has(stage)) throw new Error("durable_soak_stage_invalid");
const runId = String(args.get("run-id") || outputRoot.split("/").at(-1)).replace(/[^a-zA-Z0-9._-]/g, "");
if (!runId) throw new Error("durable_soak_run_id_invalid");
const repositoryRoot = resolve(new URL("../..", import.meta.url).pathname);
const statePath = join(outputRoot, "state.json");
const resultPath = join(outputRoot, "result.json");
const controllerPath = join(outputRoot, "launchd-controller.json");
const plistPath = join(outputRoot, "qualification-monitor.plist");
const labelSuffix = createHash("sha256").update(`${repositoryRoot}:${runId}`).digest("hex").slice(0, 12);
const label = `com.ganbatuach.push38.qualification.${labelSuffix}`;
const domain = `gui/${process.getuid()}`;
const service = `${domain}/${label}`;
const xml = value => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
const readJson = path => existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : null;
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
  launchd: serviceState(),
  state: readJson(statePath),
  result: readJson(resultPath)
});

if (action === "status") {
  console.log(JSON.stringify(summary(), null, 2));
  process.exit(0);
}
if (action === "cleanup") {
  if (serviceState().loaded) execFileSync("/bin/launchctl", ["bootout", service], { stdio: "pipe" });
  console.log(JSON.stringify(summary(), null, 2));
  process.exit(0);
}
if (action !== "start" && action !== "dry-run") throw new Error("durable_soak_action_invalid");
if (existsSync(resultPath)) throw new Error("durable_soak_terminal_result_exists");
if (serviceState().loaded) throw new Error("durable_soak_service_already_loaded");
mkdirSync(outputRoot, { recursive: true, mode: 0o700 });
const forwarded = [
  `--stage=${stage}`,
  `--run-id=${runId}`,
  `--output-dir=${outputRoot}`,
  args.get("duration-ms") ? `--duration-ms=${args.get("duration-ms")}` : null,
  args.get("interval-ms") ? `--interval-ms=${args.get("interval-ms")}` : null,
  args.get("deep-probe-ms") ? `--deep-probe-ms=${args.get("deep-probe-ms")}` : null,
  args.get("dvr-upstream-unavailable") ? `--dvr-upstream-unavailable=${args.get("dvr-upstream-unavailable")}` : null,
  args.get("dvr-source-available") ? `--dvr-source-available=${args.get("dvr-source-available")}` : null,
  args.get("resume") ? "--resume" : null
].filter(Boolean);
const programArguments = [process.execPath, join(repositoryRoot, "scripts/qa/run-real-home-soak.mjs"), ...forwarded];
const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${xml(label)}</string>
<key>ProgramArguments</key><array>${programArguments.map(value => `<string>${xml(value)}</string>`).join("")}</array>
<key>WorkingDirectory</key><string>${xml(repositoryRoot)}</string>
<key>RunAtLoad</key><true/>
<key>ProcessType</key><string>Background</string>
<key>StandardOutPath</key><string>${xml(join(outputRoot, "monitor.stdout.log"))}</string>
<key>StandardErrorPath</key><string>${xml(join(outputRoot, "monitor.stderr.log"))}</string>
<key>ThrottleInterval</key><integer>10</integer>
</dict></plist>\n`;
writeFileSync(plistPath, plist, { mode: 0o600 });
const controller = {
  contract: "observer-durable-qualification-monitor-controller-v1",
  action,
  created_at: new Date().toISOString(),
  owner: "PUSH_38_QUALIFICATION",
  execution_owner: "MACOS_LAUNCHD_USER_DOMAIN",
  terminal_session_independent: true,
  auto_restart: false,
  label,
  service,
  stage,
  run_id: runId,
  output_root: outputRoot,
  program_arguments: programArguments,
  plist_path: plistPath,
  shutdown: `launchctl bootout ${service}`
};
writeFileSync(controllerPath, `${JSON.stringify(controller, null, 2)}\n`, { mode: 0o600 });
if (action === "dry-run") {
  console.log(JSON.stringify({ ...controller, status: "DRY_RUN_PASS" }, null, 2));
  process.exit(0);
}
execFileSync("/bin/launchctl", ["bootstrap", domain, plistPath], { stdio: "pipe" });
console.log(JSON.stringify({ ...controller, status: "STARTED", launchd: serviceState() }, null, 2));
