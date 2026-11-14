import { rm } from "node:fs/promises";
import { isAbsolute, normalize, relative } from "node:path";

function cleanupErrorCode(error) {
  return String(error?.code || error?.name || "RELAY_DIRECTORY_CLEANUP_FAILED")
    .replace(/[^A-Za-z0-9_.:-]/g, "_")
    .slice(0, 80);
}

function isContainedDirectory(root, directory) {
  const candidate = normalize(String(directory || ""));
  if (!isAbsolute(candidate) || candidate === root) return false;
  const fromRoot = relative(root, candidate);
  return fromRoot !== "" && fromRoot !== ".." &&
    !fromRoot.startsWith("../") && !isAbsolute(fromRoot);
}

export function createRelayDirectoryCleanupQueue({
  root,
  remove = directory => rm(directory, { recursive: true, force: true }),
  mayRemove = () => true,
  now = Date.now,
  onResult = () => {}
} = {}) {
  const normalizedRoot = normalize(String(root || ""));
  if (!isAbsolute(normalizedRoot) || typeof remove !== "function" ||
    typeof mayRemove !== "function" || typeof now !== "function" ||
    typeof onResult !== "function") {
    throw new Error("RELAY_DIRECTORY_CLEANUP_CONFIG_INVALID");
  }

  const pending = new Set();
  let tail = Promise.resolve();

  function report(result) {
    try { onResult(result); } catch {}
  }

  function enqueue(directories = []) {
    let queued = 0;
    for (const directory of new Set(directories.filter(Boolean)
      .map(value => normalize(String(value))))) {
      if (!isContainedDirectory(normalizedRoot, directory) || pending.has(directory)) continue;
      pending.add(directory);
      queued += 1;
      tail = tail.then(async () => {
        const startedAt = now();
        try {
          if (!mayRemove(directory)) {
            report({ status: "SKIPPED_ACTIVE", duration_ms: Math.max(0, now() - startedAt) });
            return;
          }
          await remove(directory);
          report({ status: "COMPLETED", duration_ms: Math.max(0, now() - startedAt) });
        } catch (error) {
          report({ status: "FAILED", duration_ms: Math.max(0, now() - startedAt),
            error_code: cleanupErrorCode(error) });
        } finally {
          pending.delete(directory);
        }
      });
    }
    return queued;
  }

  return {
    enqueue,
    idle: () => tail,
    status: () => ({ pending: pending.size })
  };
}
