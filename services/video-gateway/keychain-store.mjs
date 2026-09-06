import { execFile } from "node:child_process";
import { chmod, lstat, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { validateSecretAccount } from "./edge-runtime-contract.mjs";

// Keep Keychain I/O off the media event loop. Concurrent reads of the same
// item share one bounded process; no secret is cached on disk or logged.
export function createKeychainStore({ service, secretDir = "", timeoutMs = 5_000, execute = execFile }) {
  const reads = new Map();
  const invoke = (args, allowMissing = false) => new Promise((resolve, reject) => {
    execute("/usr/bin/security", args, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error && !(allowMissing && error.code === 44)) return reject(new Error("Gateway Keychain operation unavailable"));
      resolve(error ? "" : String(stdout || "").trim());
    });
  });
  async function securePath(account) {
    validateSecretAccount(account);
    const path = join(secretDir, account);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await chmod(dirname(path), 0o700);
    return path;
  }
  const fileStore = secretDir ? {
    async read(account) {
      const path = await securePath(account);
      try {
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("Connector secret permissions are unsafe");
        return (await readFile(path, "utf8")).trim();
      } catch (error) {
        if (error?.code === "ENOENT") return "";
        throw error;
      }
    },
    async write(account, value) {
      const path = await securePath(account);
      const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(temporary, String(value), { mode: 0o600, flag: "wx" });
      await chmod(temporary, 0o600);
      await rename(temporary, path);
      await chmod(path, 0o600);
    },
    async remove(account) {
      const path = await securePath(account);
      await unlink(path).catch((error) => { if (error?.code !== "ENOENT") throw error; });
    }
  } : null;
  if (fileStore) return fileStore;
  return {
    read(account) {
      if (!service) return Promise.resolve("");
      if (reads.has(account)) return reads.get(account);
      const read = invoke(["find-generic-password", "-s", service, "-a", account, "-w"], true).finally(() => {
        if (reads.get(account) === read) reads.delete(account);
      });
      reads.set(account, read);
      return read;
    },
    async write(account, value) {
      if (!service) throw new Error("Gateway Keychain service is unavailable");
      await invoke(["add-generic-password", "-U", "-s", service, "-a", account, "-w", value]);
    },
    async remove(account) {
      if (!service) throw new Error("Gateway Keychain service is unavailable");
      await invoke(["delete-generic-password", "-s", service, "-a", account], true);
    }
  };
}
