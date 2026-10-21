import { execFileSync } from "node:child_process";
import { realpathSync, statSync } from "node:fs";
import { resolve, sep } from "node:path";
import { createHomeLegacyPrivateExecutor } from "./home-legacy-private-executor.mjs";

export const HOME_LEGACY_KINGSTON_MOUNT = "/Volumes/DIGITAL_OBSERVER";
export const HOME_LEGACY_KINGSTON_VOLUME_UUID = "D5D524FA-1545-43EE-AC1B-9771D2A7D526";
export const HOME_LEGACY_KINGSTON_SOURCE = `${HOME_LEGACY_KINGSTON_MOUNT}/Projects/Gan-Batuach/worktrees/home-telemetry-prelive-qualification`;
export const HOME_LEGACY_KINGSTON_ARTIFACTS = `${HOME_LEGACY_KINGSTON_MOUNT}/Projects/Gan-Batuach/exports/restricted/home-legacy-private-compare`;
const MIN_FREE_BYTES = 1024 ** 3;

// The disk identity is checked before each one-shot operation. If the drive is
// removed, its mount path can reappear on the internal disk; path existence is
// therefore never sufficient. No credential, verifier or network input is read.
export function inspectHomeLegacyKingston() {
  const plist = execFileSync("/usr/sbin/diskutil", ["info", "-plist", HOME_LEGACY_KINGSTON_MOUNT],
    { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  const json = execFileSync("/usr/bin/plutil", ["-convert", "json", "-o", "-", "-"],
    { input: plist, encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  return JSON.parse(json);
}

export function inspectHomeLegacyKingstonMountOptions() {
  const output = execFileSync("/sbin/mount", [],
    { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024 });
  const line = output.split("\n").find(value =>
    value.includes(` on ${HOME_LEGACY_KINGSTON_MOUNT} (`));
  return line?.slice(line.indexOf("(") + 1, line.lastIndexOf(")"))
    .split(",").map(value => value.trim()) ?? [];
}

export function createHomeLegacyKingstonGuard({ inspect = inspectHomeLegacyKingston,
  inspectMountOptions = inspectHomeLegacyKingstonMountOptions,
  source = HOME_LEGACY_KINGSTON_SOURCE, artifacts = HOME_LEGACY_KINGSTON_ARTIFACTS,
  requireArtifactDirectory = true, realpath = realpathSync, stat = statSync } = {}) {
  if ([inspect, inspectMountOptions, realpath, stat].some(value => typeof value !== "function"))
    throw new TypeError("KINGSTON_GUARD_REQUIRED");
  return () => {
    try {
      const info = inspect();
      if (info.MountPoint !== HOME_LEGACY_KINGSTON_MOUNT ||
        info.VolumeUUID !== HOME_LEGACY_KINGSTON_VOLUME_UUID ||
        info.FilesystemType !== "apfs" || info.FileVault !== true ||
        info.Encryption !== true || info.WritableVolume !== true ||
        !Number.isSafeInteger(info.APFSContainerFree) || info.APFSContainerFree < MIN_FREE_BYTES)
        return false;
      const options = inspectMountOptions();
      if (!Array.isArray(options) || !options.includes("apfs") || options.includes("noowners"))
        return false;
      const mount = realpath(HOME_LEGACY_KINGSTON_MOUNT);
      if (mount !== HOME_LEGACY_KINGSTON_MOUNT) return false;
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
  return Object.freeze({
    async compare(input) {
      try {
        if (await hostGuard() !== true) return "UNKNOWN";
        const result = await existing.compare(input);
        return await hostGuard() === true ? result : "UNKNOWN";
      } catch { return "UNKNOWN"; }
    }
  });
}
