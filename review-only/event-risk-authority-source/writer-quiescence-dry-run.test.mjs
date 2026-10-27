import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { evaluate } from "./writer-quiescence-dry-run.mjs";

const expected = JSON.parse(readFileSync(new URL("./writer-quiescence-source-manifest.json", import.meta.url), "utf8"));
function fixture() {
  const snapshot = {
    daemonId: expected.source.dockerDaemonId,
    daemonName: expected.source.dockerDaemonName,
    limaDaemonId: expected.source.dockerDaemonId,
    configSha256: expected.source.colimaConfigSha256,
    networkInternal: expected.source.networkInternal,
    networkMembers: expected.containers.map(c => c.name),
    containers: expected.containers.map(c => ({ id: c.id, name: c.name, running: true,
      networkMode: expected.source.network, published: { ...c.published },
      mounts: c.mounts.map(m => ({ ...m, type: "volume" })) })),
    volumes: expected.volumes.map(v => ({ ...v })),
    hostListeners: expected.ingress.map(e => ({ port: e.port, loopbackOnly: true })),
    dbClients: [],
    scheduleCatalog: ["postgres", "_supabase", "gan_batuach_baseline_builder_v2"].map(database =>
      ({ database, installed: [], relationState: "none|none" })),
    hostProcessInventory: "sampled"
  };
  snapshot.allRunningContainers = snapshot.containers.map(c => ({ ...c, mounts: c.mounts.map(m => ({ ...m })) }));
  return snapshot;
}

test("perfect snapshot still cannot prove future-client exclusion or daemon-failure resume", () => {
  const s = fixture();
  s.proof = { futureWritersExcluded: true, autoResumeVerified: true, sourceWindowPassed: true };
  const result = evaluate(s, expected);
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasons.includes("FUTURE_API_DB_AND_DOCKER_WRITER_EXCLUSION_UNVERIFIED"));
  assert.ok(result.reasons.includes("AUTO_RESUME_AFTER_GUEST_DAEMON_FAILURE_UNVERIFIED"));
  assert.ok(result.reasons.includes("SOURCE_WINDOW_AND_ROLLBACK_NOT_EXERCISED"));
});

test("existing source DB connection is not mistaken for a drained writer", () => {
  const s = fixture();
  s.dbClients.push({ role: "authenticator", source: expected.containers.find(c => c.service === "rest").name, state: "idle" });
  const r = evaluate(s, expected);
  assert.ok(r.reasons.includes("EXISTING_DB_CLIENTS_NOT_DRAINED_OR_FENCED"));
  assert.equal(r.summary.observedDbClients, 1);
});

test("new DB client and new Docker network member both fail closed", () => {
  const s = fixture();
  s.dbClients.push({ role: "postgres", source: "unknown", state: "active" });
  s.networkMembers.push("unexpected-writer");
  const r = evaluate(s, expected);
  assert.ok(r.reasons.includes("UNKNOWN_DB_CLIENT_SOURCE"));
  assert.ok(r.reasons.includes("NETWORK_MEMBERSHIP_CHANGED"));
});

test("new no-network container mounting a protected volume fails closed", () => {
  const s = fixture();
  s.allRunningContainers.push({ id: "f".repeat(64), name: "unexpected-admin-writer",
    mounts: [{ type: "volume", name: expected.volumes[0].name, destination: "/data" }] });
  assert.ok(evaluate(s, expected).reasons.includes("UNEXPECTED_VOLUME_WRITER"));
});

test("independent Lima path failure is a gate failure", () => {
  const s = fixture();
  s.limaDaemonId = null;
  assert.ok(evaluate(s, expected).reasons.includes("INDEPENDENT_LIMA_PATH_NOT_VERIFIED"));
});

test("changed exact container ID cannot be hidden by same service name", () => {
  const s = fixture();
  s.containers.find(c => c.name.startsWith("supabase_storage_")).id = "0".repeat(64);
  assert.ok(evaluate(s, expected).reasons.includes("CONTAINER_IDENTITY_CHANGED_STORAGE"));
});

test("unexpected mount on DB fails closed", () => {
  const s = fixture();
  s.containers.find(c => c.name.startsWith("supabase_db_")).mounts.push({ type: "bind", name: null, destination: "/unexpected" });
  assert.ok(evaluate(s, expected).reasons.includes("MOUNT_SET_CHANGED_DB"));
});

test("unknown scheduled job catalog state fails closed", () => {
  const s = fixture();
  s.scheduleCatalog[0].relationState = "cron.job|none";
  assert.ok(evaluate(s, expected).reasons.includes("SCHEDULED_WRITER_CATALOG_UNRESOLVED"));
});

test("volume replacement and non-loopback host ingress fail closed", () => {
  const s = fixture();
  s.volumes[0].createdAt = "replacement";
  s.hostListeners[0].loopbackOnly = false;
  const r = evaluate(s, expected);
  assert.ok(r.reasons.includes("VOLUME_IDENTITY_CHANGED"));
  assert.ok(r.reasons.includes("HOST_INGRESS_NOT_LOOPBACK_55421"));
});

test("there is no apply or arm CLI mode", () => {
  const result = spawnSync(process.execPath,
    [new URL("./writer-quiescence-dry-run.mjs", import.meta.url).pathname, "--apply"],
    { encoding: "utf8", timeout: 3000 });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Only --dry-run is supported/);
});
