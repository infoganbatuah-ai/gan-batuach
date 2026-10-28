import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const helper = join(dirname(fileURLToPath(import.meta.url)), "synthetic-age-pty-fd-decrypt.py");

test("synthetic age bridge authenticates into the disjoint target only", () => {
  const root = mkdtempSync(join(tmpdir(), "do-age-bridge."));
  try {
    const source = join(root, "synthetic-components");
    const target = join(root, "synthetic-decrypted");
    mkdirSync(source, { mode: 0o700 });
    mkdirSync(target, { mode: 0o700 });
    for (const dir of [source, target])
      writeFileSync(join(dir, ".synthetic-only"), "synthetic\n", { mode: 0o600 });
    const generated = execFileSync("/opt/homebrew/bin/age-keygen", [],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const key = generated.match(/^AGE-SECRET-KEY-1[A-Z0-9]+$/m)?.[0];
    const recipient = generated.match(/^# public key: (age1[023456789acdefghjklmnpqrstuvwxyz]+)$/m)?.[1];
    assert.ok(key && recipient);
    const ciphertext = join(source, "postgres.age");
    const encrypted = execFileSync("/opt/homebrew/bin/age", ["-r", recipient],
      { input: Buffer.from("synthetic-only\n") });
    writeFileSync(ciphertext, encrypted, { mode: 0o600 });
    const invoke = (input, destination, src = ciphertext) => spawnSync("/usr/bin/python3",
      [helper, "--synthetic-decrypt", source, target, src, destination],
      { input: `${input}\n`, encoding: "utf8" });
    const plain = join(target, "postgres.age.plain");
    assert.equal(invoke(key, plain).status, 0);
    assert.equal(readFileSync(plain, "utf8"), "synthetic-only\n");
    assert.equal((statSync(plain).mode & 0o077), 0);
    const wrongGenerated = execFileSync("/opt/homebrew/bin/age-keygen", [],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    const wrongKey = wrongGenerated.match(/^AGE-SECRET-KEY-1[A-Z0-9]+$/m)?.[0];
    assert.ok(wrongKey);
    const wrong = join(target, "wrong.plain");
    assert.notEqual(invoke(wrongKey, wrong).status, 0);
    assert.equal(existsSync(wrong), false);
    const corrupt = join(source, "corrupt.age");
    const damaged = Buffer.from(encrypted);
    damaged[damaged.length - 1] ^= 1;
    writeFileSync(corrupt, damaged, { mode: 0o600 });
    const corruptOut = join(target, "corrupt.plain");
    assert.notEqual(invoke(key, corruptOut, corrupt).status, 0);
    assert.equal(existsSync(corruptOut), false);
    const sourceOut = join(source, "forbidden.plain");
    assert.notEqual(invoke(key, sourceOut).status, 0);
    assert.equal(existsSync(sourceOut), false);
  } finally { rmSync(root, { recursive: true }); }
});
