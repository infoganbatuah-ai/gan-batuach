import assert from "node:assert/strict";
import { generateKeyPairSync, sign, verify } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { Worker } from "node:worker_threads";
import { loadTs } from "./digital-guard-test-loader.mjs";

const edgeModule = "lib/domain/digital-observer/gan-camera-pilot-synthetic-edge.ts";
const { openGanCameraPilotSyntheticEdge } = loadTs(edgeModule);
const { createGanCameraPilotGrantProvider } = loadTs("lib/domain/digital-observer/gan-camera-pilot-grant.ts");
const binding = { viewerId: "qa-viewer", role: "parent", gardenId: "qa-garden", siteId: "qa-site", cameraId: "qa-camera", protocol: "WebRTC" };
const scope = { ...binding, tenantId: "qa-tenant", sessionId: "qa-session", sourceId: "synthetic", gatewayId: "synthetic-edge", streamId: "SyntheticStream" };
const handle = "h".repeat(43);
const start = 10_000;
const grant = { scope, handle, expiresAtMs: 50_000 };
const sha = "a".repeat(40);

function fixture(t) {
  const directory = mkdtempSync(resolve(".gan-pilot-qa-"));
  const connections = new Set();
  t.after(() => {
    for (const edge of connections) edge.close();
    rmSync(directory, { recursive: true, force: true });
  });
  let clock = start;
  const options = { databasePath: join(directory, "synthetic.sqlite"), windowId: "w".repeat(32), scope, deadlineMs: start + 300_000 };
  function open() {
    const edge = openGanCameraPilotSyntheticEdge({ ...options, now: () => clock });
    connections.add(edge);
    return edge;
  }
  return { options, open, close(edge) { connections.delete(edge); edge.close(); }, goTo(value) { clock = value; } };
}

test("an issued grant survives reopen and only one independent worker can consume it", async (t) => {
  const h = fixture(t);
  const first = h.open();
  assert.equal(await first.store.issue(grant, "j".repeat(32)), true);
  h.close(first);
  const barrier = new SharedArrayBuffer(4);
  const runner = `
    const { parentPort, workerData } = require("node:worker_threads");
    (async () => {
      const { loadTs } = await import(workerData.loader);
      const { openGanCameraPilotSyntheticEdge } = loadTs(workerData.edgeModule);
      const edge = openGanCameraPilotSyntheticEdge({ ...workerData.options, now: () => workerData.start });
      const barrier = new Int32Array(workerData.barrier);
      Atomics.add(barrier, 0, 1);
      Atomics.notify(barrier, 0);
      if (Atomics.wait(barrier, 0, 1, 5000) === "timed-out") throw Error("worker contention barrier timed out");
      const result = await edge.store.consume(workerData.handle, workerData.scope, 50_000);
      edge.close();
      parentPort.postMessage(Boolean(result));
    })().catch(error => { throw error; });`;
  const results = await Promise.all([1, 2].map(() => new Promise((resolveResult, reject) => {
    const worker = new Worker(runner, { eval: true, workerData: { loader: new URL("./digital-guard-test-loader.mjs", import.meta.url).href,
      edgeModule, options: h.options, start, scope, handle, barrier } });
    worker.once("message", resolveResult);
    worker.once("error", reject);
    t.after(() => worker.terminate());
  })));
  assert.equal(results.filter(Boolean).length, 1);
  const restarted = h.open();
  assert.equal(await restarted.store.consume(handle, scope, 50_000), null);
  assert.equal(await restarted.store.issue({ ...grant, handle: "n".repeat(43) }, "k".repeat(32)), false);
});

test("signed authorization runs through the durable store with tenant and role denial, expiry and revocation", async (t) => {
  const h = fixture(t);
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const edge = h.open();
  let resolved = scope;
  let jti = 0;
  function provider(store, operation, signedHandle) {
    const assertion = { environment: "development", version: 1, issuer: "gan_batuach", audience: "digital_observer:gan_camera_pilot",
      binding, sessionId: scope.sessionId, operation, jti: String(++jti).padStart(32, "0"), issuedAtMs: start, expiresAtMs: 50_000,
      ...(signedHandle ? { handle: signedHandle } : {}) };
    const payload = Buffer.from(JSON.stringify(assertion)).toString("base64url");
    const signedAssertion = `${payload}.${sign(null, Buffer.from(payload), privateKey).toString("base64url")}`;
    return createGanCameraPilotGrantProvider({ environment: "development", qaGardenId: binding.gardenId, signedAssertion,
      ganPublicKey: publicKey, store, now: () => start, resolveScope: async () => resolved });
  }
  const issued = await provider(edge.store, "issue").issue(binding);
  assert.ok(issued);
  h.close(edge);
  const reopened = h.open();
  const redeem = provider(reopened.store, "redeem", issued.handle);
  resolved = { ...scope, tenantId: "another-tenant" };
  assert.equal(await redeem.consume(binding, issued.handle), null);
  resolved = scope;
  assert.equal(await redeem.consume({ ...binding, role: "staff" }, issued.handle), null);
  await reopened.store.revoke(issued.handle);
  assert.equal(await redeem.consume(binding, issued.handle), null);
  const expired = await provider(reopened.store, "issue").issue(binding);
  h.goTo(expired.expiresAtMs);
  assert.equal(await provider(reopened.store, "redeem", expired.handle).consume(binding, expired.handle), null);
});

async function claim(edge) {
  assert.equal(await edge.store.issue(grant, "j".repeat(32)), true);
  assert.ok(await edge.store.consume(handle, scope, 50_000));
}

test("delivery reserves 100 MiB across reopen, stops at the cap and signs only synthetic evidence", async (t) => {
  const h = fixture(t);
  let edge = h.open();
  await claim(edge);
  const payload = Buffer.alloc(1024 * 1024);
  let writes = 0;
  const write = () => { writes++; return true; };
  const send = (sequence, requestedScope = scope) => edge.deliverSyntheticChunk({ scope: requestedScope, handle, payload, sequence, write });
  assert.equal(send(0, { ...scope, viewerId: "wrong" }), false);
  for (let sequence = 0; sequence < 100; sequence++) {
    if (sequence === 50) { h.close(edge); edge = h.open(); }
    assert.equal(send(sequence), true);
  }
  assert.equal(send(100), false);
  assert.equal(writes, 100);
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const [encoded, signature] = edge.signSyntheticEvidence(sha, privateKey).split(".");
  const signatureBytes = Buffer.from(signature, "base64url");
  assert.equal(verify(null, Buffer.from(encoded), publicKey, signatureBytes), true);
  assert.equal(verify(null, Buffer.from(encoded + "a"), publicKey, signatureBytes), false);
  const evidence = JSON.parse(Buffer.from(encoded, "base64url"));
  assert.equal(evidence.playbackQualified, false);
  assert.equal(evidence.stopped, "BYTE_LIMIT");
  assert.equal(evidence.bytesReserved, 104_857_600);
  assert.equal(evidence.bytesDelivered, 104_857_600);
  assert.equal(evidence.syntheticFrames, 100);
  h.goTo(evidence.expiresAtMs);
  assert.equal(edge.signSyntheticEvidence(sha, privateKey), null);
});

test("deadline, revocation and accounting failure each stop the synthetic sink", async (t) => {
  for (const reason of ["DEADLINE", "REVOKED", "ACCOUNTING_OR_SINK"]) {
    const h = fixture(t);
    const edge = h.open();
    await claim(edge);
    const submit = (write) => edge.deliverSyntheticChunk({ scope, handle, payload: Buffer.alloc(5), sequence: 0, write });
    if (reason === "DEADLINE") h.goTo(h.options.deadlineMs);
    if (reason === "REVOKED") await edge.store.revoke(handle);
    if (reason === "ACCOUNTING_OR_SINK") assert.equal(submit(() => { throw new Error("synthetic failure"); }), false);
    assert.equal(submit(() => assert.fail("no delivery after stop")), false);
    const { privateKey } = generateKeyPairSync("ed25519");
    const [receipt] = edge.signSyntheticEvidence(sha, privateKey).split(".");
    const evidence = JSON.parse(Buffer.from(receipt, "base64url"));
    assert.equal(evidence.stopped, reason);
    assert.equal(evidence.bytesDelivered, 0);
    assert.equal(evidence.bytesReserved, reason === "ACCOUNTING_OR_SINK" ? 5 : 0);
  }
});

test("delivery is allowed one millisecond before the deadline and denied at the deadline after reopen", async (t) => {
  const h = fixture(t);
  const edge = h.open();
  await claim(edge);
  h.goTo(h.options.deadlineMs - 1);
  const chunk = { scope, handle, payload: Buffer.alloc(1), sequence: 1, write: () => true };
  assert.equal(edge.deliverSyntheticChunk(chunk), true);
  h.close(edge);
  h.goTo(h.options.deadlineMs);
  const reopened = h.open();
  let transfers = 0;
  assert.equal(reopened.deliverSyntheticChunk({ ...chunk, sequence: 2, write: () => { transfers++; return true; } }), false);
  assert.equal(transfers, 0);
});
