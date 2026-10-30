import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeBestEffortStatusJson } from
  "../../services/video-gateway/best-effort-status-file.mjs";

const root = mkdtempSync(join(tmpdir(), "push38-status-write-"));
try {
  const destination = join(root, "journal-status.json");
  writeFileSync(destination, "{\"status\":\"last-good\"}\n", { mode: 0o600 });
  const failed = writeBestEffortStatusJson(destination, { status: "new" }, {
    write() { const error = new Error("disk full"); error.code = "ENOSPC"; throw error; },
    rename() { throw new Error("rename must not run after failed write"); },
    unlink() {}, nonce: () => "fixed"
  });
  assert.deepEqual(failed, { ok: false, error_code: "ENOSPC" });
  assert.equal(readFileSync(destination, "utf8"), "{\"status\":\"last-good\"}\n",
    "an ENOSPC telemetry write must preserve the last complete status snapshot");

  const written = writeBestEffortStatusJson(destination, { status: "healthy" }, {
    nonce: () => "success"
  });
  assert.deepEqual(written, { ok: true, error_code: null });
  assert.equal(JSON.parse(readFileSync(destination, "utf8")).status, "healthy");

  const supervisor = readFileSync("scripts/run-persistent-home-gateway.mjs", "utf8");
  assert.match(supervisor, /writeRuntimeStatus\(destination, status, "continuous_monitor"\)/);
  assert.match(supervisor, /writeRuntimeStatus\(`\$\{dataRoot\}\/journal-status\.json`, status,/);
  assert.doesNotMatch(supervisor,
    /report: \(status\) => writeFileSync\(`\$\{dataRoot\}\/journal-status\.json`/,
    "journal telemetry must not own the live supervisor lifecycle");
  console.log("PUSH38_RUNTIME_DISK_PRESSURE_PASS");
} finally {
  rmSync(root, { recursive: true, force: true });
}
