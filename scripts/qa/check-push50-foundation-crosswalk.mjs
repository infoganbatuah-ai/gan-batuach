import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const crosswalkPath = "review-only/push50-evidence-preparation/FOUNDATION-BOUNDARY-CROSSWALK.md";
const source = readFileSync(crosswalkPath, "utf8");
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const allowedClasses = new Set([
  "SOURCE_CONTRACT", "MIGRATION_TEXT", "HISTORICAL_RECEIPT",
  "CI_CONTRACT", "LOCAL_RECEIPT", "EXTERNAL_GAP"
]);

function verifyCrosswalk(text) {
  const lines = text.split("\n").filter((line) => /^\| A\d{2} \|/.test(line));
  assert.equal(lines.length, 18, "exactly 18 scoped anchors required");
  const ids = new Set();
  const paths = new Set();
  const rows = new Map();
  for (const line of lines) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 6, "anchor table must have six columns");
    const [id, boundary, markedPath, markedSha, proofClass, remaining] = cells;
    assert.match(id, /^A\d{2}$/);
    assert.ok(!ids.has(id), `duplicate anchor ${id}`);
    ids.add(id);
    assert.ok(boundary && remaining, `${id}: boundary and open gate required`);
    assert.match(markedPath, /^`[^`]+`$/);
    const path = markedPath.slice(1, -1);
    assert.ok(!path.startsWith("/") && !path.split("/").includes(".."), `${id}: unsafe path`);
    assert.ok(!paths.has(path), `${id}: duplicate path`);
    paths.add(path);
    assert.match(markedSha, /^`[a-f0-9]{40}`$/);
    assert.ok(allowedClasses.has(proofClass), `${id}: unknown proof class`);
    assert.equal(git("rev-parse", `HEAD:${path}`), markedSha.slice(1, -1), `${id}: stale/missing tracked blob`);
    rows.set(id, { path, proofClass, remaining });
  }
  assert.deepEqual([...ids].sort(), Array.from({ length: 18 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`));
  assert.equal(rows.get("A04").proofClass, "MIGRATION_TEXT");
  assert.equal(rows.get("A08").proofClass, "HISTORICAL_RECEIPT");
  assert.equal(rows.get("A09").proofClass, "HISTORICAL_RECEIPT");
  assert.match(rows.get("A09").remaining, /NOT_DONE/);
  assert.equal(rows.get("A16").proofClass, "CI_CONTRACT");
  assert.equal(rows.get("A17").proofClass, "LOCAL_RECEIPT");
  assert.match(rows.get("A17").remaining, /canonical Turbopack build.*unproven/);
  assert.equal(rows.get("A18").proofClass, "EXTERNAL_GAP");
  for (const boundary of [
    /Guard OFF/, /Native Access BLOCKED/, /PUSH 44\s+PARTIAL/,
    /retention v1 ENGINEERING_BASELINE/, /PUSH 46 NOT STARTED/,
    /PUSH 50 remains PREPARATION ONLY/, /does \*\*not\*\* promote[\s\S]*24h PASS/
  ]) assert.ok(boundary.test(text), `missing binding boundary ${boundary}`);

  const ownership = JSON.parse(git("show", "HEAD:DIGITAL_OBSERVER_CAPABILITY_PUSH_OWNERSHIP_MAP.json"));
  assert.equal(ownership.canonicalRoadmapPushCount, 52);
  assert.equal(ownership.reconciledCapabilityCount, 197);
  const push38 = JSON.parse(git("show", "HEAD:DIGITAL_OBSERVER_PUSH_38_FINITE_EPOCH_DRAIN_CLOSURE_EVIDENCE.json"));
  assert.equal(push38.continuous_24h_pass_claimed, false);
  assert.equal(push38.recovery_validation.strict_status, "NOT_DONE");
  const external = JSON.parse(git("show", "HEAD:DIGITAL_OBSERVER_EXTERNAL_ACTIVATION_PROOF_REGISTER.json"));
  assert.equal(external.syntheticMediaEdge20261023.realCh1MediaAccess, false);
  assert.equal(external.mobileOwnerQualification20261022.actualCameraVideo, "NOT_PROVEN");
  return rows.size;
}

const count = verifyCrosswalk(source);
if (process.argv.includes("--self-test")) {
  assert.throws(() => verifyCrosswalk(source.replace(
    "`aac4d1255363a90e7b2d7263d99d1a69768d0ec9`", "`0000000000000000000000000000000000000000`"
  )), /stale\/missing tracked blob/);
  assert.throws(() => verifyCrosswalk(source.replace(
    "PUSH 50 remains PREPARATION ONLY", "PUSH 50 COMPLETE"
  )), /missing binding boundary/);
}
console.log(`PUSH50 foundation crosswalk: ${count} pinned anchors; 52 PUSH / 197 capabilities; strict PUSH38 and external gates preserved${process.argv.includes("--self-test") ? "; negative checks PASS" : ""}`);
