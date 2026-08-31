import { execFile } from "node:child_process";

// Keep Keychain I/O off the media event loop. Concurrent reads of the same
// item share one bounded process; no secret is cached on disk or logged.
export function createKeychainStore({ service, timeoutMs = 5_000, execute = execFile }) {
  const reads = new Map();
  const invoke = (args, allowMissing = false) => new Promise((resolve, reject) => {
    execute("/usr/bin/security", args, { encoding: "utf8", timeout: timeoutMs, maxBuffer: 64 * 1024 }, (error, stdout) => {
      if (error && !(allowMissing && error.code === 44)) return reject(new Error("Gateway Keychain operation unavailable"));
      resolve(error ? "" : String(stdout || "").trim());
    });
  });
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
