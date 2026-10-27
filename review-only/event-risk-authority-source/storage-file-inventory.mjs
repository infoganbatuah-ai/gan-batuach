// Read-only source-side inventory. Output contains hashes, sizes and opaque path
// digests only; never names, contents or an unencrypted archive.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, lstatSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.env.DO_STORAGE_ROOT;
const maxFiles = 20_000;
const maxBytes = 1024 ** 3;

async function main() {
  assert.ok(root && lstatSync(root).isDirectory(), "STORAGE_ROOT_INVALID");
  const files = [];
  let totalBytes = 0;
  async function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      const first = lstatSync(path);
      if (first.isDirectory()) { await walk(path); continue; }
      assert.ok(first.isFile(), "STORAGE_NONREGULAR_ENTRY");
      assert.ok(files.length < maxFiles, "STORAGE_FILE_COUNT_CAP");
      assert.ok(first.size <= maxBytes - totalBytes, "STORAGE_BYTE_CAP");
      const hash = createHash("sha256");
      for await (const chunk of createReadStream(path)) hash.update(chunk);
      const second = lstatSync(path);
      assert.ok(first.ino === second.ino && first.size === second.size &&
        first.mtimeMs === second.mtimeMs && first.ctimeMs === second.ctimeMs,
      "STORAGE_FILE_CHANGED_DURING_HASH");
      totalBytes += first.size;
      files.push({ pathDigest: createHash("sha256").update(relative(root, path)).digest("hex"),
        bytes: first.size, sha256: hash.digest("hex") });
    }
  }
  await walk(root);
  files.sort((a, b) => a.pathDigest.localeCompare(b.pathDigest));
  process.stdout.write(JSON.stringify({ count: files.length, totalBytes, files }) + "\n");
}

main().catch(error => {
  // The source path or error details may be sensitive; only stable codes escape.
  const allowed = new Set(["STORAGE_ROOT_INVALID", "STORAGE_NONREGULAR_ENTRY", "STORAGE_FILE_COUNT_CAP",
    "STORAGE_BYTE_CAP", "STORAGE_FILE_CHANGED_DURING_HASH"]);
  process.stderr.write((allowed.has(error.message) ? error.message : "STORAGE_INVENTORY_IO_ERROR") + "\n");
  process.exitCode = 1;
});
