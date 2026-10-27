#!/usr/bin/env node
// Restore qualification entry point. Invoke only in a separately approved,
// isolated restore with decrypted Storage tar on stdin. Never extracts files.
import { readFileSync, statSync } from "node:fs";
import { verifyDecryptedStorageTar } from "./verify-decrypted-storage-tar.mjs";

const safe = error => /^[A-Z][A-Z0-9_]{4,80}$/.test(String(error?.message ?? ""))
  ? error.message : "STORAGE_ARCHIVE_GATE_FAILED";

try {
  if (process.argv.length !== 4 || process.argv[2] !== "--receipt")
    throw new Error("RECEIPT_ARGUMENT_REQUIRED");
  if (statSync(process.argv[3]).size > 4 * 1024 ** 2)
    throw new Error("STORAGE_RECEIPT_SIZE_CAP");
  const receipt = JSON.parse(readFileSync(process.argv[3], "utf8"));
  const result = await verifyDecryptedStorageTar(process.stdin, receipt);
  process.stdout.write(JSON.stringify(result) + "\n");
} catch (error) {
  process.stderr.write(safe(error) + "\n");
  process.exitCode = 1;
}
