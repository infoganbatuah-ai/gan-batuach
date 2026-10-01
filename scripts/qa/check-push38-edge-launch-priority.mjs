import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { managedEdgeLaunchAgent } from "../../services/video-gateway/edge-macos-installed-adapter.mjs";

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

const desktopHost = readFileSync(new URL(
  "../../services/connector-desktop/macos/DesktopHost.swift", import.meta.url), "utf8");
assert.doesNotMatch(desktopHost, /"ProcessType"\s*:\s*"Background"/);

console.log(JSON.stringify({ status: "PASS", managed_edge_background_priority_removed: true,
  service_manager_preserved: true, runtime_bytes_changed: false }));
