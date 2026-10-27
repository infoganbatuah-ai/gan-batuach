// Stream guard for ciphertext only. Caller must put age stdout, never plaintext,
// on `ciphertext` and must terminate its producer when abortUpstream is called.
import assert from "node:assert/strict";
import { closeSync, createWriteStream, existsSync, lstatSync, openSync, statfsSync, statSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

export const MAX_CIPHERTEXT_BYTES = 1024 ** 3;
export const MIN_INTERNAL_FREE_BYTES = 3 * 1024 ** 3;

function validLimit(value, name) {
  assert.ok(Number.isSafeInteger(value) && value >= 0, `${name}_INVALID`);
}

export function createCiphertextGuard({ maxBytes, minFreeBytes, freeBytes }) {
  validLimit(maxBytes, "MAX_BYTES");
  validLimit(minFreeBytes, "MIN_FREE_BYTES");
  assert.equal(typeof freeBytes, "function", "FREE_BYTES_CALLBACK_REQUIRED");
  let acceptedBytes = 0;
  const checkFree = length => {
    const available = freeBytes();
    // Some accepted chunks may still be buffered rather than allocated on disk.
    // Subtracting the whole accepted total is deliberately conservative.
    if (!Number.isSafeInteger(available) || available - acceptedBytes - length < minFreeBytes)
      throw new Error("FREE_SPACE_FLOOR_BREACHED");
  };
  const checkFullCapHeadroom = () => {
    const available = freeBytes();
    if (!Number.isSafeInteger(available) || available - maxBytes < minFreeBytes)
      throw new Error("FREE_SPACE_FULL_CAP_HEADROOM_MISSING");
  };
  const guard = new Transform({
    transform(chunk, _encoding, callback) {
      try {
        assert.ok(Buffer.isBuffer(chunk), "CIPHERTEXT_CHUNK_NOT_BINARY");
        const length = chunk.byteLength;
        if (length > maxBytes - acceptedBytes) throw new Error("CIPHERTEXT_LIMIT_EXCEEDED");
        checkFree(length); // Check prospective allocation before accepting a chunk.
        acceptedBytes += length;
        callback(null, chunk);
      } catch (error) { callback(error); }
    },
  });
  Object.defineProperty(guard, "acceptedBytes", { get: () => acceptedBytes });
  return { guard, checkFree, checkFullCapHeadroom };
}

export async function writeBoundedCiphertext({
  ciphertext, outputPath, maxBytes = MAX_CIPHERTEXT_BYTES,
  minFreeBytes = MIN_INTERNAL_FREE_BYTES,
  freeBytes = () => {
    const filesystem = statfsSync(dirname(outputPath));
    return Number(filesystem.bavail) * Number(filesystem.bsize);
  },
  upstreamCompletion = Promise.resolve(), abortUpstream = () => {}, signal,
}) {
  assert.equal(typeof abortUpstream, "function", "ABORT_UPSTREAM_CALLBACK_REQUIRED");
  // A caller may have already started tar and age before this preflight.
  // Consume a later rejection even when preflight fails before the pipeline.
  Promise.resolve(upstreamCompletion).catch(() => {});

  let fd;
  let sink;
  let guard;
  let checkFree;
  let created = false;
  let streamTask;
  let upstreamTask;
  let upstreamError;
  const controller = new AbortController();
  const onAbort = () => controller.abort(signal.reason ?? new Error("CIPHERTEXT_ABORTED"));
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    assert.ok(ciphertext && typeof ciphertext.pipe === "function", "CIPHERTEXT_STREAM_REQUIRED");
    assert.ok(typeof outputPath === "string" && outputPath.length > 0, "OUTPUT_PATH_REQUIRED");
    const parent = lstatSync(dirname(outputPath));
    assert.ok(parent.isDirectory() && parent.uid === process.getuid() && (parent.mode & 0o077) === 0,
      "PRIVATE_OUTPUT_DIRECTORY_REQUIRED");
    if (signal?.aborted) throw signal.reason ?? new Error("CIPHERTEXT_ABORTED");
    const limits = createCiphertextGuard({ maxBytes, minFreeBytes, freeBytes });
    guard = limits.guard;
    checkFree = limits.checkFree;
    limits.checkFullCapHeadroom();
    fd = openSync(outputPath, "wx", 0o600); // O_EXCL: never overwrite a prior artifact.
    created = true;
    sink = createWriteStream(outputPath, { fd, autoClose: true });
    fd = undefined; // The write stream now owns and closes it.
    streamTask = pipeline(ciphertext, guard, sink, { signal: controller.signal });
    upstreamTask = Promise.resolve(upstreamCompletion).catch(error => {
      upstreamError = error;
      controller.abort(error);
      throw error;
    });
    await Promise.all([streamTask, upstreamTask]);
    checkFree(0);
    const bytes = statSync(outputPath).size;
    assert.equal(bytes, guard.acceptedBytes, "CIPHERTEXT_FILE_SIZE_MISMATCH");
    assert.ok(bytes > 0, "EMPTY_CIPHERTEXT");
    return { bytes };
  } catch (error) {
    controller.abort(error);
    let abortFailure;
    try {
      if (await abortUpstream() === false) throw new Error("UPSTREAM_ABORT_REJECTED");
    } catch (failure) { abortFailure = failure; }
    // The producer may be wedged (for example, an unavailable Docker daemon).
    // The stream must close and the partial file must be removed without waiting
    // indefinitely for that producer's exit notification.
    if (streamTask) await Promise.allSettled([streamTask]);
    upstreamTask?.catch(() => {});
    if (fd !== undefined) closeSync(fd);
    if (created && existsSync(outputPath)) unlinkSync(outputPath);
    if (abortFailure) throw new AggregateError([upstreamError ?? error, abortFailure], "UPSTREAM_ABORT_FAILED");
    throw upstreamError ?? error;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }
}
