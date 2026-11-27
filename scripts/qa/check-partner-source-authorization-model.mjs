import assert from "node:assert/strict";
import test from "node:test";

// Offline model for the proposed registrar and ownership fence. All inputs
// are synthetic trusted records. The product has no source-grant registrar.
const now = Date.parse("2026-11-27T10:00:00Z");
const binding = { tenantId: "tenant-a", siteId: "site-a", sourceId: "source-a", siteEpoch: 1, sourceEpoch: 1 };
const approver = { ...binding, actorId: "owner-a", delegationApproved: true, expiresAt: now + 60_000 };
const account = { id: "service-account-a", active: true, currentSiteAuthorization: true, mode: "source_restricted" };

function matchesOwnership(left, right) {
  return left.tenantId === right.tenantId && left.siteId === right.siteId && left.sourceId === right.sourceId &&
    left.siteEpoch === right.siteEpoch && left.sourceEpoch === right.sourceEpoch;
}

function issue(current, authority, recipient, at) {
  if (!authority?.actorId || authority.delegationApproved !== true || !(at < authority.expiresAt) ||
    !matchesOwnership(current, authority) || !recipient.active || !recipient.currentSiteAuthorization ||
    recipient.mode !== "source_restricted") return null;
  return { ...current, accountId: recipient.id, expiresAt: authority.expiresAt, revokedAt: null };
}

function mayRead(current, grant, recipient, at) {
  if (!recipient.active || !recipient.currentSiteAuthorization) return false;
  if (recipient.mode === "site") return true;
  return recipient.mode === "source_restricted" && Boolean(grant && grant.accountId === recipient.id &&
    grant.revokedAt === null && at < grant.expiresAt && matchesOwnership(current, grant));
}

test("A to B to A never revives the grant, whether the Site or source ownership changed", () => {
  const grant = issue(binding, approver, account, now);
  assert.ok(grant);
  assert.equal(mayRead(binding, grant, account, now), true);
  const transfers = [
    [{ ...binding, tenantId: "tenant-b", siteEpoch: 2 }, { ...binding, siteEpoch: 3 }],
    [{ ...binding, siteId: "site-b", sourceEpoch: 2 }, { ...binding, sourceEpoch: 3 }],
  ];
  for (const [moved, returned] of transfers) {
    assert.equal(mayRead(moved, grant, account, now + 1), false);
    assert.equal(mayRead(returned, grant, account, now + 2), false);
    assert.equal(issue(returned, approver, account, now + 2), null);
    const newApproval = { ...approver, ...returned };
    assert.equal(mayRead(returned, issue(returned, newApproval, account, now + 2), account, now + 2), true);
  }
});

test("issuer authority, revocation, expiry and exact service-account binding remain independent gates", () => {
  assert.equal(issue(binding, { ...approver, delegationApproved: false }, account, now), null);
  assert.equal(issue(binding, { ...approver, tenantId: "partner-org" }, account, now), null);
  assert.equal(issue(binding, approver, account, approver.expiresAt), null);
  const grant = issue(binding, approver, account, now);
  assert.ok(grant);
  assert.equal(mayRead(binding, { ...grant, revokedAt: now + 1 }, account, now + 1), false);
  assert.equal(mayRead(binding, grant, account, grant.expiresAt), false);
  assert.equal(mayRead(binding, { ...grant, expiresAt: NaN }, account, now), false);
  assert.equal(mayRead(binding, grant, { ...account, id: "another-account" }, now), false);
  assert.equal(mayRead(binding, grant, { ...account, currentSiteAuthorization: false }, now), false);
  assert.equal(mayRead(binding, null, account, now), false);
  assert.equal(mayRead(binding, null, { ...account, mode: "unknown" }, now), false);
  assert.equal(mayRead(binding, null, { ...account, mode: "site" }, now), true);
});
