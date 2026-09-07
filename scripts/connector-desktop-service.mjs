import { readFileSync, writeFileSync, mkdirSync, renameSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { softwareConnectorSecretStore, connectorCloudRequest, syncSoftwareConnectorConfiguration } from "../services/video-gateway/software-connector-cloud.mjs";
import { claimDesktopInstallation, pollDesktopInstallation } from "../services/video-gateway/desktop-enrollment.mjs";

const root = process.env.OBSERVER_CONNECTOR_DATA_DIR;
if (!root || !process.env.OBSERVER_CONNECTOR_KEYCHAIN_SERVICE || !process.env.OBSERVER_KEYCHAIN_HELPER) throw new Error("COMMERCIAL_SECURE_HOST_REQUIRED");
mkdirSync(root, { recursive: true, mode: 0o700 });
const store = softwareConnectorSecretStore();
const origin = "https://ganbatuach.com";
const version = "connector-desktop-v1";
const status = stage => {
  const file = join(root, "desktop-status.json");
  writeFileSync(`${file}.tmp`, JSON.stringify({ stage, at: new Date().toISOString(), version }), { mode: 0o600 });
  renameSync(`${file}.tmp`, file);
};
async function post(path, body) {
  const response = await fetch(`${origin}${path}`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body), redirect: "error", signal: AbortSignal.timeout(15000) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`INSTALL_REQUEST_${response.status}`);
  return data.data;
}
async function run(script, monitor = null) {
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script], { cwd: process.cwd(), env: process.env, stdio: "ignore" });
    let stopping = false, reconfigure = false, checking = false;
    const stop = () => { stopping = true; child.kill("SIGTERM"); }; process.once("SIGTERM", stop);
    const timer = monitor ? setInterval(async () => {
      if (checking || child.exitCode !== null) return; checking = true;
      try { if (await monitor()) { reconfigure = true; child.kill("SIGTERM"); } } catch {}
      finally { checking = false; }
    }, 30_000) : null;
    const done = result => { if (timer) clearInterval(timer); process.removeListener("SIGTERM", stop); resolve(result); };
    child.once("error", () => done(monitor ? { ok: false, reconfigure: false } : false));
    child.once("exit", code => { if (stopping) process.exit(0); done(monitor ? { ok: code === 0, reconfigure } : code === 0); });
  });
}
if (process.argv[2] === "--document") {
  try {
    const bytes = readFileSync(process.argv[3]);
    if (bytes.length > 4096) throw new Error("INSTALL_DOCUMENT_TOO_LARGE");
    const result = await claimDesktopInstallation({ document: JSON.parse(bytes.toString("utf8")), store,
      platform: process.platform === "darwin" ? `macos-${process.arch}` : "windows-x64", version,
      build: process.env.OBSERVER_EDGE_BUILD_SHA || "development", post });
    status(result.status);
  } catch { status("ACTION_REQUIRED"); process.exitCode = 1; }
} else if (process.argv[2] === "--service") {
  let nextDiscoveryAt = 0;
  for (;;) {
    try {
      const enrolled = await pollDesktopInstallation({ store, post });
      status(enrolled.status);
      if (enrolled.status === "ENROLLED") {
        const synced = await syncSoftwareConnectorConfiguration(store);
        if (synced.configured) {
          status("STARTING_MONITORING");
          const completed = await run("scripts/run-software-connector.mjs", async () => {
            const latest = await syncSoftwareConnectorConfiguration(store);
            return latest.configured && latest.configVersion > synced.configVersion;
          });
          if (completed.reconfigure) { status("APPLYING_CAMERA_CONFIGURATION"); continue; }
          status(completed.ok ? "STOPPED" : "ACTION_REQUIRED");
          break; // the OS service restarts a crashed process; no second core.
        }
        await connectorCloudRequest("/api/video-gateway/device-heartbeat", { method: "POST", body: JSON.stringify({
          heartbeat_id: randomUUID(), gateway_id: store.read("device_gateway_id"), observer_site_id: store.read("device_observer_site_id"),
          observed_at: new Date().toISOString(), runtime: { contract: "observer-edge-runtime-v1", device_type: "SOFTWARE_CONNECTOR",
            installation_id: store.read("device_installation_id"), software_version: version, build_sha: process.env.OBSERVER_EDGE_BUILD_SHA || "development",
            outbound_only: true, arbitrary_shell_commands: false },
          health: { status: "HEALTHY", uptime_seconds: Math.round(process.uptime()), cpu_percent: null, memory_mb: null, disk_free_mb: null,
            camera_count: 0, streaming_count: 0, last_frame_at: null, error_codes: [] }
        }) }, store);
        if (Date.now() >= nextDiscoveryAt) {
          status("SEARCHING_CAMERAS");
          const discovered = await run("scripts/discover-software-connector-cameras.mjs");
          nextDiscoveryAt = Date.now() + (discovered ? 5 * 60_000 : 30_000);
          status(discovered ? "CAMERAS_FOUND" : "CAMERA_DISCOVERY_RETRY");
        }
        if (Date.now() < nextDiscoveryAt && nextDiscoveryAt - Date.now() > 30_000) status("WAITING_FOR_CAMERA_SELECTION");
      }
    } catch { status("ACTION_REQUIRED"); }
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
} else { throw new Error("UNSUPPORTED_DESKTOP_OPERATION"); }
