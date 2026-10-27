#!/usr/bin/env node
// Read-only source inventory. This is intentionally NOT a cold-backup adapter:
// no stop/start/export/restore command or owner-approval parser exists here.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statfsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PIN } from "./original-gbi-cold-controller.mjs";

const CONFIG = `${PIN.colimaHome}/gbi/colima.yaml`;
const QA = PIN.excludedQaId;
const allowed = new Set(["info", "inspect", "volume"]);
function defaultRead(command, args) {
  assert.equal(command, "/opt/homebrew/bin/docker", "UNEXPECTED_COMMAND");
  assert.ok(args[0] === "-H" && args[1] === PIN.socket && allowed.has(args[2]),
    "NON_READONLY_DOCKER_COMMAND");
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 15_000,
    maxBuffer: 4_000_000, env: process.env });
  if (result.error || result.status !== 0) throw new Error(`READ_ONLY_DOCKER_${args[2].toUpperCase()}_FAILED`);
  return result.stdout;
}
function readJson(run, args) {
  const value = run("/opt/homebrew/bin/docker", ["-H", PIN.socket, ...args]);
  assert.equal(typeof value, "string", "DOCKER_OUTPUT_INVALID");
  return JSON.parse(value);
}

export function collectGbiReadOnly({ run = defaultRead,
  configDigest = () => createHash("sha256").update(readFileSync(CONFIG)).digest("hex"),
  freeBytes = () => {
    const stat = statfsSync("/private/tmp");
    return Number(stat.bavail) * Number(stat.bsize);
  },
} = {}) {
  const daemonId = run("/opt/homebrew/bin/docker", ["-H", PIN.socket, "info", "--format", "{{.ID}}"] ).trim();
  const configSha256 = configDigest();
  const selected = readJson(run, ["inspect", ...PIN.stop.map(([, id]) => id), QA]);
  const volumes = readJson(run, ["volume", "inspect", ...PIN.volumes.map(([name]) => name)]);
  assert.ok(Array.isArray(selected) && selected.length === 8, "SELECTED_CONTAINER_INVENTORY_INCOMPLETE");
  assert.ok(Array.isArray(volumes) && volumes.length === 2, "SELECTED_VOLUME_INVENTORY_INCOMPLETE");
  const containers = PIN.stop.map(([service, id]) => {
    const item = selected.find(value => value.Id === id);
    assert.ok(item, `PINNED_CONTAINER_MISSING:${service}`);
    return { service, id, running: item.State?.Running === true,
      project: item.Config?.Labels?.["com.docker.compose.project"] ?? null,
      stopSignal: item.Config?.StopSignal || "SIGTERM(default)",
      pid1Path: item.Path ?? null, restart: item.HostConfig?.RestartPolicy?.Name ?? null,
      selectedMounts: (item.Mounts ?? []).filter(m => PIN.volumes.some(([name]) => name === m.Name))
        .map(m => [m.Name, m.Destination]).sort((a, b) => a[0].localeCompare(b[0])) };
  });
  const qa = selected.find(value => value.Id === QA);
  assert.ok(qa, "EXCLUDED_QA_CONTAINER_MISSING");
  const mountOwners = containers.flatMap(c => c.selectedMounts.map(([name]) => [name, c.id]))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const expectedOwners = [[PIN.volumes[0][0], PIN.stop.at(-1)[1]],
    [PIN.volumes[1][0], PIN.stop.find(([service]) => service === "storage")[1]]]
    .sort((a, b) => a[0].localeCompare(b[0]));
  const exactVolumes = PIN.volumes.every(([name]) => volumes.some(v => v.Name === name &&
    v.Driver === "local" && v.Mountpoint === `/var/lib/docker/volumes/${name}/_data`));
  const free = freeBytes();
  assert.ok(Number.isSafeInteger(free) && free >= 0, "INTERNAL_FREE_INVALID");
  const pinned = daemonId === PIN.daemonId && configSha256 === PIN.configSha256 &&
    containers.every(c => c.running && c.project === PIN.project) &&
    JSON.stringify(mountOwners) === JSON.stringify(expectedOwners) && exactVolumes &&
    qa.State?.Running === true && qa.HostConfig?.NetworkMode === "none" &&
    !(qa.Mounts ?? []).some(m => PIN.volumes.some(([name]) => name === m.Name));
  // No read-only point sample can establish future writer exclusivity or key
  // custody. In particular, this does not call assertSourcePinned for GO.
  return { status: pinned ? "PINS_MATCH_NOT_GO" : "NO_GO_PIN_MISMATCH",
    daemonId, configDigestMatches: configSha256 === PIN.configSha256,
    containers, selectedVolumeCount: volumes.length, selectedMountOwnersMatch: JSON.stringify(mountOwners) === JSON.stringify(expectedOwners),
    excludedQaId: QA, excludedQaRunning: qa.State?.Running === true,
    internalFreeBytes: free, privateKeyVerified: false, exclusiveWritersVerified: false,
    safeBoundedStopProven: false, sourceCommands: 3, mutationCommands: 0 };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== "--read-only") {
    process.stderr.write("NO_GO: only --read-only preflight is available.\n");
    process.exitCode = 2;
  } else {
    try { process.stdout.write(JSON.stringify(collectGbiReadOnly()) + "\n"); }
    catch (error) { process.stderr.write(`NO_GO:${error.message}\n`); process.exitCode = 1; }
  }
}
