import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHomeLegacyPrivateExecutor } from "./home-legacy-private-executor.mjs";

const MIN_FREE_BYTES = 1024 ** 3;

// The disk identity is checked before each one-shot operation. If the drive is
// removed, its mount path can reappear on the internal disk; path existence is
// therefore never sufficient. No credential, verifier or network input is read.
export function inspectHomeLegacyKingston(mount) {
  if (typeof mount !== "string" || !mount.startsWith("/Volumes/"))
    throw new TypeError("EXPLICIT_EXTERNAL_MOUNT_REQUIRED");
  const plist = execFileSync("/usr/sbin/diskutil", ["info", "-plist", mount],
    { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  const json = execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"],
    { input: plist, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  return JSON.parse(json);
}

export function inspectHomeLegacyKingstonMountOptions(mount) {
  if (typeof mount !== "string" || !mount.startsWith("/Volumes/"))
    throw new TypeError("EXPLICIT_EXTERNAL_MOUNT_REQUIRED");
  const output = execFileSync("/sbin/mount", [],
    { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  const line = output.split("\n").find(value =>
    value.includes(` on ${mount} (`));
  return line?.slice(line.indexOf("(") + 1, line.lastIndexOf(")"))
    .split(",").map(value => value.trim()) ?? [];
}

export function createHomeLegacyKingstonGuard({ configuration,
  inspect = inspectHomeLegacyKingston,
  inspectMountOptions = inspectHomeLegacyKingstonMountOptions,
  requireArtifactDirectory = true, realpath = realpathSync, stat = statSync } = {}) {
  if (!configuration || typeof configuration !== "object" ||
    ["mount", "volumeUuid", "source", "artifacts"].some(key => typeof configuration[key] !== "string") ||
    configuration.fallbackStorage !== false ||
    [inspect, inspectMountOptions, realpath, stat].some(value => typeof value !== "function"))
    throw new TypeError("KINGSTON_GUARD_REQUIRED");
  const { mount: expectedMount, volumeUuid, source, artifacts } = configuration;
  return () => {
    try {
      const info = inspect(expectedMount);
      if (info.MountPoint !== expectedMount ||
        info.VolumeUUID !== volumeUuid ||
        info.FilesystemType !== "apfs" || info.FileVault !== true ||
        info.Encryption !== true || info.WritableVolume !== true ||
        !Number.isSafeInteger(info.APFSContainerFree) || info.APFSContainerFree < MIN_FREE_BYTES)
        return false;
      const options = inspectMountOptions(expectedMount);
      if (!Array.isArray(options) || !options.includes("apfs") || options.includes("noowners"))
        return false;
      const mount = realpath(expectedMount);
      if (mount !== expectedMount) return false;
      const rootDevice = stat(mount).dev;
      for (const path of [source, artifacts]) {
        const absolute = resolve(path);
        if (absolute !== path || !absolute.startsWith(`${mount}${sep}`)) return false;
        const existing = requireArtifactDirectory || path !== artifacts ? path : resolve(path, "..");
        const canonical = realpath(existing);
        if (canonical !== existing || stat(existing).dev !== rootDevice) return false;
      }
      return true;
    } catch { return false; }
  };
}

// Reuses the existing comparison core. The guard is a mandatory capability;
// there is deliberately no fallback directory, API endpoint or DB connection.
export function createHomeLegacyKingstonExecutor({ hostGuard, ...dependencies }) {
  if (typeof hostGuard !== "function") throw new TypeError("KINGSTON_GUARD_REQUIRED");
  const existing = createHomeLegacyPrivateExecutor(dependencies);
  let used = false;
  return Object.freeze({
    async compare(input) {
      try {
        if (used) return "UNKNOWN";
        used = true;
        if (await hostGuard() !== true) return "UNKNOWN";
        const result = await existing.compare(input);
        return await hostGuard() === true ? result : "UNKNOWN";
      } catch { return "UNKNOWN"; }
    }
  });
}
