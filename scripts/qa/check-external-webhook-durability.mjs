import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { loadTs } from "./digital-guard-test-loader.mjs";

const { transitionForProviderOutcome } = loadTs("lib/domain/digital-observer/notification-orchestration.ts");
const start = Date.parse("2026-11-27T10:00:00Z");
const expiresAt = new Date(start + 300_000).toISOString();
const binding = { tenantId: "tenant-a", siteId: "site-a", eventId: "event-a", subscriptionId: "subscription-a" };
const payloadHash = createHash("sha256").update("synthetic canonical reference").digest("hex");
const deliveryId = createHash("sha256").update(JSON.stringify([binding.tenantId, binding.siteId, binding.eventId, binding.subscriptionId])).digest("hex");

// Synthetic, sequential QA journal. Atomic publication supports reopening the
// fixture after an interrupted attempt. Concurrent writers are outside this model.
function openJournal(path, authorization) {
  function read() { return JSON.parse(readFileSync(path, "utf8")); }
  function save(row) {
    writeFileSync(`${path}.next`, JSON.stringify(row), { mode: 0o600 });
    renameSync(`${path}.next`, path);
  }
  function authorized(row) {
    return authorization.active && authorization.tenantId === row.tenantId && authorization.siteId === row.siteId &&
      authorization.subscriptionId === row.subscriptionId && authorization.keyVersion === row.keyVersion;
  }
  function owns(row, claim, now) {
    return row.deliveryId === claim.deliveryId && row.attempt === claim.attempt && row.owner === claim.owner &&
      row.keyVersion === claim.keyVersion && now < row.leaseUntil;
  }
  return {
    read,
    enqueue(input) {
      const current = read();
      if (current) {
        const sameDelivery = current.deliveryId === input.deliveryId && current.payloadHash === input.payloadHash &&
          current.tenantId === input.tenantId && current.siteId === input.siteId && current.eventId === input.eventId &&
          current.subscriptionId === input.subscriptionId && current.keyVersion === input.keyVersion;
        if (!sameDelivery) throw new Error("DELIVERY_CONFLICT");
        return false;
      }
      save({ ...input, attempt: 0, status: "queued", retryAt: null });
      return true;
    },
    claim(owner, now) {
      const row = read();
      if (!["queued", "retry_scheduled"].includes(row.status) || !authorized(row) || now >= Date.parse(row.expiresAt) ||
        row.attempt >= row.maxAttempts || (row.retryAt && now < Date.parse(row.retryAt))) return null;
      const claim = { deliveryId: row.deliveryId, keyVersion: row.keyVersion, owner, attempt: row.attempt + 1 };
      save({ ...row, ...claim, leaseUntil: now + 10_000, status: "claimed", retryAt: null });
      return claim;
    },
    begin(claim, now) {
      const row = read();
      if (!owns(row, claim, now) || row.status !== "claimed" || !authorized(row) || now >= Date.parse(row.expiresAt)) return false;
      save({ ...row, status: "dispatching" });
      return true;
    },
    finish(claim, outcome, now) {
      const row = read();
      if (!owns(row, claim, now) || row.status !== "dispatching") return false;
      const result = transitionForProviderOutcome({
        outcome, attemptCount: row.attempt, maxAttempts: row.maxAttempts, expiresAt: row.expiresAt, now: new Date(now),
      });
      const status = outcome === "unknown_outcome" || outcome === "acknowledged" ? outcome : result.status;
      save({ ...row, status, retryAt: result.retryAt });
      return true;
    },
    recover(now) {
      const row = read();
      if (now < row.leaseUntil || !["claimed", "dispatching"].includes(row.status)) return row.status;
      if (row.status === "dispatching") {
        save({ ...row, status: "unknown_outcome", retryAt: null });
        return "unknown_outcome";
      }
      const result = transitionForProviderOutcome({
        outcome: "temporary_failure", attemptCount: row.attempt, maxAttempts: row.maxAttempts, expiresAt: row.expiresAt, now: new Date(now),
      });
      save({ ...row, status: result.status, retryAt: result.retryAt });
      return result.status;
    },
    // The caller supplies evidence from the fixture's separate receiver journal.
    // Production would require a separately authenticated receipt contract.
    reconcile(receipt) {
      const row = read();
      if (row.status !== "unknown_outcome" || receipt.deliveryId !== row.deliveryId ||
        receipt.subscriptionId !== row.subscriptionId || receipt.payloadHash !== row.payloadHash ||
        receipt.keyVersion !== row.keyVersion || receipt.attempt !== row.attempt || receipt.accepted !== true) return false;
      save({ ...row, status: "acknowledged", retryAt: null });
      return true;
    },
  };
}

function fixture(t) {
  const directory = mkdtempSync(new URL("../../.webhook-journal-", import.meta.url).pathname);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const path = join(directory, "outbox.json");
  const peerPath = join(directory, "peer-receipt.json");
  const input = { ...binding, deliveryId, payloadHash, keyVersion: 1, maxAttempts: 3, expiresAt };
  const authorization = { ...binding, active: true, keyVersion: 1 };
  writeFileSync(path, "null", { mode: 0o600 });
  return { input, authorization, peerPath, open: () => openJournal(path, authorization) };
}

test("a receiver ACK followed by an interrupted sender leaves an unknown outcome, with reconciliation only", (t) => {
  const { input, peerPath, open } = fixture(t);
  const sender = open();
  assert.equal(sender.enqueue(input), true);
  const claim = sender.claim("worker-a", start);
  assert.equal(sender.begin(claim, start), true);
  const receipt = { deliveryId, subscriptionId: input.subscriptionId, attempt: claim.attempt, payloadHash, keyVersion: 1, accepted: true };
  writeFileSync(peerPath, JSON.stringify(receipt), { mode: 0o600 });
  // The original sender never records its acknowledgement.
  const reopened = open();
  const afterLease = start + 10_001;
  assert.equal(reopened.recover(afterLease), "unknown_outcome");
  assert.equal(reopened.claim("worker-b", afterLease), null);
  assert.equal(sender.finish(claim, "acknowledged", afterLease), false);
  assert.equal(reopened.reconcile({ ...receipt, keyVersion: 2 }), false);
  assert.equal(reopened.reconcile({ ...receipt, subscriptionId: "subscription-b" }), false);
  assert.equal(reopened.reconcile(JSON.parse(readFileSync(peerPath, "utf8"))), true);
  assert.equal(open().read().status, "acknowledged");
  assert.equal(reopened.reconcile(receipt), false);
  assert.equal(reopened.claim("worker-b", afterLease), null);
});

test("duplicate work uses one identity; only known-unsent work can be reclaimed under fresh authorization", (t) => {
  const { input, authorization, open } = fixture(t);
  const sender = open();
  assert.equal(sender.enqueue(input), true);
  assert.equal(open().enqueue(input), false);
  assert.throws(() => open().enqueue({ ...input, payloadHash: "conflict" }), /DELIVERY_CONFLICT/);
  const first = sender.claim("worker-a", start);
  assert.equal(open().claim("worker-b", start), null);
  const recovered = open();
  assert.equal(recovered.recover(start + 10_001), "retry_scheduled");
  const due = Date.parse(recovered.read().retryAt);
  assert.equal(recovered.claim("worker-b", due - 1), null);
  authorization.siteId = "site-b";
  assert.equal(recovered.claim("worker-b", due), null);
  authorization.siteId = input.siteId;
  authorization.keyVersion = 2;
  assert.equal(recovered.claim("worker-b", due), null);
  authorization.keyVersion = 1;
  const next = recovered.claim("worker-b", due);
  assert.equal(next.deliveryId, first.deliveryId);
  assert.equal(next.attempt, first.attempt + 1);
  assert.equal(sender.begin(first, due), false);
  authorization.active = false;
  assert.equal(recovered.begin(next, due), false);
  authorization.active = true;
  assert.equal(recovered.begin(next, due), true);
  assert.equal(recovered.finish(next, "unknown_outcome", due), true);
  assert.equal(open().read().status, "unknown_outcome");
  assert.equal(open().claim("worker-c", due + 60_000), null);
});

test("the send deadline prevents a new attempt while an already received ACK remains evidence", (t) => {
  const { input, open } = fixture(t);
  const journal = open();
  assert.equal(journal.enqueue(input), true);
  const deadline = Date.parse(input.expiresAt);
  const claim = journal.claim("worker-a", deadline - 1);
  assert.equal(journal.begin(claim, deadline - 1), true);
  assert.equal(journal.finish(claim, "acknowledged", deadline + 1), true);
  assert.equal(open().read().status, "acknowledged");
  assert.equal(open().claim("worker-b", deadline + 1), null);
});
