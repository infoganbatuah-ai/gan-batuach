import { randomUUID } from "node:crypto";
import { constants, closeSync, fstatSync, fsyncSync, lstatSync, openSync, readSync, writeSync } from "node:fs";
import { join } from "node:path";

export const QA_PILOT_LIMITS = Object.freeze({ wallMs: 1_800_000, ch1Ms: 300_000, bytes: 100 * 1024 * 1024 });
const safeId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const denied = () => new Error("QA_PILOT_DENIED");
const recordSize = 32;

// One worker owns a run. A signed approval for a previous worker cannot restart it.
export function createQaPilotCoordinator({ enabled, environment, storage, assertMounted,
  verifyApproval, authenticate, readGeneral, readCh1, now = Date.now,
  monotonicNow = () => performance.now() } = {}) {
  if (enabled !== true || environment !== "isolated-qa" ||
      ![assertMounted, verifyApproval, authenticate, readGeneral, readCh1].every(fn => typeof fn === "function")) throw denied();
  const workerId = randomUUID();
  let claimed = false;

  async function open(credential) {
    if (claimed) throw denied();
    const run = await verifyApproval(credential);
    const sources = Array.isArray(run?.sources) ? new Set(run.sources) : new Set();
    const startsAt = now();
    if (claimed || run?.workerId !== workerId || ![run?.id, run?.viewerId, run?.siteId, run?.ch1].every(safeId) ||
        sources.size !== 11 || !sources.has(run.ch1) || ![...sources].every(safeId) ||
        !Number.isSafeInteger(run.expiresAt) || run.expiresAt <= startsAt ||
        run.expiresAt - startsAt > QA_PILOT_LIMITS.wallMs || assertMounted(storage) !== true) throw denied();
    const dir = lstatSync(storage);
    if (!dir.isDirectory() || dir.uid !== process.getuid() || (dir.mode & 0o077) !== 0) throw denied();
    claimed = true;
    const path = join(storage, `${run.id}.budget`);
    const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    const deadline = monotonicNow() + (run.expiresAt - startsAt);
    const wallDeadline = run.expiresAt;
    const { viewerId, siteId, id, ch1 } = run;
    const controller = new AbortController();
    let stopped = false, busy = false, used = 0, ch1Started = null, ch1Wall = null, timer;
    function stop() {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      controller.abort();
      closeSync(fd);
    }
    function record(bytes) {
      const data = Buffer.from(String(bytes).padStart(recordSize, "0"));
      if (writeSync(fd, data, 0, recordSize, 0) !== recordSize) throw denied();
      fsyncSync(fd);
    }
    function check() {
      if (stopped) throw denied();
      try {
        const live = lstatSync(path), owned = fstatSync(fd);
        const saved = Buffer.alloc(recordSize);
        if (now() < startsAt || now() >= wallDeadline || monotonicNow() >= deadline ||
            assertMounted(storage) !== true || live.dev !== owned.dev || live.ino !== owned.ino ||
            live.size !== recordSize || (live.mode & 0o077) !== 0 ||
            readSync(fd, saved, 0, recordSize, 0) !== recordSize ||
            saved.toString() !== String(used).padStart(recordSize, "0")) throw denied();
      } catch { stop(); throw denied(); }
    }
    try { record(0); } catch { stop(); throw denied(); }
    timer = setTimeout(stop, Math.min(wallDeadline - startsAt, QA_PILOT_LIMITS.wallMs));
    timer.unref();
    async function permit({ session, runId, sourceId, path: route, signal } = {}) {
      check();
      if (runId !== id || !sources.has(sourceId) || !["general", "ch1"].includes(route) ||
          (sourceId === ch1) !== (route === "ch1")) throw denied();
      const actor = await authenticate(session, { signal });
      check();
      if (actor?.id !== viewerId || actor?.siteId !== siteId) throw denied();
    }
    async function playback({ session, runId, sourceId, path: route, object, prepare, deliver } = {}) {
      check();
      if (busy || typeof deliver !== "function") throw denied();
      busy = true;
      let ch1Timer;
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      try {
        await permit({ session, runId, sourceId, path: route, signal: request.signal });
        if (route === "ch1") {
          ch1Started ??= monotonicNow();
          ch1Wall ??= now();
          const remaining = Math.min(ch1Started + QA_PILOT_LIMITS.ch1Ms - monotonicNow(),
            ch1Wall + QA_PILOT_LIMITS.ch1Ms - now());
          if (remaining <= 0) throw denied();
          ch1Timer = setTimeout(abort, remaining);
          ch1Timer.unref();
        }
        const read = route === "ch1" ? readCh1 : readGeneral;
        const contents = await read({ sourceId, object, signal: request.signal, maxBytes: QA_PILOT_LIMITS.bytes - used });
        if (!Buffer.isBuffer(contents) || !contents.length || contents.length > QA_PILOT_LIMITS.bytes - used) {
          stop(); throw denied();
        }
        const body = prepare ? prepare(contents) : contents;
        check();
        if (request.signal.aborted || (route === "ch1" &&
            (monotonicNow() - ch1Started >= QA_PILOT_LIMITS.ch1Ms || now() - ch1Wall >= QA_PILOT_LIMITS.ch1Ms))) throw denied();
        if (!Buffer.isBuffer(body) || !body.length || used + body.length > QA_PILOT_LIMITS.bytes) {
          stop(); throw denied();
        }
        try { record(used + body.length); } catch { stop(); throw denied(); }
        used += body.length;
        await deliver(body, { signal: request.signal });
        if (used === QA_PILOT_LIMITS.bytes) stop();
      } finally {
        clearTimeout(ch1Timer);
        controller.signal.removeEventListener("abort", abort);
        busy = false;
      }
    }
    return Object.freeze({ permit, playback, stop });
  }
  return Object.freeze({ workerId, open });
}
