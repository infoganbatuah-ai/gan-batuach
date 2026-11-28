#!/usr/bin/env node
// Read-only provenance manifest. Never connects to a database or repairs history.
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sha = (value) => createHash("sha256").update(value).digest("hex");
const read = (path) => readFileSync(join(root, path));
const receiptPath = "development/database/development-application-receipts.json";
const baselinePath = "development/database/baselines/development-c0cf2de7-20260919-v1/bootstrap-receipt.json";
const noGoPath = "review-only/qa-zero-overlay-bootstrap/push38t-upgrade-no-go-20261123.md";
const receipt = JSON.parse(read(receiptPath));
const baseline = JSON.parse(read(baselinePath));
const evidence = new Map(receipt.migrations.map((row, index) => [row.version, { ...row, index }]));
const names = readdirSync(join(root, "supabase/migrations"))
  .filter((name) => /^\d{14}_.+\.sql$/.test(name)).sort();
if (names.length !== 275 || evidence.size !== receipt.migrations.length) {
  throw new Error("Unexpected migration count or duplicate receipt version");
}
let chain = "0".repeat(64);
const counts = { "independently-proven-applied": 0, "source-only": 0, unknown: 0, conflicting: 0 };
const rows = names.map((name) => {
  const version = name.slice(0, 14);
  const sourceHash = sha(read(`supabase/migrations/${name}`));
  const record = evidence.get(version);
  let classification = "source-only";
  let pointer = "source file only";
  if (record) {
    classification = record.filename === `supabase/migrations/${name}` &&
      record.source_digest === sourceHash && record.applied_at && record.schema_fingerprint
      ? "independently-proven-applied" : "conflicting";
    pointer = `${receiptPath}#/migrations/${record.index}`;
  }
  counts[classification]++;
  chain = sha(`${chain}\n${version}\t${sourceHash}\t${classification}\t${pointer}`);
  return `| ${version} | ${name} | ${sourceHash} | ${classification} | ${pointer} | ${chain} |`;
});
for (const version of evidence.keys()) {
  if (!names.some((name) => name.startsWith(`${version}_`))) throw new Error(`Receipt version absent from source: ${version}`);
}
const body = `# Migration evidence manifest — 2026-11-23

This is a **read-only** source/receipt comparison. It makes no database connection and does not repair application migration history. The classifications below describe the original Development receipt, **not** the September push38t dump. Every push38t applied-version status remains **unknown** because that dump has no \`supabase_migrations\` schema or registry.

## Evidence and decision

- Source migration files: ${names.length}; unique versions: ${new Set(names.map((name) => name.slice(0, 14))).size}.
- Independently recorded Development applications with matching source SHA-256, timestamp, and schema fingerprint: ${counts["independently-proven-applied"]}. Source-only: ${counts["source-only"]}. Unknown classification: ${counts.unknown}. Conflicting: ${counts.conflicting}.
- Application receipt: \`${receiptPath}\`, SHA-256 \`${sha(read(receiptPath))}\`, observed \`${receipt.observedAt}\`, target \`${receipt.environment}\`, integration commit \`${receipt.integrationCommit}\`.
- Baseline receipt: \`${baselinePath}\`, SHA-256 \`${sha(read(baselinePath))}\`, applied \`${baseline.appliedAt}\`, historical source count ${baseline.historicalSourceCount}, \`historicalReplayClaim=${baseline.historicalReplayClaim}\`. Its schema equality is not per-version application proof.
- push38t restore receipt: \`${noGoPath}\`, SHA-256 \`${sha(read(noGoPath))}\`. Dump SHA-256 \`0378650eee71fb7bcd003c7f92ab3dc15109f7f9d6c44f25fe5e45b180ffae7c\`; application migration registry absent.
- Hash chain starts at 64 zero hex digits. Each row's \`chain_sha256\` is SHA-256 of \`previous_chain + "\\n" + version + "\\t" + source_sha256 + "\\t" + classification + "\\t" + evidence_pointer\`. Final chain: \`${chain}\`.

**NO-GO for upgrading the push38t dump.** The 30 matched application receipts attest to a different original Development target and do not supply the missing registry for this dump. The remaining ${counts["source-only"]} source files have no individual application receipt in this evidence set. No contiguous, authentic applied-version sequence can be established for push38t without guessing. Recommend a new empty isolated Supabase QA database and source-only replay of versions 1–275 for fresh QA; this has already passed locally. Do not represent it as an upgrade of the old dump. PR #656 remains Draft; no hosted SQL or merge is authorized by this manifest.

## Per-version manifest

| Version | Source file | Source SHA-256 | Evidence class | Evidence pointer | Chain SHA-256 |
| --- | --- | --- | --- | --- | --- |
${rows.join("\n")}
`;
const output = join(root, "review-only/qa-zero-overlay-bootstrap/migration-evidence-manifest-20261123.md");
writeFileSync(output, body);
console.log(JSON.stringify({ files: names.length, ...counts, finalChain: chain }));
