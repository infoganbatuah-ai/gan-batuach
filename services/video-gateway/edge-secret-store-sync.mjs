import { randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { validateSecretAccount } from "./edge-runtime-contract.mjs";

export function createEdgeSecretStoreSync({ keychainService = "", secretDir = "" }) {
  const helper = process.env.OBSERVER_KEYCHAIN_HELPER || "";
  if (!keychainService && !secretDir) throw new Error("Secure edge secret store is not configured");
  if (secretDir) {
    mkdirSync(secretDir, { recursive: true, mode: 0o700 });
    chmodSync(secretDir, 0o700);
  }
  const pathFor = (account) => join(secretDir, validateSecretAccount(account));
  return Object.freeze({
    kind: secretDir ? "secure_volume" : "macos_keychain",
    read(account) {
      if (!secretDir && helper) {
        const result = spawnSync(helper, ["--secret", "read", keychainService, validateSecretAccount(account)], { encoding: "utf8", timeout: 5000 });
        if (result.status === 44) return "";
        if (result.status !== 0) throw new Error("CONNECTOR_KEYCHAIN_UNAVAILABLE");
        return result.stdout;
      }
      if (secretDir) {
        const path = pathFor(account);
        if (!existsSync(path)) return "";
        const info = lstatSync(path);
        if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) !== 0) throw new Error("Connector secret permissions are unsafe");
        return readFileSync(path, "utf8").trim();
      }
      const result = spawnSync("/usr/bin/security", ["find-generic-password", "-s", keychainService, "-a", validateSecretAccount(account), "-w"], { encoding: "utf8" });
      return result.status === 0 ? result.stdout.trim() : "";
    },
    write(account, value) {
      if (!secretDir && helper) {
        const result = spawnSync(helper, ["--secret", "write", keychainService, validateSecretAccount(account)], { input: String(value), encoding: "utf8", timeout: 5000 });
        if (result.status !== 0) throw new Error("CONNECTOR_KEYCHAIN_UNAVAILABLE");
        return;
      }
      if (secretDir) {
        const path = pathFor(account);
        const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
        writeFileSync(temporary, String(value), { mode: 0o600, flag: "wx" });
        renameSync(temporary, path);
        chmodSync(path, 0o600);
        return;
      }
      execFileSync("/usr/bin/security", ["add-generic-password", "-U", "-s", keychainService, "-a", validateSecretAccount(account), "-w", String(value)], { stdio: "ignore" });
    },
    remove(account) {
      if (!secretDir && helper) {
        const result = spawnSync(helper, ["--secret", "remove", keychainService, validateSecretAccount(account)], { encoding: "utf8", timeout: 5000 });
        if (![0, 44].includes(result.status)) throw new Error("CONNECTOR_KEYCHAIN_UNAVAILABLE");
        return;
      }
      if (secretDir) {
        const path = pathFor(account);
        if (existsSync(path)) unlinkSync(path);
        return;
      }
      spawnSync("/usr/bin/security", ["delete-generic-password", "-s", keychainService, "-a", validateSecretAccount(account)], { stdio: "ignore" });
    }
  });
}
