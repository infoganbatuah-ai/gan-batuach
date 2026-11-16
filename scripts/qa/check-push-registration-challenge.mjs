import assert from "node:assert/strict";
import { test } from "node:test";
import { encodePushRegistrationChallenge, pushRegistrationChallengeHash, InMemoryPushChallengeFixture } from "../../lib/domain/push-registration-challenge.ts";

const start = Date.parse("2026-11-16T00:00:00.000Z");
const gan = { audience: "gan_management", provider: "fcm", appId: "com.ganbatuach.app", profileId: "profile-1",
  installationId: "install-1", providerToken: "synthetic-token-1", nonce: "nonce-1",
  expiresAt: "2026-11-16T00:01:00.000Z" };
const observer = { ...gan, audience: "digital_observer", appId: "com.digitalobserver.app.qa", nonce: "nonce-2" };

test("canonical bytes are stable and every bound identity changes the digest", () => {
  assert.equal(Buffer.compare(encodePushRegistrationChallenge(gan), encodePushRegistrationChallenge({ ...gan })), 0);
  const digest = pushRegistrationChallengeHash(gan);
  for (const change of [
    { profileId: "profile-2" }, { installationId: "install-2" }, { providerToken: "synthetic-token-2" },
    { nonce: "nonce-3" }, { provider: "apns" }, { expiresAt: "2026-11-16T00:02:00.000Z" }
  ]) assert.notEqual(pushRegistrationChallengeHash({ ...gan, ...change }), digest);
  assert.notEqual(pushRegistrationChallengeHash(observer), digest);
  assert.throws(() => encodePushRegistrationChallenge({ ...gan, appId: observer.appId }));
  assert.throws(() => encodePushRegistrationChallenge({ ...observer, appId: gan.appId }));
  assert.throws(() => encodePushRegistrationChallenge({ ...gan, audience: "__proto__" }));
  assert.throws(() => encodePushRegistrationChallenge({ ...gan, provider: "unknown" }));
  assert.notEqual(pushRegistrationChallengeHash({ ...gan, profileId: "a:b" }), pushRegistrationChallengeHash({ ...gan, profileId: "a", installationId: "b:install-1" }));
});

test("synthetic already-verified verdict consumes once; wrong inputs do not consume", () => {
  const fixture = new InMemoryPushChallengeFixture();
  fixture.issue(gan, start);
  assert.equal(fixture.consume({ ...gan, providerToken: "other" }, start, true), false);
  assert.equal(fixture.consume({ ...gan, provider: "apns" }, start, true), false);
  assert.equal(fixture.consume({ ...gan, profileId: "other" }, start, true), false);
  assert.equal(fixture.consume(gan, start, false), false);
  assert.equal(fixture.consume(gan, start, true), true);
  assert.equal(fixture.consume(gan, start, true), false);
});

test("expiry, revocation, duplicate nonce and parallel callers fail closed", async () => {
  const expired = new InMemoryPushChallengeFixture();
  expired.issue(gan, start);
  assert.equal(expired.consume(gan, Date.parse(gan.expiresAt), true), false);
  const revoked = new InMemoryPushChallengeFixture();
  revoked.issue(observer, start);
  revoked.revoke(observer.nonce);
  assert.equal(revoked.consume(observer, start, true), false);
  const fixture = new InMemoryPushChallengeFixture();
  fixture.issue(gan, start);
  assert.throws(() => fixture.issue({ ...gan, providerToken: "another" }, start));
  const results = await Promise.all(Array.from({ length: 20 }, async () => fixture.consume(gan, start, true)));
  assert.equal(results.filter(Boolean).length, 1);
});
