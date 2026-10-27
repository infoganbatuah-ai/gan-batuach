import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable, Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import test from "node:test";
import { createCiphertextGuard, writeBoundedCiphertext } from "./bounded-ciphertext-writer.mjs";

function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), "do-cipher-guard-test."));
  t.after(() => {
    assert.ok(dir.startsWith(join(tmpdir(), "do-cipher-guard-test.")));
    rmSync(dir, { recursive: true });
  });
  return { dir, file: join(dir, "ciphertext.age") };
}
function write(file, chunks, options = {}) {
  return writeBoundedCiphertext({
    ciphertext: Readable.from(chunks.map(chunk => Buffer.from(chunk))),
    outputPath: file, maxBytes: 10, minFreeBytes: 5,
    freeBytes: () => 100, ...options,
  });
}

test("exact byte ceiling succeeds; new file is private and unchanged", async t => {
  const { file } = fixture(t);
  const result = await write(file, ["123456", "7890"]);
  assert.equal(result.bytes, 10);
  assert.equal(statSync(file).size, 10);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(readFileSync(file, "utf8"), "1234567890");
});

test("one byte over ceiling is rejected before writing that chunk; partial file removed", async t => {
  const { file } = fixture(t);
  let aborted = false;
  await assert.rejects(write(file, ["1234567890", "x"],
    { abortUpstream: () => { aborted = true; } }), /CIPHERTEXT_LIMIT_EXCEEDED/);
  assert.equal(aborted, true);
  assert.equal(existsSync(file), false);
});

test("single oversized chunk contributes zero bytes to the sink", async () => {
  const { guard } = createCiphertextGuard({ maxBytes: 10, minFreeBytes: 5, freeBytes: () => 100 });
  const received = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { received.push(chunk); callback(); } });
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(11)]), guard, sink), /CIPHERTEXT_LIMIT_EXCEEDED/);
  assert.equal(received.reduce((sum, item) => sum + item.length, 0), 0);
  assert.equal(guard.acceptedBytes, 0);
});

test("crossing the ceiling between chunks never emits any bytes of the crossing chunk", async () => {
  const { guard } = createCiphertextGuard({ maxBytes: 10, minFreeBytes: 5, freeBytes: () => 100 });
  const received = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { received.push(Buffer.from(chunk)); callback(); } });
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(6, 1), Buffer.alloc(5, 2)]), guard, sink),
    /CIPHERTEXT_LIMIT_EXCEEDED/);
  assert.equal(guard.acceptedBytes, 6);
  assert.equal(received.reduce((sum, item) => sum + item.length, 0), 6);
  assert.ok(received.every(item => item.every(byte => byte === 1)));
});

test("free-space floor checks prospective chunk allocation and removes partial output", async t => {
  const { file } = fixture(t);
  let calls = 0;
  await assert.rejects(write(file, ["123", "4"], {
    freeBytes: () => ++calls < 3 ? 100 : 5,
  }), /FREE_SPACE_FLOOR_BREACHED/);
  assert.equal(existsSync(file), false);
  assert.ok(calls >= 3);
});

test("free-space floor failure before open creates no artifact", async t => {
  const { file } = fixture(t);
  await assert.rejects(write(file, ["1"], { freeBytes: () => 4 }), /FREE_SPACE_FULL_CAP_HEADROOM_MISSING/);
  assert.equal(existsSync(file), false);
});

test("full cap headroom is reserved before any write, even for a small archive", async t => {
  const { file } = fixture(t);
  let aborted = false;
  await assert.rejects(write(file, ["1"], {
    freeBytes: () => 14, abortUpstream: () => { aborted = true; },
  }), /FREE_SPACE_FULL_CAP_HEADROOM_MISSING/);
  assert.equal(aborted, true);
  assert.equal(existsSync(file), false);
});

test("buffered accepted bytes count against the free-space floor", async () => {
  const { guard } = createCiphertextGuard({ maxBytes: 10, minFreeBytes: 5, freeBytes: () => 12 });
  const received = [];
  const sink = new Writable({ write(chunk, _encoding, callback) { received.push(Buffer.from(chunk)); callback(); } });
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(6), Buffer.alloc(1), Buffer.alloc(1)]), guard, sink),
    /FREE_SPACE_FLOOR_BREACHED/);
  assert.equal(guard.acceptedBytes, 7);
  assert.equal(received.reduce((sum, item) => sum + item.length, 0), 7);
});

test("nonzero age-like process exit invalidates and removes otherwise complete ciphertext", async t => {
  const { file } = fixture(t);
  const child = spawn(process.execPath, ["-e", "process.stdout.write('cipher'); process.exit(7)"],
    { stdio: ["ignore", "pipe", "pipe"] });
  child.stderr.resume();
  const completed = new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error("AGE_PROCESS_FAILED")));
  });
  let aborted = false;
  await assert.rejects(writeBoundedCiphertext({
    ciphertext: child.stdout, outputPath: file, maxBytes: 10, minFreeBytes: 5,
    freeBytes: () => 100, upstreamCompletion: completed,
    abortUpstream: () => { aborted = true; child.kill(); },
  }), /AGE_PROCESS_FAILED|AbortError/);
  assert.equal(aborted, true);
  assert.equal(existsSync(file), false);
});

test("source-side failure invalidates a complete downstream stream", async t => {
  const { file } = fixture(t);
  let aborted = false;
  const sourceFailure = new Promise((_, reject) => setImmediate(() => reject(new Error("SOURCE_PROCESS_FAILED"))));
  await assert.rejects(write(file, ["valid"], {
    upstreamCompletion: sourceFailure,
    abortUpstream: () => { aborted = true; },
  }), /SOURCE_PROCESS_FAILED|AbortError/);
  assert.equal(aborted, true);
  assert.equal(existsSync(file), false);
});

test("ciphertext stream error propagates and cleans partial output", async t => {
  const { file } = fixture(t);
  const stream = new PassThrough();
  const promise = writeBoundedCiphertext({ ciphertext: stream, outputPath: file,
    maxBytes: 10, minFreeBytes: 5, freeBytes: () => 100 });
  stream.write(Buffer.from("abc"));
  stream.destroy(new Error("CIPHERTEXT_STREAM_FAILED"));
  await assert.rejects(promise, /CIPHERTEXT_STREAM_FAILED/);
  assert.equal(existsSync(file), false);
});

test("abort during streaming closes the output and deletes it", async t => {
  const { file } = fixture(t);
  const stream = new PassThrough();
  const controller = new AbortController();
  let abortedUpstream = false;
  const promise = writeBoundedCiphertext({ ciphertext: stream, outputPath: file,
    maxBytes: 10, minFreeBytes: 5, freeBytes: () => 100, signal: controller.signal,
    abortUpstream: () => { abortedUpstream = true; stream.destroy(); } });
  stream.write(Buffer.from("abc"));
  controller.abort(new Error("OWNER_WINDOW_ABORTED"));
  await assert.rejects(promise, /OWNER_WINDOW_ABORTED|AbortError/);
  assert.equal(abortedUpstream, true);
  assert.equal(existsSync(file), false);
});

test("abort still cleans the file if an upstream exit notification never arrives", async t => {
  const { file } = fixture(t);
  const stream = new PassThrough();
  const controller = new AbortController();
  const neverSettles = new Promise(() => {});
  const operation = writeBoundedCiphertext({ ciphertext: stream, outputPath: file,
    maxBytes: 10, minFreeBytes: 5, freeBytes: () => 100,
    upstreamCompletion: neverSettles, signal: controller.signal,
    abortUpstream: () => stream.destroy() });
  stream.write(Buffer.from("abc"));
  controller.abort(new Error("STOP_WINDOW_EXPIRED"));
  await assert.rejects(Promise.race([
    operation,
    new Promise((_, reject) => setTimeout(() => reject(new Error("CLEANUP_HUNG")), 300)),
  ]), /STOP_WINDOW_EXPIRED|AbortError/);
  assert.equal(existsSync(file), false);
});

test("pre-aborted operation terminates the already-started upstream without creating a file", async t => {
  const { file } = fixture(t);
  const controller = new AbortController();
  controller.abort(new Error("PRESTART_ABORT"));
  let abortedUpstream = false;
  await assert.rejects(write(file, ["abc"], {
    signal: controller.signal, abortUpstream: () => { abortedUpstream = true; },
  }), /PRESTART_ABORT/);
  assert.equal(abortedUpstream, true);
  assert.equal(existsSync(file), false);
});

test("upstream abort failure is reported and partial ciphertext is still removed", async t => {
  const { file } = fixture(t);
  await assert.rejects(write(file, ["12345678901"], {
    abortUpstream: () => { throw new Error("SIGNAL_REJECTED"); },
  }), error => error instanceof AggregateError && error.message === "UPSTREAM_ABORT_FAILED" &&
    error.errors.some(item => item.message === "SIGNAL_REJECTED"));
  assert.equal(existsSync(file), false);
});

test("wx never overwrites or deletes a pre-existing archive", async t => {
  const { file } = fixture(t);
  writeFileSync(file, "existing", { mode: 0o600 });
  await assert.rejects(write(file, ["new"]), /EEXIST/);
  assert.equal(readFileSync(file, "utf8"), "existing");
});
