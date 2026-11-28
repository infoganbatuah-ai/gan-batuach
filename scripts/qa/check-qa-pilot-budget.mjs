import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createQaPilotCoordinator, QA_PILOT_LIMITS } from "../../services/video-gateway/qa-pilot-budget.mjs";

function fixture(t, overrides = {}) {
  const storage = mkdtempSync(join(tmpdir(), "qa-pilot-budget-"));
  chmodSync(storage, 0o700);
  let wall = 10_000;
  let mono = 0;
  const options = {
    enabled: true, environment: "isolated-qa", storage, assertMounted: dir => dir === storage,
    verifyApproval: async credential => credential,
    authenticate: async session => session === "viewer" ? { id: "viewer", siteId: "site" } : null,
    readGeneral: async () => Buffer.from("general"),
    readCh1: async () => Buffer.from("ch1"), now: () => wall, monotonicNow: () => mono, ...overrides
  };
  const worker = createQaPilotCoordinator(options);
  const approval = { workerId: worker.workerId, id: "run", viewerId: "viewer", siteId: "site",
    expiresAt: wall + QA_PILOT_LIMITS.wallMs, ch1: "ch1", sources: ["ch1", ...Array.from({ length: 10 }, (_, i) => `source-${i}`)] };
  const args = { session: "viewer", runId: "run", sourceId: "source-0", path: "general", deliver: async () => {} };
  t.after(() => rmSync(storage, { recursive: true, force: true }));
  return { worker, approval, args, options, advance: ms => { wall += ms; mono += ms; } };
}

test("disabled and production instances reject construction", () => {
  assert.throws(() => createQaPilotCoordinator(), /QA_PILOT_DENIED/);
  assert.throws(() => createQaPilotCoordinator({ enabled: true, environment: "production" }), /QA_PILOT_DENIED/);
});

test("general and CH1 share one durable byte limit across repeated requests", async t => {
  const f = fixture(t, {
    readGeneral: async () => Buffer.alloc(QA_PILOT_LIMITS.bytes - 6),
    readCh1: async () => Buffer.alloc(3)
  });
  const run = await f.worker.open(f.approval);
  t.after(run.stop);
  await run.playback(f.args);
  const ch1 = { ...f.args, sourceId: "ch1", path: "ch1" };
  await assert.rejects(run.playback({ ...ch1, deliver: async () => { throw new Error("disconnected"); } }), /disconnected/);
  await run.playback(ch1);
  await assert.rejects(run.playback(ch1), /QA_PILOT_DENIED/);
});

test("wrong actor, wrong run, wrong source and cross-path bypass deny before read", async t => {
  const f = fixture(t, { readGeneral: () => assert.fail("unexpected read"), readCh1: () => assert.fail("unexpected read") });
  const run = await f.worker.open(f.approval);
  t.after(run.stop);
  for (const change of [{ session: "foreign" }, { runId: "other" }, { sourceId: "foreign" },
    { sourceId: "ch1" }, { path: "ch1" }]) {
    await assert.rejects(run.playback({ ...f.args, ...change }), /QA_PILOT_DENIED/);
  }
});

test("parallel paths are bounded and losing the durable file terminates the run", async t => {
  let release;
  const f = fixture(t, { readGeneral: () => new Promise(resolve => { release = resolve; }) });
  const run = await f.worker.open(f.approval);
  t.after(run.stop);
  const first = run.playback(f.args);
  await Promise.resolve();
  await assert.rejects(run.playback({ ...f.args, sourceId: "ch1", path: "ch1" }), /QA_PILOT_DENIED/);
  unlinkSync(join(f.options.storage, "run.budget"));
  release(Buffer.from("never delivered"));
  await assert.rejects(first, /QA_PILOT_DENIED/);
  await assert.rejects(createQaPilotCoordinator(f.options).open(f.approval), /QA_PILOT_DENIED/);
});

test("CH1 expires at five minutes and the entire run expires at 30 minutes", async t => {
  const f = fixture(t);
  const run = await f.worker.open(f.approval);
  t.after(run.stop);
  const ch1 = { ...f.args, sourceId: "ch1", path: "ch1" };
  await run.playback(ch1);
  f.advance(QA_PILOT_LIMITS.ch1Ms);
  await assert.rejects(run.playback(ch1), /QA_PILOT_DENIED/);
  await run.playback(f.args);
  f.advance(QA_PILOT_LIMITS.wallMs - QA_PILOT_LIMITS.ch1Ms);
  await assert.rejects(run.playback(f.args), /QA_PILOT_DENIED/);
});

test("headerless Web and native HLS use rewritten paths and one shared ledger", async t => {
  const { once } = await import("node:events");
  const { readFileSync } = await import("node:fs");
  const { createQaPilotServer } = await import("../../services/video-gateway/qa-pilot-server.mjs");
  const playlist = "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\nsegment-1.ts\n";
  let validSession = true, unsafe = false;
  const f = fixture(t, {
    authenticate: async session => validSession && session === "viewer" ? { id: "viewer", siteId: "site" } : null,
    readGeneral: async ({ object }) => Buffer.from(object === "index.m3u8" ?
      (unsafe ? playlist.replace("segment-1.ts", "https://example.invalid/live.ts") : playlist) : "general"),
    readCh1: async ({ object }) => Buffer.from(object === "index.m3u8" ?
      playlist.replace("segment-1.ts", "/ch1/segment-1.ts") : "ch1")
  });
  const candidateSha = "a".repeat(40);
  const registry = f.approval.sources.map((sourceId, i) => ({
    sourceId, siteId: "site", gatewayId: i === 10 ? "connector" : "gateway", streamId: sourceId,
    profile: i === 10 ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY", route: i === 0 ? "ch1" : "general"
  }));
  const issuerKey = "c".repeat(64);
  const server = createQaPilotServer({ ...f.options, candidateSha, registry, issuerKey });
  const listener = server.listen();
  t.after(server.close);
  await once(listener, "listening");
  assert.equal(listener.address().address, "127.0.0.1");
  const origin = `http://127.0.0.1:${listener.address().port}`;
  const open = url => fetch(origin + url);
  const input = { session: "viewer", runId: "run", sourceId: "source-0", path: "general", expectedSha: candidateSha };
  await assert.rejects(server.issueManifest(input), /QA_PILOT_DENIED/);
  const approval = { ...f.approval, workerId: server.workerId, candidateSha };
  await assert.rejects(server.authorize({ ...approval, candidateSha: "b".repeat(40) }), /QA_PILOT_DENIED/);
  await server.authorize(approval);
  await assert.rejects(server.issueManifest({ ...input, expectedSha: "b".repeat(40) }), /QA_PILOT_DENIED/);
  await assert.rejects(server.issueManifest({ ...input, session: "foreign" }), /QA_PILOT_DENIED/);
  const issue = (body, key = issuerKey) => fetch(origin + "/internal/issue", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const binding = registry[1];
  const request = { ...input, ...binding };
  assert.equal((await issue(request, "d".repeat(64))).status, 404);
  assert.equal((await issue({ ...request, gatewayId: "wrong" })).status, 404);
  assert.equal((await issue({ ...request, siteId: "foreign" })).status, 404);
  const issued = await issue(request);
  assert.equal(issued.status, 200);
  const { path: web, sha } = await issued.json();
  assert.equal(sha, candidateSha);
  assert.ok(web.startsWith("/qa/run/general/source-0/index.m3u8?r="));
  assert.equal((await open(web.split("?")[0])).status, 404);
  const webResponse = await open(web);
  assert.equal(webResponse.headers.get("x-observer-qa-build"), candidateSha);
  const manifest = await webResponse.text();
  const webSegment = manifest.split("\n").find(line => line.startsWith("/qa/"));
  assert.equal((await open(webSegment.replace("source-0", "source-1"))).status, 404);
  assert.equal((await open(webSegment.replace("segment-1", "segment-2"))).status, 404);
  assert.equal(await (await open(webSegment)).text(), "general");
  assert.equal(await (await open(webSegment)).text(), "general");
  const native = await server.issueManifest({ ...input, sourceId: "ch1", path: "ch1" });
  assert.equal((await open(webSegment)).status, 404);
  const nativeManifest = await (await open(native)).text();
  const nativeSegment = nativeManifest.split("\n").find(line => line.startsWith("/qa/"));
  assert.equal(await (await open(nativeSegment)).text(), "ch1");
  assert.equal(Number(readFileSync(join(f.options.storage, "run.budget"), "utf8")),
    Buffer.byteLength(manifest) + Buffer.byteLength(nativeManifest) + 17);
  validSession = false;
  assert.equal((await open(nativeSegment)).status, 404);
  validSession = true;
  f.advance(30_001);
  assert.equal((await open(nativeSegment)).status, 404);
  unsafe = true;
  const malicious = await server.issueManifest(input);
  assert.equal((await open(malicious)).status, 404);
});

test("QA runtime routes pinned DVR and Connector media and audits without signed URLs", async t => {
  const { createQaPilotRuntime } = await import("../../services/video-gateway/qa-pilot-runtime.mjs");
  const f = fixture(t);
  const candidateSha = "a".repeat(40);
  const issuerKey = "c".repeat(64);
  const releaseDigest = "d".repeat(64);
  const registry = f.approval.sources.map((sourceId, i) => ({
    sourceId, siteId: "site", gatewayId: i === 10 ? "connector" : "gateway", streamId: `stream-${i}`,
    profile: i === 10 ? "SOFTWARE_CONNECTOR" : "PHYSICAL_GATEWAY", route: i === 0 ? "ch1" : "general", releaseDigest
  }));
  const seen = [], audit = [];
  const reader = label => async ({ binding, object }) => {
    seen.push([label, binding.streamId]);
    return Buffer.from(object === "index.m3u8" ?
      "#EXTM3U\n#EXT-X-TARGETDURATION:2\n#EXTINF:2,\nsegment-1.ts\n" : label);
  };
  const options = {
    ...f.options, issuerKey, manifest: { kind: "observer-qa-pilot-v1", candidateSha, registry },
    gateway: { environment: "isolated-qa", gatewayId: "gateway", releaseDigest, read: reader("dvr"), readCh1: reader("ch1") },
    connector: { environment: "isolated-qa", gatewayId: "connector", releaseDigest, read: reader("tapo") },
    audit: event => audit.push(event)
  };
  assert.throws(() => createQaPilotRuntime({ ...options, connector: { ...options.connector, releaseDigest: "e".repeat(64) } }),
    /QA_RUNTIME_READER_MISMATCH/);
  const runtime = createQaPilotRuntime(options);
  const { issuerPort, mediaPort } = await runtime.listen();
  t.after(runtime.close);
  await runtime.authorize({ ...f.approval, workerId: runtime.workerId, candidateSha });
  const issuer = `http://127.0.0.1:${issuerPort}`;
  const media = `http://127.0.0.1:${mediaPort}`;
  const request = { method: "POST", headers: { authorization: `Bearer ${issuerKey}`, "content-type": "application/json" } };
  assert.equal((await fetch(media + "/internal/issue", request)).status, 404);
  assert.equal((await fetch(media + "/hls/direct/index.m3u8?token=should-not-log")).status, 404);
  for (const [index, label] of [[0, "ch1"], [1, "dvr"], [10, "tapo"]]) {
    const issue = await fetch(issuer + "/internal/issue", {
      ...request, body: JSON.stringify({ ...registry[index], session: "viewer", runId: "run", expectedSha: candidateSha })
    });
    assert.equal(issue.status, 200);
    const { path } = await issue.json();
    const manifest = await fetch(media + path);
    assert.equal(manifest.headers.get("x-observer-qa-build"), candidateSha);
    const part = (await manifest.text()).split("\n").find(line => line.startsWith("/qa/"));
    assert.equal(await (await fetch(media + part)).text(), label);
  }
  assert.deepEqual(seen, [["ch1", "stream-0"], ["ch1", "stream-0"], ["dvr", "stream-1"], ["dvr", "stream-1"], ["tapo", "stream-10"], ["tapo", "stream-10"]]);
  assert.ok(audit.some(event => event.outcome === "served"));
  assert.ok(audit.every(event => Object.keys(event).sort().join(",") === "event,outcome"));
  assert.doesNotMatch(JSON.stringify(audit), /should-not-log|\/qa\/|\?r=|Bearer/);
});
