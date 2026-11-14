import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

// Actual helper module under a closed VM. No runtime, database, camera or network.
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const file = resolve(root, "lib/domain/digital-observer/camera-live-status.ts");
assert.ok(statSync(file).isFile());
if (process.platform === "darwin") {
  const raw = execFileSync("/usr/bin/stat", ["-f", "%f", file], { encoding: "utf8" }).trim();
  assert.match(raw, /^\d+$/);
  assert.equal(BigInt(raw) & 0x40000000n, 0n, "SF_DATALESS source refused");
}
const ts = createRequire(resolve(root, "package.json"))("typescript");
const output = ts.transpileModule(readFileSync(file, "utf8"), {
  fileName: file, reportDiagnostics: true,
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
});
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
assert.equal(errors.length, 0, errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, "\n")).join("\n"));
const exports = {};
new vm.Script(output.outputText, { filename: file }).runInNewContext({ exports }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
const {
  digitalObserverCameraOperationalState: operational,
  digitalObserverCameraHealthProjection: projection,
  digitalObserverCameraHasLiveStream: live,
  digitalObserverCameraHasLiveGateway: alias,
  digitalObserverCameraIsAssigned: assigned
} = exports;
const now = Date.parse("2026-11-13T12:00:00.000Z");
const camera = {
  source_mode: "live", status: "connected", health_status: "healthy",
  metadata: { gateway_stream_id: "synthetic-stream-ref" },
  last_seen_at: new Date(now - 60_000).toISOString()
};
const plain = (value) => JSON.parse(JSON.stringify(value));

test("assigned demo with fresh stream reference never becomes online or healthy", () => {
  const demo = { ...camera, source_mode: "demo" };
  assert.equal(assigned(demo), true, "synthetic source assignment metadata is retained");
  assert.equal(operational(demo, { now }), "SIMULATION");
  assert.deepEqual(plain(projection(demo, now)), { operationalState: "SIMULATION", status: "readiness", healthStatus: "unknown", live: false });
  assert.equal(live(demo), false);
  assert.equal(alias(demo), false);
});
test("demo status aliases and stream reference shapes cannot bypass the simulation gate", () => {
  for (const status of ["connected", "healthy", "online", "active"]) for (const ref of [
    { metadata: { canonical_stream_reference: "ref" } },
    { metadata: { gateway_stream_id: "ref" } },
    { gateway_stream_id: "ref" },
    { video_gateway_stream_id: "ref" }
  ]) {
    const demo = { ...camera, ...ref, source_mode: "demo", status, health_status: "healthy", last_seen_at: new Date().toISOString() };
    assert.equal(operational(demo, { now }), "SIMULATION");
    assert.equal(projection(demo, now).live, false);
    assert.equal(live(demo), false);
    assert.equal(alias(demo), false);
  }
});
test("unassigned demo keeps the existing channel-empty precedence", () => {
  const empty = { ...camera, source_mode: "demo", metadata: { channel_assignment: "CHANNEL_EMPTY", gateway_stream_id: "ref" } };
  assert.equal(assigned(empty), false);
  assert.equal(operational(empty, { now }), "CHANNEL_EMPTY");
  assert.deepEqual(plain(projection(empty, now)), { operationalState: "CHANNEL_EMPTY", status: "unassigned", healthStatus: "unknown", live: false });
  assert.equal(live(empty), false);
});
for (const source_mode of ["live", "gateway_test"]) {
  test(`${source_mode} fresh, recovering, stale and offline paths remain intact`, () => {
    const fresh = { ...camera, source_mode, last_seen_at: new Date().toISOString() };
    assert.equal(operational({ ...fresh, last_seen_at: new Date(now - 60_000).toISOString() }, { now }), "ONLINE");
    assert.deepEqual(plain(projection({ ...fresh, last_seen_at: new Date(now - 60_000).toISOString() }, now)),
      { operationalState: "ONLINE", status: "connected", healthStatus: "healthy", live: true });
    assert.equal(live(fresh), true);
    assert.equal(alias(fresh), true);
    const recovering = { ...fresh, last_seen_at: new Date(now - 60 * 60_000).toISOString() };
    assert.equal(operational(recovering, { now }), "RECOVERING");
    assert.deepEqual(plain(projection(recovering, now)), { operationalState: "RECOVERING", status: "recovering", healthStatus: "degraded", live: false });
    const stale = { ...fresh, last_seen_at: new Date(now - 100 * 60_000).toISOString() };
    assert.equal(operational(stale, { now }), "OFFLINE");
    assert.equal(projection(stale, now).live, false);
    assert.equal(operational({ ...fresh, status: "offline" }, { now }), "OFFLINE");
    assert.equal(live({ ...fresh, status: "offline" }), false);
  });
}
test("non-demo source without a stream reference is not live", () => {
  const noReference = { ...camera, metadata: {} };
  assert.equal(operational(noReference, { now }), "ONLINE");
  assert.equal(live(noReference), false);
  assert.equal(alias(noReference), false);
});
