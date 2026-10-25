import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Source-only validator. Deliberately no DB client, network or child process.
const here = new URL("./", import.meta.url);
const read = path => readFileSync(new URL(path, here), "utf8");
const cases = JSON.parse(read("HOME-REGISTRATION-QUALIFICATION-CASES.json"));
const proposal = read("PROSPECTIVE-HOME-REGISTRATION.md");
const guardedSql = read("DRAFT-NOT-APPLIED.sql");
const runtimeRoute = read("../../app/api/video-gateway/cloud-events/route.ts");
const sourceContract = read("../../lib/domain/digital-observer/home-registration-ownership.ts");

test("matrix is inert, scoped and contains no target or credential fallback", () => {
  assert.equal(fileURLToPath(here).includes("/supabase/migrations/"), false);
  assert.equal(cases.status, "BLOCKED_NOT_EXECUTABLE");
  assert.equal(cases.target, null);
  assert.equal(cases.credentials, null);
  assert.equal(cases.runner, null);
  assert.doesNotMatch(JSON.stringify(cases), /postgres(?:ql)?:\/\/|SUPABASE_SERVICE_ROLE_KEY|password\s*[:=]/i);
  assert.match(proposal, /Clone target: UNVERIFIED/);
  assert.match(proposal, /Authorization A/);
  assert.match(proposal, /Authorization B/);
});

test("each future case has a bounded falsifiable result, not a PASS claim", () => {
  assert.equal(cases.cases.length, 14);
  assert.equal(new Set(cases.cases.map(item => item.id)).size, cases.cases.length);
  for (const item of cases.cases) {
    for (const key of ["id", "precondition", "action", "invariant", "evidence", "failure"]) {
      assert.equal(typeof item[key], "string", `${item.id}: ${key} missing`);
      assert(item[key].length > 12, `${item.id}: ${key} too vague`);
    }
  }
  for (const id of ["transfer_vs_acceptance", "two_approvers_one_version", "duplicate_identical",
    "duplicate_conflict", "retry_after_commit_before_reply", "rollback_before_commit",
    "mandatory_audit_failure", "replay_after_transfer", "missing_or_conflicting_ownership",
    "historical_no_receipt", "actor_denial_and_role_escalation", "recipient_separation",
    "rls_acl_data_api", "client_crash_vs_server_durability"]) {
    assert(cases.cases.some(item => item.id === id), `${id} absent`);
  }
});

test("source-grounded authority notes keep logical Home ID and broad admin unresolved", () => {
  assert.match(proposal, /homeId` is a logical contract field/);
  assert.match(proposal, /Platform Admin candidate/);
  assert.match(proposal, /not a fresh health/i);
  assert.match(proposal, /no new DDL\/RPC bodies are presented as executable/);
  assert.match(sourceContract, /export interface TrustedHomeRegistrationStore/);
  assert.match(sourceContract, /acceptedEvent\(eventId: string\)/);
});

test("existing SQL abort guard and runtime isolation remain intact", () => {
  const executable = guardedSql.split("\n").filter(line => !line.trimStart().startsWith("--")).join("\n");
  assert.match(executable, /^\s*BEGIN;\s*DO \$draft_guard\$/);
  assert.match(executable, /RAISE EXCEPTION 'DRAFT_NOT_APPLIED/);
  assert.doesNotMatch(executable, /^\s*COMMIT\s*;/im);
  assert.doesNotMatch(runtimeRoute, /home-registration-ownership|observer_home_registration_versions/);
  assert.match(proposal, /notifications\.ts` is unchanged/);
});

test("validator has no execution capability", () => {
  const self = read("check-home-registration-qualification-package.mjs");
  assert.doesNotMatch(self, /^import .*from ["'](?:node:child_process|pg|@supabase\/supabase-js)/m);
  assert.doesNotMatch(self, /^\s*(?:await )?(?:fetch|spawn|execFile)\(/m);
});
