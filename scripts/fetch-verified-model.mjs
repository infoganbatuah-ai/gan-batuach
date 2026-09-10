import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const catalog = JSON.parse(readFileSync(new URL("../config/digital-observer-model-artifacts.json", import.meta.url), "utf8"));
const args = Object.fromEntries(process.argv.slice(2).map((value) => { const index = value.indexOf("="); return index < 0 ? [value, true] : [value.slice(0, index), value.slice(index + 1)]; }));
const model = catalog.models.find((item) => item.id === (args["--model"] || "ssd_mobilenet_v1_10"));
if (!model) throw new Error("MODEL_NOT_IN_APPROVED_CATALOG");
if (args["--metadata-only"]) {
  console.log(JSON.stringify({ status: "PASS", model: model.id, sha256: model.sha256, license: model.license, source: model.source_url, downloaded: false }));
  process.exit(0);
}
if (!args["--out"]) throw new Error("MODEL_OUTPUT_PATH_REQUIRED");
const output = resolve(args["--out"]);
mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
if (existsSync(output)) {
  const current = createHash("sha256").update(readFileSync(output)).digest("hex");
  if (current === model.sha256) {
    console.log(JSON.stringify({ status: "PASS", model: model.id, output, sha256: current, reused_verified: true }));
    process.exit(0);
  }
  throw new Error("EXISTING_MODEL_CHECKSUM_MISMATCH");
}
const temporary = `${output}.${process.pid}.partial`;
try {
  const response = await fetch(model.source_url, { redirect: "follow", signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`MODEL_DOWNLOAD_FAILED_${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== model.sha256 || bytes.length !== model.size_bytes) throw new Error("MODEL_ARTIFACT_INTEGRITY_MISMATCH");
  writeFileSync(temporary, bytes, { mode: 0o644, flag: "wx" });
  renameSync(temporary, output);
  chmodSync(output, 0o644);
  console.log(JSON.stringify({ status: "PASS", model: model.id, output, size_bytes: bytes.length, sha256, source: model.source_url }));
} finally {
  rmSync(temporary, { force: true });
}
