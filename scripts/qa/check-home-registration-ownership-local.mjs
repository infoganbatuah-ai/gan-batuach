import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({ resolve(specifier, context, nextResolve) {
  return nextResolve(/\/(event-risk-ownership-snapshot|event-risk-recovery|event-risk-fenced-writes|model-a-ownership)\.js$/.test(specifier)
    ? specifier.replace(/\.js$/, ".ts") : specifier, context);
} });
const { qualifyProspectiveHomeRegistration, bindProspectiveHomeEvent, prospectiveHomeEventReader } =
  await import("../../lib/domain/digital-observer/home-registration-ownership.ts");
const { validatePrePersistEventOwnership } =
  await import("../../lib/domain/digital-observer/event-risk-ownership-snapshot.ts");

const candidate = Object.freeze({ state: "CANDIDATE", registrationId: "registration-a", version: 1,
  homeId: "home-a", tenantId: "tenant-a", siteId: "site-a", sourceId: "source-a",
  ownerProfileId: "owner-a", registeringActorId: "installer-a" });
const facts = Object.freeze({ homeId: "home-a", tenantId: "tenant-a", siteId: "site-a",
  sourceId: "source-a", ownerProfileId: "owner-a", homeActive: true, tenantActive: true,
  siteIsHome: true, sourceAssignedToSite: true, siteOwnedByTenant: true,
  tenantOwnedByProfile: true, contradictoryAssociation: false });
const accepted = Object.freeze({ eventId: "event-a", siteId: "site-a", sourceId: "source-a",
  registrationId: "registration-a", registrationVersion: 1, authorityRef: "trusted-owner-proof-a",
  acceptanceRef: "server-acceptance-a" });
function fixture() {
  let pending = candidate;
  let liveFacts = facts;
  let liveAccepted = accepted;
  let live = null;
  const versions = new Map();
  const bindings = new Map();
  const audit = [];
  const store = {
    async candidate() { return pending; },
    async facts() { return liveFacts; },
    async current() { return live; },
    async qualifiedVersion(id, version) { return versions.get(`${id}:${version}`) ?? null; },
    async acceptedEvent() { return liveAccepted; },
    async eventBinding(id) { return bindings.get(id) ?? null; },
    async qualify(row, actor) {
      if (pending !== row || (live && row.version !== live.version + 1) || (!live && row.version !== 1)) {
        throw new Error("SYNTHETIC_CAS_CONFLICT");
      }
      const result = Object.freeze({ ...row, state: "QUALIFIED", authorizedActorId: actor.actorId,
        authorityRef: actor.evidenceRef, auditRef: `audit-qualification-${row.version}` });
      live = result;
      versions.set(`${row.registrationId}:${row.version}`, result);
      pending = null;
      audit.push(result.auditRef);
      return result;
    },
    async bindEvent(event, registration) {
      if (bindings.has(event.eventId)) throw new Error("SYNTHETIC_BINDING_CONFLICT");
      const result = Object.freeze({ ...registration, state: "EVENT_BOUND", eventId: event.eventId,
        acceptanceRef: event.acceptanceRef, bindingRef: `binding-${event.eventId}`,
        auditRef: `audit-binding-${event.eventId}` });
      bindings.set(event.eventId, result);
      audit.push(result.auditRef);
      return result;
    }
  };
  const actorResolver = { async authorizeRegistration(actorId) {
    if (actorId !== "owner-a") return null;
    return { actorId, ownerProfileId: "owner-a", authorized: true,
      basis: "HOME_OWNER", evidenceRef: "trusted-owner-proof-a" };
  } };
  return { store, actorResolver, audit, bindings, versions,
    setCandidate(value) { pending = value; }, setFacts(value) { liveFacts = value; },
    setAccepted(value) { liveAccepted = value; }, setCurrent(value) { live = value; } };
}
async function qualify(fixtureState, actorId = "owner-a") {
  return qualifyProspectiveHomeRegistration({ registrationId: "registration-a", actorId,
    store: fixtureState.store, actorResolver: fixtureState.actorResolver });
}
function canonical(siteTenantId = "tenant-a", sourceSiteId = "site-a") {
  return {
    async site(id) { return { siteId: id, tenantId: siteTenantId, siteType: "home", gardenId: null }; },
    async source(id) { return { id, siteId: sourceSiteId, externalSourceId: "CH1" }; },
    async event(id) { return { id, siteId: "site-a", sourceId: "source-a", incidentId: "incident-a" }; },
    async incident(id) { return { id, siteId: "site-a", eventIds: ["event-a"] }; },
    async riskDecision() { return null; }
  };
}

test("unverified candidate, actor and contradictory mapping fail closed", async () => {
  const f = fixture();
  await assert.rejects(qualify(f, "installer-a"), /ACTOR_DENIED/);
  f.setFacts({ ...facts, contradictoryAssociation: true });
  await assert.rejects(qualify(f), /AUTHORITY_UNVERIFIED/);
  f.setFacts({ ...facts, tenantOwnedByProfile: false });
  await assert.rejects(qualify(f), /AUTHORITY_UNVERIFIED/);
  f.setFacts(null);
  await assert.rejects(qualify(f), /AUTHORITY_UNVERIFIED/);
  assert.equal(f.audit.length, 0);
});

test("registration qualification is versioned, owner-authorized and audited", async () => {
  const f = fixture();
  const first = await qualify(f);
  assert.equal(first.authorizedActorId, "owner-a");
  assert.equal(first.version, 1);
  await assert.rejects(qualify(f), /CANDIDATE_MISSING/);
  f.setCandidate({ ...candidate, version: 2, registrationId: "registration-a" });
  const second = await qualify(f);
  assert.equal(second.version, 2);
  assert.equal(f.audit.length, 2);
  f.setCandidate({ ...candidate, version: 2 });
  await assert.rejects(qualify(f), /VERSION_CONFLICT/);
});

test("a trusted accepted event binds once and replay keeps original owner after reassignment", async () => {
  const f = fixture();
  await qualify(f);
  const first = await bindProspectiveHomeEvent({ eventId: "event-a", store: f.store });
  f.setCurrent({ ...await f.store.current("source-a"), version: 2,
    tenantId: "tenant-b", ownerProfileId: "owner-b", authorityRef: "new-owner-proof" });
  f.setFacts({ ...facts, tenantId: "tenant-b", ownerProfileId: "owner-b" });
  const replay = await bindProspectiveHomeEvent({ eventId: "event-a", store: f.store });
  assert.equal(replay, first);
  assert.equal(replay.tenantId, "tenant-a");
  const reader = prospectiveHomeEventReader({ canonical: canonical("tenant-b", "site-b"), store: f.store });
  const pre = await validatePrePersistEventOwnership({ reader,
    principal: { tenantId: "tenant-a", siteId: "site-a", lifecycleState: "ACTIVE" },
    sourceId: "source-a", eventId: "event-a", incidentId: "incident-a" });
  assert.equal(pre.scope.tenantId, "tenant-a");
  assert.equal(f.audit.length, 2); // Replays never rewrite binding or audit.
});

test("late first binding uses acceptance-time version, not reassigned current owner", async () => {
  const f = fixture();
  await qualify(f);
  f.setCurrent({ ...await f.store.current("source-a"), version: 2,
    tenantId: "tenant-b", ownerProfileId: "owner-b", authorityRef: "new-owner-proof" });
  const bound = await bindProspectiveHomeEvent({ eventId: "event-a", store: f.store });
  assert.equal(bound.tenantId, "tenant-a");
  assert.equal(bound.version, 1);
});

test("new acceptance fails closed on missing receipt, missing registration or changed scope", async () => {
  const f = fixture();
  f.setAccepted(null);
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /ACCEPTANCE_UNVERIFIED/);
  f.setAccepted(accepted);
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /REGISTRATION_UNVERIFIED/);
  await qualify(f);
  f.setAccepted({ ...accepted, authorityRef: "forged-authority" });
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /REGISTRATION_UNVERIFIED/);
  f.setAccepted({ ...accepted, siteId: "site-b" });
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /REGISTRATION_UNVERIFIED/);
});

test("immutable event binding rejects contradictory replay or missing history", async () => {
  const f = fixture();
  await qualify(f);
  await bindProspectiveHomeEvent({ eventId: "event-a", store: f.store });
  f.setAccepted({ ...accepted, acceptanceRef: "different-acceptance" });
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /BINDING_CONFLICT/);
  f.setAccepted(accepted);
  f.versions.clear();
  await assert.rejects(bindProspectiveHomeEvent({ eventId: "event-a", store: f.store }), /HISTORY_CONFLICT/);
  const reader = prospectiveHomeEventReader({ canonical: canonical(), store: f.store });
  await assert.rejects(reader.authoritativeTenantForEvent("site-a", "event-a"), /HISTORY_CONFLICT/);
});

test("historical event without trusted server acceptance and binding has no authority", async () => {
  const f = fixture();
  f.setAccepted(null);
  const reader = prospectiveHomeEventReader({ canonical: canonical(), store: f.store });
  assert.equal(await reader.authoritativeTenantForEvent("site-a", "event-a"), null);
  await assert.rejects(validatePrePersistEventOwnership({ reader,
    principal: { tenantId: "tenant-a", siteId: "site-a", lifecycleState: "ACTIVE" },
    sourceId: "source-a", eventId: "event-a", incidentId: "incident-a" }), /UNVERIFIED/);
});
