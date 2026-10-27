import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { PIN } from "./original-gbi-cold-controller.mjs";
import { collectGbiReadOnly } from "./gbi-readonly-preflight.mjs";

function fixture({ daemonId = PIN.daemonId, missing = null, qaNetwork = "none" } = {}) {
  const calls = [];
  const items = PIN.stop.filter(([service]) => service !== missing).map(([service, id]) => ({
    Id: id, State: { Running: true }, Config: { Labels: { "com.docker.compose.project": PIN.project },
      StopSignal: service === "db" ? "SIGINT" : service === "kong" ? "SIGQUIT" : undefined },
    Path: service === "db" ? "sh" : "/bin/service",
    HostConfig: { RestartPolicy: { Name: "unless-stopped" }, NetworkMode: "bridge" },
    Mounts: PIN.volumes.filter(([name]) => service === (name.includes("_db_") ? "db" : "storage"))
      .map(([name, destination]) => ({ Name: name, Destination: destination })),
  }));
  items.push({ Id: PIN.excludedQaId, State: { Running: true }, Config: { Labels: {} },
    HostConfig: { NetworkMode: qaNetwork }, Mounts: [] });
  const volumes = PIN.volumes.map(([name]) => ({ Name: name, Driver: "local",
    Mountpoint: `/var/lib/docker/volumes/${name}/_data` }));
  const run = (command, args) => {
    calls.push([command, args]);
    assert.equal(command, "/opt/homebrew/bin/docker");
    assert.deepEqual(args.slice(0, 2), ["-H", PIN.socket]);
    if (args[2] === "info") return `${daemonId}\n`;
    if (args[2] === "inspect") return JSON.stringify(items);
    if (args[2] === "volume" && args[3] === "inspect") return JSON.stringify(volumes);
    throw new Error("UNEXPECTED_OR_MUTATING_COMMAND");
  };
  return { calls, run, configDigest: () => PIN.configSha256,
    freeBytes: () => 5 * 1024 ** 3 };
}

test("CLI has no mutation mode", () => {
  const script = fileURLToPath(new URL("./gbi-readonly-preflight.mjs", import.meta.url));
  const denied = spawnSync(process.execPath, [script], { encoding: "utf8" });
  assert.equal(denied.status, 2);
  assert.match(denied.stderr, /only --read-only/);
});

test("read-only fixture reports pins but never GO or exclusive writer proof", () => {
  const f = fixture();
  const report = collectGbiReadOnly(f);
  assert.equal(report.status, "PINS_MATCH_NOT_GO");
  assert.equal(report.mutationCommands, 0);
  assert.equal(report.privateKeyVerified, false);
  assert.equal(report.exclusiveWritersVerified, false);
  assert.equal(report.safeBoundedStopProven, false);
  assert.equal(report.containers.length, 7);
  assert.equal(report.containers.find(c => c.service === "db").stopSignal, "SIGINT");
  assert.deepEqual(f.calls.map(([, args]) => args[2]), ["info", "inspect", "volume"]);
});

test("wrong daemon and QA network fail closed", () => {
  assert.equal(collectGbiReadOnly(fixture({ daemonId: "wrong" })).status, "NO_GO_PIN_MISMATCH");
  assert.equal(collectGbiReadOnly(fixture({ qaNetwork: "bridge" })).status, "NO_GO_PIN_MISMATCH");
});

test("missing exact source container is rejected", () => {
  assert.throws(() => collectGbiReadOnly(fixture({ missing: "auth" })), /SELECTED_CONTAINER_INVENTORY_INCOMPLETE/);
});
