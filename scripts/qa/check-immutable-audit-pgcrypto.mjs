import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260901010500_fix_immutable_audit_hash_pgcrypto.sql", import.meta.url),
  "utf8"
);
const sql = migration.replace(/^--.*$/gm, "");

assert.match(sql, /create extension if not exists pgcrypto with schema extensions;/i);
assert.match(sql, /extension\.extname = 'pgcrypto'[\s\S]*namespace\.nspname = 'extensions'/i);
assert.match(sql, /set search_path = pg_catalog, pg_temp/i);
assert.doesNotMatch(sql, /set search_path\s*=\s*[^;]*(?:public|extensions)/i);
assert.equal((sql.match(/extensions\.digest\(/g) ?? []).length, 2);
assert.doesNotMatch(sql, /(?<!extensions\.)digest\(/);
assert.match(sql, /create or replace function public\.set_immutable_audit_hash\(\)/i);
assert.match(sql, /security definer/i);
assert.match(sql, /from public\.immutable_audit_events/i);
assert.match(sql, /savepoint immutable_audit_pgcrypto_self_test/i);
assert.match(sql, /set local time zone 'UTC'/i);
assert.match(sql, /rollback to savepoint immutable_audit_pgcrypto_self_test/i);
assert.match(sql, /release savepoint immutable_audit_pgcrypto_self_test/i);
assert.equal((sql.match(/insert into public\.immutable_audit_events/gi) ?? []).length, 2);
assert.equal((sql.match(/immutable_audit_pgcrypto_self_test'/g) ?? []).length, 2);
assert.match(sql, /first_row\.event_hash is distinct from '[a-f0-9]{64}'/i);
assert.match(sql, /length\(first_row\.event_hash\) is distinct from 64/i);
assert.match(sql, /second_row\.previous_event_hash is distinct from first_row\.event_hash/i);
assert.match(sql, /second_row\.event_hash is distinct from '[a-f0-9]{64}'/i);
assert.match(sql, /length\(second_row\.event_hash\) is distinct from 64/i);
assert.doesNotMatch(sql, /(?:event_hash|previous_event_hash|length\([^)]*event_hash\))\s*<>/i);

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const fixtureHash = ({ id, timestamp, sequence, previous }) => {
  const metadataHash = sha256(`{"sequence": ${sequence}, "self_test": "pgcrypto_schema"}`);
  return sha256([
    id,
    "immutable_audit_pgcrypto_self_test",
    "security",
    "",
    "migration",
    "",
    "",
    "",
    "",
    "",
    timestamp,
    metadataHash,
    previous
  ].join("|"));
};
const firstHash = fixtureHash({
  id: "0199a8bb-4db0-7f8f-8d91-96e4f58921b4",
  timestamp: "2099-01-01 00:00:00+00",
  sequence: 1,
  previous: "0".repeat(64)
});
const secondHash = fixtureHash({
  id: "0199a8bb-4db0-7f8f-8d91-96e4f58921b5",
  timestamp: "2099-01-01 00:00:01+00",
  sequence: 2,
  previous: firstHash
});
assert.equal(firstHash, "a3a47da63b11cf2ea69adf5b61d3fab0e7659654958f1ea6cdede6e69f44c6e6");
assert.equal(secondHash, "9e1c9e4cd793e83218870787c0ef781ad6db708d856c9d01bfadf92687dac36a");
assert.match(sql, new RegExp(firstHash, "i"));
assert.match(sql, new RegExp(secondHash, "i"));

console.log("Immutable audit pgcrypto schema regression check passed.");
