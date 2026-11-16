import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { OBSERVER_QA_AUDIENCE, OBSERVER_QA_ISSUER_ACTIVE,
  issueObserverQaChallenge, qualifyObserverQaChallengeIssuer } from
  "../../review-only/push44-qa-device-proof/observer-challenge-issuer.mjs";

const accountId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const installationId = "33333333-3333-4333-8333-333333333333";
const challengeId = "44444444-4444-4444-8444-444444444444";
function fixture(overrides = {}) {
  const state = { live: true, approved: true, audience: OBSERVER_QA_AUDIENCE,
    claimed: false, writes: 0, receipt: null };
  const trusted = {
    authenticate: async () => state.live ? { accountId, sessionId } : null,
    now: () => 1_000,
    newId: () => challengeId,
    newNonce: () => "a".repeat(64),
    reserve: async (receipt) => {
      if (!state.live || !state.approved || state.audience !== receipt.audience
        || receipt.accountId !== accountId || receipt.sessionId !== sessionId
        || receipt.installationId !== installationId || state.claimed) return false;
      state.claimed = true;
      state.writes++;
      state.receipt = receipt;
      return true;
    },
    ...overrides
  };
  return { state, trusted, input: { installationId } };
}

test("active entrypoint remains closed", async () => {
  assert.equal(OBSERVER_QA_ISSUER_ACTIVE, false);
  assert.equal(await issueObserverQaChallenge(), null);
});

test("verified live session produces one product-bound, 60-second receipt", async () => {
  const f = fixture();
  const issued = await qualifyObserverQaChallengeIssuer(f.input, f.trusted);
  assert.deepEqual(issued, { challengeId, nonce: "a".repeat(64),
    audience: OBSERVER_QA_AUDIENCE, expiresAt: 61_000 });
  assert.equal(f.state.receipt.accountId, accountId);
  assert.equal(f.state.receipt.sessionId, sessionId);
  assert.equal(f.state.receipt.installationId, installationId);
  assert.equal(f.state.writes, 1);
  assert.equal(issued.accountId, undefined);
});

test("duplicate and concurrent issuance cannot create a second pending receipt", async () => {
  const f = fixture();
  const results = await Promise.all(Array.from({ length: 8 }, () =>
    qualifyObserverQaChallengeIssuer(f.input, f.trusted)));
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(f.state.writes, 1);
});

test("missing or revoked session fails closed", async () => {
  const f = fixture();
  f.state.live = false;
  assert.equal(await qualifyObserverQaChallengeIssuer(f.input, f.trusted), null);
  assert.equal(f.state.writes, 0);
  const racing = fixture({ authenticate: async () => {
    racing.state.live = false;
    return { accountId, sessionId };
  } });
  assert.equal(await qualifyObserverQaChallengeIssuer(racing.input, racing.trusted), null);
  assert.equal(racing.state.writes, 0);
});

test("Gan installation, unknown audience and unapproved installation are denied", async () => {
  for (const audience of ["com.ganbatuach.app.qa", "unknown.qa"]) {
    const f = fixture(); f.state.audience = audience;
    assert.equal(await qualifyObserverQaChallengeIssuer(f.input, f.trusted), null);
    assert.equal(f.state.writes, 0);
  }
  const f = fixture(); f.state.approved = false;
  assert.equal(await qualifyObserverQaChallengeIssuer(f.input, f.trusted), null);
});

test("client identity and audience fields are ignored; invalid installation and errors deny", async () => {
  const f = fixture();
  const result = await qualifyObserverQaChallengeIssuer({ installationId,
    accountId: "attacker", sessionId: "attacker", audience: "com.ganbatuach.app.qa" }, f.trusted);
  assert.equal(result.audience, OBSERVER_QA_AUDIENCE);
  assert.equal(f.state.receipt.accountId, accountId);
  assert.equal(await qualifyObserverQaChallengeIssuer({ installationId: "bad" }, f.trusted), null);
  assert.equal(await qualifyObserverQaChallengeIssuer(f.input,
    { authenticate: async () => { throw new Error("offline"); }, reserve: f.trusted.reserve }), null);
  assert.equal(await qualifyObserverQaChallengeIssuer(f.input,
    { authenticate: f.trusted.authenticate, reserve: async () => { throw new Error("offline"); } }), null);
});

test("issuer stays disconnected from routes and deployed migrations", () => {
  const source = readFileSync(new URL("../../review-only/push44-qa-device-proof/observer-challenge-issuer.mjs", import.meta.url), "utf8");
  assert.match(source, /OBSERVER_QA_ISSUER_ACTIVE = false/);
  assert.doesNotMatch(source, /\.from\(|\.rpc\(|fetch\(/);
});
