import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";

// Intercept only the existing authenticated API boundary. No Auth, database,
// provider or application route is called by these local adapter tests.
const stubUrl = `data:text/javascript,${encodeURIComponent(`
  let response = null;
  let failure = null;
  let calls = [];
  export function configure(next, error = null) { response = next; failure = error; calls = []; }
  export function requests() { return calls; }
  export async function getDigitalObserverApiUser(request) {
    calls.push(request);
    if (failure) throw failure;
    return response;
  }
`)}`;
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "./access.js" && context.parentURL?.endsWith("home-registration-owner-session.server.ts")) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
} });
const boundary = await import(stubUrl);
const { createVerifiedHomeOwnerSessionReader } =
  await import("../../lib/domain/digital-observer/home-registration-owner-session.server.ts");
const { ownerOnlyHomeActorResolver } =
  await import("../../lib/domain/digital-observer/home-registration-ownership.ts");

const ownerId = "owner-a";
function currentRequest(token = "synthetic-test-token") {
  return new Request("http://127.0.0.1/qa-control", { headers: { authorization: `Bearer ${token}` } });
}
function verifiedSession(id = ownerId, overrides = {}) {
  return { user: { id, email: "untrusted@example.invalid", user_metadata: { role: "admin" } },
    profile: { id, active: true }, accessToken: "synthetic-test-token", ...overrides };
}

test("exact current verified user, active session and active profile yield ephemeral observation only", async () => {
  boundary.configure(verifiedSession());
  const request = currentRequest();
  const result = await createVerifiedHomeOwnerSessionReader(request).sessionForActor(ownerId);
  assert.equal(boundary.requests().length, 1);
  assert.equal(boundary.requests()[0], request);
  assert.equal(result?.authenticatedUserId, ownerId);
  assert.equal(result?.sessionAuthenticated, true);
  assert.equal(result?.sessionActive, true);
  assert.equal(result?.profileActive, true);
  assert.match(result?.evidenceRef ?? "", /^SESSION_VERIFIED_ONLY:request-local:[0-9a-f-]{36}$/);
  assert.equal(result?.evidenceRef.includes("synthetic-test-token"), false);
  assert(result.expiresAtMs - result.observedAtMs <= 5_000);
});

test("missing or malformed Bearer credential cannot fall back to cookies", async () => {
  boundary.configure(verifiedSession());
  for (const authorization of [null, "Basic test", "Bearer ", "Bearer one two"]) {
    const request = new Request("http://127.0.0.1/qa-control", {
      headers: authorization ? { authorization } : {}
    });
    assert.equal(await createVerifiedHomeOwnerSessionReader(request).sessionForActor(ownerId), null);
  }
  assert.equal(boundary.requests().length, 0);
});

test("wrong actor, profile mismatch and inactive or missing profile fail closed", async () => {
  for (const [session, actor] of [
    [verifiedSession(), "other-actor"],
    [verifiedSession(ownerId, { profile: { id: "other-profile", active: true } }), ownerId],
    [verifiedSession(ownerId, { profile: { id: ownerId, active: false } }), ownerId],
    [verifiedSession(ownerId, { profile: null }), ownerId],
    [verifiedSession(ownerId, { accessToken: null }), ownerId],
    [null, ownerId]
  ]) {
    boundary.configure(session);
    assert.equal(await createVerifiedHomeOwnerSessionReader(currentRequest()).sessionForActor(actor), null);
  }
});

test("revoked or expired session and backend failure remain denied", async () => {
  // Canonical helper returns null for failed getUser/session-active/profile;
  // this stub checks adapter mapping, not actual Supabase revocation behavior.
  boundary.configure(null);
  assert.equal(await createVerifiedHomeOwnerSessionReader(currentRequest()).sessionForActor(ownerId), null);
  boundary.configure(null, new Error("synthetic backend failure"));
  assert.equal(await createVerifiedHomeOwnerSessionReader(currentRequest()).sessionForActor(ownerId), null);
});

test("client metadata and supplied labels cannot override verified identity", async () => {
  boundary.configure(verifiedSession("other-actor", { user: { id: "other-actor",
    email: "owner@example.invalid", app_metadata: { digital_observer_admin: true } },
  profile: { id: "other-actor", active: true } }));
  assert.equal(await createVerifiedHomeOwnerSessionReader(currentRequest()).sessionForActor(ownerId), null);
});

test("separate requests do not reuse an earlier authenticated observation", async () => {
  const first = createVerifiedHomeOwnerSessionReader(currentRequest());
  boundary.configure(verifiedSession());
  assert(await first.sessionForActor(ownerId));
  const second = createVerifiedHomeOwnerSessionReader(currentRequest());
  boundary.configure(verifiedSession("other-actor"));
  assert.equal(await second.sessionForActor(ownerId), null);
  assert.equal(await first.sessionForActor(ownerId), null);
});

test("a valid session never bypasses canonical Home owner and Source scope", async () => {
  boundary.configure(verifiedSession());
  const resolver = ownerOnlyHomeActorResolver(createVerifiedHomeOwnerSessionReader(currentRequest()));
  const candidate = { registrationId: "registration-a", version: 1, tenantId: "tenant-a",
    siteId: "site-a", sourceId: "source-a", ownerProfileId: ownerId,
    registeringActorId: "installer-a", state: "CANDIDATE" };
  const facts = { tenantId: "tenant-a", tenantOwnerProfileId: ownerId,
    siteId: "site-a", siteTenantId: "tenant-a", siteOwnerProfileId: ownerId,
    siteType: "home", siteGardenId: null, siteActive: true,
    sourceId: "source-a", sourceSiteId: "site-a", ownerProfileId: ownerId,
    ownerProfileActive: true, tenantActive: true, tenantStatus: "active" };
  assert.equal((await resolver.authorizeRegistration(ownerId, candidate, facts))?.basis, "HOME_OWNER");
  assert.equal(await resolver.authorizeRegistration(ownerId, candidate,
    { ...facts, siteOwnerProfileId: "other-owner" }), null);
  assert.equal(await resolver.authorizeRegistration(ownerId, candidate,
    { ...facts, sourceSiteId: "site-b" }), null);
});

test("source containment: canonical Bearer verification is read-only; no active route imports adapter", () => {
  const adapter = readFileSync(new URL("../../lib/domain/digital-observer/home-registration-owner-session.server.ts", import.meta.url), "utf8");
  const access = readFileSync(new URL("../../lib/domain/digital-observer/access.ts", import.meta.url), "utf8");
  const rpc = readFileSync(new URL("../../supabase/migrations/20261023161928_digital_observer_push44_session_validity.sql", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("../../app/api/video-gateway/cloud-events/route.ts", import.meta.url), "utf8");
  assert.match(access, /auth\.getUser\(accessToken\)/);
  assert.match(access, /digital_observer_current_session_active/);
  assert.match(access, /persistSession: false, autoRefreshToken: false/);
  assert.match(rpc, /language sql\s+stable\s+security definer/);
  assert.match(rpc, /from auth\.sessions s/);
  assert.doesNotMatch(adapter, /getSession\(|createAdminClient|service_role|cookies\(/);
  assert.doesNotMatch(ingest, /home-registration-owner-session|ownerOnlyHomeActorResolver/);
});
