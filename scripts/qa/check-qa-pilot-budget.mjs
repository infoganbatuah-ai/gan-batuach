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
  const server = createQaPilotServer({ ...f.options, candidateSha, registry });
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
  const web = await server.issueManifest(input);
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
