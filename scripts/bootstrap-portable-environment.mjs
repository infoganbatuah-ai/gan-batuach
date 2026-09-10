import { chmodSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { resolveEdgeRuntimePaths } from "../services/video-gateway/runtime-paths.mjs";

const manifest = JSON.parse(readFileSync(new URL("../config/digital-observer-portable-deployment.json", import.meta.url), "utf8"));
const args = Object.fromEntries(process.argv.slice(2).map((value) => { const index = value.indexOf("="); return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)]; }));
const profile = String(args["--profile"] || "").toUpperCase();
if (!manifest.artifacts.some((artifact) => artifact.profile === profile)) throw new Error("PORTABLE_PROFILE_UNSUPPORTED");
if (Number(process.versions.node.split(".")[0]) !== manifest.runtime.node_major) throw new Error(`NODE_MAJOR_${manifest.runtime.node_major}_REQUIRED`);

if (profile === "WEB") {
  const missing = manifest.configuration.web_required.filter((name) => !process.env[name]);
  if (missing.length && !args["--allow-placeholders"]) throw new Error(`PORTABLE_CONFIGURATION_MISSING:${missing.join(",")}`);
  console.log(JSON.stringify({ status: "READY", contract: manifest.contract, profile, configuration_complete: missing.length === 0, placeholders_allowed: Boolean(args["--allow-placeholders"]), missing }));
  process.exit(0);
}

const explicitState = args["--state-dir"] ? resolve(args["--state-dir"]) : "";
if (explicitState) process.env.OBSERVER_EDGE_DATA_DIR = explicitState;
if (profile === "SOFTWARE_CONNECTOR") process.env.OBSERVER_EDGE_DEVICE_TYPE = "SOFTWARE_CONNECTOR";
if (profile === "PHYSICAL_GATEWAY") process.env.OBSERVER_EDGE_DEVICE_TYPE = "PHYSICAL_GATEWAY";
const paths = resolveEdgeRuntimePaths();
for (const path of [paths.dataDir, paths.secretDir, paths.modelDir, paths.logDir]) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  chmodSync(path, 0o700);
  if ((statSync(path).mode & 0o077) !== 0) throw new Error("PORTABLE_RUNTIME_PERMISSION_UNSAFE");
}
console.log(JSON.stringify({ status: "READY", contract: manifest.contract, profile, paths: { data: paths.dataDir, models: paths.modelDir, logs: paths.logDir }, secret_path_disclosed: false, ota_contract: "observer-edge-update-v1", fleet_enrollment: "PUSH_18_IDENTITY_REQUIRED" }));
