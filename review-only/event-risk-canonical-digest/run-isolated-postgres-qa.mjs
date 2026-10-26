#!/usr/bin/env node
// Synthetic, network-disabled, mount-free PostgreSQL fixture only.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { assertSnapshotDigestsV1, digestJsonV1, snapshotDigestsV1 } from "./canonical-v1.mjs";

const dir = fileURLToPath(new URL(".", import.meta.url));
const sql = readFileSync(`${dir}CANONICAL-V1-NOT-APPLIED.sql`, "utf8");
const image = "public.ecr.aws/supabase/postgres:17.6.1.167";
const tenant = "11111111-1111-4111-8111-111111111111";
const site = "33333333-3333-4333-8333-333333333333";
let container;
let checks = 0;
function docker(args, input) {
  const r = spawnSync("docker", args, { input, encoding: "utf8", timeout: 25000, maxBuffer: 4000000 });
  if (r.error) throw r.error;
  return r;
}
function pg(statement) {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], statement);
  if (r.status !== 0) throw new Error(r.stderr.trim());
  return r.stdout.trim();
}
function denied(statement, pattern) {
  const r = docker(["exec", "-i", container, "psql", "-X", "-h", "/tmp", "-U", "postgres",
    "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-q"], statement);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, pattern);
  checks++;
}
function literalRawJson(raw) {
  return `convert_from(decode('${Buffer.from(raw, "utf8").toString("hex")}', 'hex'),'UTF8')::jsonb`;
}
function literal(value) { return literalRawJson(JSON.stringify(value)); }
function compare(value) {
  const expected = digestJsonV1(value);
  assert.equal(pg(`SELECT review_digest.digest_json_v1(${literal(value)},'GENERIC')`), expected);
  checks++;
  return expected;
}
function snapshot() {
  return { schemaVersion: 1,
    scope: { tenantId: tenant, siteId: site,
      sourceId: "55555555-5555-4555-8555-555555555555",
      eventId: "77777777-7777-4777-8777-777777777777",
      incidentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      riskDecisionId: "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
    decisionCode: "LOG_ONLY", severity: "HIGH", settingsVersion: "settings-v1",
    policyVersion: "policy-v1", capturedAt: "2026-10-27T00:00:00.000Z",
    recipients: [
      { recipientRef: "a", channels: [
        { channel: "email", enabled: false, severityLevels: ["HIGH", "LOW"] },
        { channel: "in_app", enabled: true, severityLevels: ["HIGH"] }] },
      { recipientRef: "אב😀", channels: [
        { channel: "push", enabled: true, severityLevels: [] }] }]
  };
}
function pgSnapshot(value) {
  return JSON.parse(pg(`SELECT review_digest.snapshot_digests_v1(${literal(value)},'${tenant}','${site}')`));
}
function rejectSnapshot(value, marker) {
  assert.throws(() => snapshotDigestsV1(value, tenant, site), /CANON_V1_/);
  denied(`SELECT review_digest.snapshot_digests_v1(${literal(value)},'${tenant}','${site}')`, marker);
  checks++;
}
try {
  assert.match(sql, /DRAFT_NOT_APPLIED/);
  assert.equal(docker(["context", "show"]).stdout.trim(), "colima-gbi");
  assert.equal(docker(["image", "inspect", image, "--format", "{{.Id}}"]).status, 0);
  const started = docker(["run", "--detach", "--rm", "--network", "none", "--read-only",
    "--memory", "768m", "--cpus", "1", "--pids-limit", "128", "--user", "postgres",
    "--tmpfs", "/tmp:rw,nosuid,nodev,mode=1777", "--entrypoint", "/bin/sh", image,
    "-ec", "initdb -D /tmp/qa-data -A trust --no-instructions >/dev/null && exec postgres -D /tmp/qa-data -c listen_addresses= -c unix_socket_directories=/tmp"]);
  assert.equal(started.status, 0, started.stderr);
  container = started.stdout.trim();
  assert.match(container, /^[a-f0-9]{64}$/);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (docker(["exec", container, "pg_isready", "-h", "/tmp", "-U", "postgres"]).status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready);
  denied(sql, /DRAFT_NOT_APPLIED/);
  const body = sql.slice(sql.indexOf("CREATE SCHEMA review_digest;"));
  assert.ok(body.startsWith("CREATE SCHEMA review_digest;"));
  pg(`BEGIN; ${body}\nCOMMIT;`);

  for (const value of [null, true, false, 0, -0, 1, -1, Number.MAX_SAFE_INTEGER,
    -Number.MAX_SAFE_INTEGER, "עברית 😀", "a\n'b", [], {},
    { z: null, a: [true, -31, { "é": "שלום", "😀": "x" }] },
    { capturedAt: "2026-10-27T00:00:00.000Z", a: 1 }]) compare(value);
  assert.equal(compare({ b: 2, a: 1 }), compare({ a: 1, b: 2 }));
  checks++;
  assert.notEqual(compare("é"), compare("e\u0301"));
  checks++;
  const canonical = snapshot();
  const expected = snapshotDigestsV1(canonical, tenant, site);
  assert.deepEqual(pgSnapshot(canonical), expected);
  checks++;
  const sourceStyleFingerprint = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
  const currentPgPlanStyle = pg(`SELECT encode(sha256(convert_to(${literal(canonical)}::text,'UTF8')),'hex')`);
  assert.notEqual(sourceStyleFingerprint, expected.fingerprint);
  assert.notEqual(currentPgPlanStyle, expected.fingerprint);
  checks++;
  const reordered = { recipients: canonical.recipients, capturedAt: canonical.capturedAt,
    policyVersion: canonical.policyVersion, settingsVersion: canonical.settingsVersion,
    severity: canonical.severity, decisionCode: canonical.decisionCode,
    scope: { ...canonical.scope }, schemaVersion: 1 };
  assert.deepEqual(snapshotDigestsV1(reordered, tenant, site), expected);
  assert.deepEqual(pgSnapshot(reordered), expected);
  checks++;
  assert.equal(assertSnapshotDigestsV1(canonical, tenant, site, expected), true);
  assert.equal(pg(`SELECT review_digest.assert_snapshot_digests_v1(${literal(canonical)},
    '${tenant}','${site}','${expected.fingerprint}','${expected.digest}')`), "t");
  checks++;
  const changed = { ...canonical, settingsVersion: "settings-v2" };
  assert.throws(() => assertSnapshotDigestsV1(changed, tenant, site, expected), /DIGEST_MISMATCH/);
  denied(`SELECT review_digest.assert_snapshot_digests_v1(${literal(changed)},
    '${tenant}','${site}','${expected.fingerprint}','${expected.digest}')`, /CANON_V1_DIGEST_MISMATCH/);
  denied(`SELECT review_digest.assert_snapshot_digests_v1(${literal(canonical)},
    '${tenant}','${site}','${expected.fingerprint}','${"0".repeat(64)}')`, /CANON_V1_DIGEST_MISMATCH/);

  rejectSnapshot({ ...canonical, scope: { ...canonical.scope, tenantId: site } }, /CANON_V1_SCOPE_INVALID/);
  rejectSnapshot({ ...canonical, scope: { ...canonical.scope, siteId: tenant } }, /CANON_V1_SCOPE_INVALID/);
  rejectSnapshot({ ...canonical, recipients: [canonical.recipients[0], canonical.recipients[0]] }, /CANON_V1_RECIPIENT_INVALID/);
  rejectSnapshot({ ...canonical, recipients: [{ ...canonical.recipients[0],
    channels: [canonical.recipients[0].channels[0], canonical.recipients[0].channels[0]] }] }, /CANON_V1_CHANNEL_INVALID/);
  rejectSnapshot({ ...canonical, recipients: [{ ...canonical.recipients[0], channels: [
    { ...canonical.recipients[0].channels[0], severityLevels: ["HIGH", "HIGH"] }] }] }, /CANON_V1_LEVEL_INVALID/);
  rejectSnapshot({ ...canonical, recipients: [...canonical.recipients].reverse() }, /CANON_V1_RECIPIENT_INVALID/);
  const localeOrder = ["ä", "z"].sort((a, b) => a.localeCompare(b));
  const byteOrder = ["ä", "z"].sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
  assert.notDeepEqual(localeOrder, byteOrder);
  rejectSnapshot({ ...canonical, recipients: localeOrder.map(recipientRef =>
    ({ recipientRef, channels: [] })) }, /CANON_V1_RECIPIENT_INVALID/);
  rejectSnapshot({ ...canonical, capturedAt: "2026-10-27T01:00:00.000+01:00" }, /CANON_V1_SNAPSHOT_INVALID/);
  rejectSnapshot({ ...canonical, capturedAt: "2026-02-30T00:00:00.000Z" }, /CANON_V1_SNAPSHOT_INVALID|date\/time field value out of range/);
  rejectSnapshot({ ...canonical, recipients: [{ recipientRef: "א".repeat(65), channels: [] }] }, /CANON_V1_RECIPIENT_INVALID/);
  rejectSnapshot({ ...canonical, extra: null }, /CANON_V1_SNAPSHOT_INVALID/);

  for (const value of [1.5, Number.MAX_SAFE_INTEGER + 1, "bad\0key", "\ud800"]) {
    assert.throws(() => digestJsonV1(value), /CANON_V1_/);
    checks++;
  }
  denied("SELECT review_digest.digest_json_v1('1.5'::jsonb,'GENERIC')", /CANON_V1_NUMBER_INVALID/);
  denied("SELECT review_digest.digest_json_v1('9007199254740992'::jsonb,'GENERIC')", /CANON_V1_NUMBER_INVALID/);
  denied(`SELECT review_digest.digest_json_v1(${literalRawJson('"\\u0000"')},'GENERIC')`, /unsupported Unicode escape sequence|\\u0000/);
  // jsonb and JSON.parse both discard duplicate raw object keys. This remains
  // outside the typed-value contract and is NOT claimed as safe input parsing.
  assert.equal(JSON.parse('{"a":1,"a":2}').a, 2);
  assert.equal(pg(`SELECT ${literalRawJson('{"a":1,"a":2}')}::text`), '{"a": 2}');
  checks++;
  console.log(`PASS: ${checks} isolated Node/PostgreSQL canonical-v1 checks; raw duplicate-key input and live producer remain BLOCKED.`);
} finally {
  if (container) {
    const stopped = docker(["stop", "--time", "3", container]);
    if (stopped.status !== 0) { process.exitCode = 1; console.error("FAIL: disposable container cleanup"); }
  }
}
