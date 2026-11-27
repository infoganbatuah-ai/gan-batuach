// READ-ONLY live compatibility inspection. Archives are extracted only into a
// temporary QA directory; no live service, identity, config or camera is changed.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readlinkSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, relative } from "node:path";
import { verifyEdgeArtifact, verifyEdgeUpdateManifest } from "../../services/video-gateway/edge-update-contract.mjs";
import { createMacOSInstalledEdgeAdapter } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";
import { planInstalledOtaAgent } from "../../services/video-gateway/edge-installed-ota-installer.mjs";

const baselineStore = process.argv[2];
if (!baselineStore) throw new Error("QA_BASELINE_STORE_REQUIRED");
const overrides = Object.fromEntries(process.argv.slice(3).map(value => { const equal = value.indexOf("="); return [value.slice(0, equal), value.slice(equal + 1)]; }));
const gatewayStore = overrides["--gateway-baseline-store"] || baselineStore;
const gatewayId = overrides["--gateway-baseline-id"] || "qa-legacy-gateway-aa57572e8736";
const home = homedir();
const entries = [
  { profile: "PHYSICAL_GATEWAY", label: "com.ganbatuach.video-gateway",
    live: join(home, ".local/share/gan-batuach/video-gateway"),
    archive: join(gatewayStore, gatewayId, "gateway-runtime.tar.gz"),
    release: join(gatewayStore, gatewayId, "release.json"), port: 18082 },
  { profile: "SOFTWARE_CONNECTOR", label: "com.ganbatuach.software-connector.tapo",
    live: join(home, "Applications"),
    archive: join(baselineStore, "qa-legacy-connector-ee82c20a77ac/connector-app.tar.gz"),
    release: join(baselineStore, "qa-legacy-connector-ee82c20a77ac/release.json"), port: 18083 }
];
const trustPath = "/Library/Application Support/Digital Observer/release-trust/root-pin.json";
const trust = JSON.parse(readFileSync(join(baselineStore, "qa-trust-registry.json"))).trustedPublicKeys;
const result = [];
for (const item of entries) {
  const plist = join(home, "Library/LaunchAgents", `${item.label}.plist`);
  const program = JSON.parse(execFileSync("/usr/bin/plutil", ["-extract", "ProgramArguments", "json", "-o", "-", plist], { encoding: "utf8" }));
  const service = execFileSync("/bin/launchctl", ["print", `gui/${process.getuid()}/${item.label}`], { encoding: "utf8" });
  const expectedRunner = item.profile === "PHYSICAL_GATEWAY" ? join(item.live, "scripts/run-persistent-home-gateway.mjs")
    : join(item.live, "Digital Observer.app/Contents/Resources/runtime/scripts/run-software-connector.mjs");
  const conflicts = [];
  if (program[1] !== expectedRunner || !service.includes("state = running")) conflicts.push("INSTALLED_SERVICE_LAYOUT_MISMATCH");
  const manifest = JSON.parse(readFileSync(item.release));
  const archive = readFileSync(item.archive);
  if (!verifyEdgeUpdateManifest(manifest, trust).ok || !verifyEdgeArtifact(archive, manifest).ok) conflicts.push("BASELINE_RELEASE_INVALID");
  const temporary = mkdtempSync(join(tmpdir(), "observer-p38h-live-compare-"));
  const changed = [], missing = []; let matched = 0;
  try {
    execFileSync("tar", ["-xzf", item.archive, "-C", temporary], { timeout: 120_000 });
    function visit(directory) { for (const name of readdirSync(directory)) {
      const source = join(directory, name), rel = relative(temporary, source), target = join(item.live, rel);
      const info = lstatSync(source);
      if (info.isDirectory()) { visit(source); continue; }
      if (!existsSync(target)) { missing.push(rel); continue; }
      const current = lstatSync(target);
      if (info.isSymbolicLink() !== current.isSymbolicLink()) { changed.push(rel); continue; }
      const equal = info.isSymbolicLink() ? readlinkSync(source) === readlinkSync(target)
        : createHash("sha256").update(readFileSync(source)).digest("hex") === createHash("sha256").update(readFileSync(target)).digest("hex");
      if (equal) matched += 1; else changed.push(rel);
    } }
    visit(temporary);
  } finally { rmSync(temporary, { recursive: true, force: true }); }
  if (changed.length || missing.length) conflicts.push("LIVE_BASELINE_CONTENT_CHANGED");
  const slotRoot = join(home, "Library/Application Support/Digital Observer",
    item.profile === "PHYSICAL_GATEWAY" ? "observer-gateway" : "observer-connector", "ota");
  if (existsSync(join(slotRoot, "installed-bootstrap.json"))) conflicts.push("EXISTING_BOOTSTRAP_STATE");
  let adapterPlan = null;
  try { adapterPlan = createMacOSInstalledEdgeAdapter({ profile: item.profile, installedBase: item.live,
    managedRoot: slotRoot, launchAgentPath: plist, label: item.label, port: item.port }).plan(); }
  catch (error) { conflicts.push(error.code || "LIVE_ADAPTER_PLAN_FAILED"); }
  let agentPlan = null;
  try {
    const agentLabel = `${item.label}.ota-agent`;
    const agentPlistPath = join(home, "Library/LaunchAgents", `${agentLabel}.plist`);
    agentPlan = planInstalledOtaAgent({ profile: item.profile, managedRoot: slotRoot,
      agentPlistPath, agentLabel });
    if (!existsSync(program[0])) conflicts.push("LIVE_AGENT_NODE_MISSING");
    if (existsSync(agentPlistPath) || existsSync(join(slotRoot, "agent"))) conflicts.push("EXISTING_OTA_AGENT_INSTALLATION");
  } catch (error) { conflicts.push(error.code || "LIVE_AGENT_PLAN_FAILED"); }
  result.push({ profile: item.profile, service_label: item.label, service_running: service.includes("state = running"),
    expected_runner_match: program[1] === expectedRunner, baseline_release: manifest.release_id,
    baseline_artifact_sha256: manifest.artifact_sha256, live_file_matches: matched,
    live_file_changed: changed, live_file_missing: missing,
    planned_changes: [...(adapterPlan?.planned_files || [slotRoot, plist, trustPath]),
      ...(agentPlan ? [agentPlan.management_code, agentPlan.config, agentPlan.agent_plist] : [])],
    agent_plan: agentPlan ? { label: agentPlan.agent_label, qa: agentPlan.qa, writes: agentPlan.writes } : null,
    trust_root_present: existsSync(trustPath), conflicts, camera_health: "NOT_CHECKED_BY_FILE_DRY_RUN" });
}
console.log(JSON.stringify({ protocol: "observer-live-bootstrap-dry-run-v1", write_operations: 0, results: result,
  compatible: result.every(entry => entry.conflicts.length === 0) }));
