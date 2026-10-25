import type { AuthoritativeEventOwnershipReader, EventTimeTenantEvidence } from "./event-risk-ownership-snapshot.js";
import type { ModelAOwnershipReader } from "./model-a-ownership.js";

/** Disconnected contract only. No implementation of these ports may trust request JSON. */
export type HomeRegistrationScope = Readonly<{
  registrationId: string;
  version: number;
  tenantId: string;
  siteId: string;
  sourceId: string;
  ownerProfileId: string;
}>;
export type RegistrationCandidate = HomeRegistrationScope & Readonly<{
  state: "CANDIDATE";
  registeringActorId: string;
}>;
export type QualifiedRegistration = HomeRegistrationScope & Readonly<{
  state: "QUALIFIED";
  authorizedActorId: string;
  authorityRef: string;
  auditRef: string;
}>;
export type AcceptedEvent = Readonly<{
  eventId: string;
  siteId: string;
  sourceId: string;
  registrationId: string;
  registrationVersion: number;
  authorityRef: string;
  // Server acceptance must atomically freeze the qualified registration version
  // and current scope; never infer from a camera timestamp or later membership.
  acceptanceRef: string;
}>;
export type EventBoundRegistration = HomeRegistrationScope & Readonly<{
  state: "EVENT_BOUND";
  eventId: string;
  acceptanceRef: string;
  authorityRef: string;
  bindingRef: string;
  auditRef: string;
}>;
export type TrustedRegistrationFacts = Readonly<{
  tenantId: string;
  tenantOwnerProfileId: string;
  siteId: string;
  siteTenantId: string | null;
  siteOwnerProfileId: string | null;
  siteType: string;
  siteGardenId: string | null;
  siteActive: boolean;
  sourceId: string;
  sourceSiteId: string;
  ownerProfileId: string;
  ownerProfileActive: boolean;
  tenantActive: boolean;
  tenantStatus: string;
}>;
export type VerifiedActorAuthority = Readonly<{
  actorId: string;
  ownerProfileId: string;
  authorized: true;
  basis: "HOME_OWNER" | "PLATFORM_ADMIN";
  evidenceRef: string;
}>;

/** These ports require a future server-side transactional adapter and independent qualification. */
export interface TrustedHomeRegistrationStore {
  candidate(registrationId: string): Promise<RegistrationCandidate | null>;
  facts(sourceId: string): Promise<TrustedRegistrationFacts | null>;
  current(sourceId: string): Promise<QualifiedRegistration | null>;
  qualifiedVersion(registrationId: string, version: number): Promise<QualifiedRegistration | null>;
  // Only a future verified server-acceptance ledger may implement this read.
  // Historical rows without such a receipt must return null.
  acceptedEvent(eventId: string): Promise<AcceptedEvent | null>;
  eventBinding(eventId: string): Promise<EventBoundRegistration | null>;
  // Must atomically CAS source version + write immutable audit; no partial success.
  qualify(candidate: RegistrationCandidate, authorization: VerifiedActorAuthority): Promise<QualifiedRegistration>;
  // Must atomically insert-if-absent or compare all immutable fields; no overwrite.
  // It must also verify the accepted receipt's registration version, scope and
  // authority against the immutable registration history inside the transaction.
  bindEvent(accepted: AcceptedEvent, registration: QualifiedRegistration): Promise<EventBoundRegistration>;
}
export interface TrustedHomeActorResolver {
  // Only a trusted server-side reader may supply session facts; an arbitrary
  // object or test fake is not authentication evidence. Platform Admin is not
  // qualified by this disconnected contract.
  authorizeRegistration(actorId: string, candidate: RegistrationCandidate,
    facts: TrustedRegistrationFacts): Promise<VerifiedActorAuthority | null>;
}

/** The future reader must verify the real Auth user and current session, then
 * return the active canonical profile. It must never read identity from JSON,
 * email, a client role, or a caller-supplied admin boolean. */
export type TrustedHomeOwnerSession = Readonly<{
  authenticatedUserId: string;
  sessionAuthenticated: boolean;
  sessionActive: boolean;
  profileId: string;
  profileActive: boolean;
  observedAtMs: number;
  expiresAtMs: number;
  evidenceRef: string;
}>;
export interface TrustedHomeOwnerSessionReader {
  sessionForActor(actorId: string): Promise<TrustedHomeOwnerSession | null>;
}

/** Disconnected OWNER predicate; a server reader adapter exists but is not
 * wired to the application. The transactional store must recheck current
 * ownership and the session before committing a qualification. */
export function ownerOnlyHomeActorResolver(reader: TrustedHomeOwnerSessionReader): TrustedHomeActorResolver {
  return {
    async authorizeRegistration(actorId, candidate, facts) {
      const session = await reader.sessionForActor(actorId);
      if (!session || !session.sessionAuthenticated || !session.sessionActive || !session.profileActive
        || !populated(actorId, session.authenticatedUserId, session.profileId, session.evidenceRef)
        || !Number.isSafeInteger(session.observedAtMs) || !Number.isSafeInteger(session.expiresAtMs)
        || session.observedAtMs > Date.now() || session.expiresAtMs <= Date.now()
        || session.expiresAtMs - session.observedAtMs > 5_000
        || session.authenticatedUserId !== actorId || session.profileId !== actorId
        || actorId !== candidate.ownerProfileId
        || !trustedFactsMatch(candidate, facts)) return null;
      return Object.freeze({ actorId, ownerProfileId: actorId, authorized: true,
        basis: "HOME_OWNER", evidenceRef: session.evidenceRef });
    }
  };
}

function populated(...values: readonly string[]): boolean {
  return values.every(value => typeof value === "string" && value.trim() === value && value.length > 0);
}
function trustedFactsMatch(candidate: RegistrationCandidate, facts: TrustedRegistrationFacts): boolean {
  return facts.tenantActive && facts.tenantStatus === "active"
    && facts.siteActive && facts.ownerProfileActive
    && facts.siteType === "home" && facts.siteGardenId === null
    && facts.tenantId === candidate.tenantId && facts.siteId === candidate.siteId
    && facts.sourceId === candidate.sourceId && facts.ownerProfileId === candidate.ownerProfileId
    && facts.siteTenantId === candidate.tenantId && facts.sourceSiteId === candidate.siteId
    && facts.tenantOwnerProfileId === candidate.ownerProfileId
    && facts.siteOwnerProfileId === candidate.ownerProfileId;
}
function sameScope(a: HomeRegistrationScope, b: HomeRegistrationScope): boolean {
  return a.registrationId === b.registrationId && a.version === b.version
    && a.tenantId === b.tenantId && a.siteId === b.siteId
    && a.sourceId === b.sourceId && a.ownerProfileId === b.ownerProfileId;
}
function assertScope(scope: HomeRegistrationScope): void {
  if (!Number.isSafeInteger(scope.version) || scope.version < 1 || !populated(scope.registrationId,
    scope.tenantId, scope.siteId, scope.sourceId, scope.ownerProfileId)) {
    throw new Error("HOME_REGISTRATION_SCOPE_INVALID");
  }
}

/** Proposed registration transition. Neither caller input nor a nullable Site FK is authority. */
export async function qualifyProspectiveHomeRegistration(input: {
  registrationId: string;
  actorId: string;
  store: TrustedHomeRegistrationStore;
  actorResolver: TrustedHomeActorResolver;
}): Promise<QualifiedRegistration> {
  const candidate = await input.store.candidate(input.registrationId);
  if (!candidate || candidate.state !== "CANDIDATE" || candidate.registrationId !== input.registrationId
    || !populated(candidate.registeringActorId)) {
    throw new Error("HOME_REGISTRATION_CANDIDATE_MISSING");
  }
  assertScope(candidate);
  const facts = await input.store.facts(candidate.sourceId);
  if (!facts || !trustedFactsMatch(candidate, facts)) {
    throw new Error("HOME_REGISTRATION_AUTHORITY_UNVERIFIED");
  }
  const current = await input.store.current(candidate.sourceId);
  if (current && (current.state !== "QUALIFIED" || current.registrationId !== candidate.registrationId
    || candidate.version !== current.version + 1 || !populated(current.auditRef)
    || current.tenantId !== candidate.tenantId || current.siteId !== candidate.siteId
    || current.sourceId !== candidate.sourceId || current.ownerProfileId !== candidate.ownerProfileId)) {
    throw new Error("HOME_REGISTRATION_VERSION_CONFLICT");
  }
  if (!current && candidate.version !== 1) throw new Error("HOME_REGISTRATION_VERSION_CONFLICT");
  const actor = await input.actorResolver.authorizeRegistration(input.actorId, candidate, facts);
  if (!actor?.authorized || actor.actorId !== input.actorId
    || actor.ownerProfileId !== candidate.ownerProfileId
    || actor.basis !== "HOME_OWNER"
    || !populated(actor.evidenceRef)) throw new Error("HOME_REGISTRATION_ACTOR_DENIED");
  const qualified = await input.store.qualify(candidate, actor);
  if (qualified.state !== "QUALIFIED" || !sameScope(qualified, candidate)
    || qualified.authorizedActorId !== actor.actorId || qualified.authorityRef !== actor.evidenceRef
    || !populated(qualified.auditRef)) throw new Error("HOME_REGISTRATION_COMMIT_UNVERIFIED");
  return qualified;
}

/** New server-accepted events only. Historical eligibility is never inferred from a date. */
export async function bindProspectiveHomeEvent(input: {
  eventId: string;
  store: TrustedHomeRegistrationStore;
}): Promise<EventBoundRegistration> {
  const accepted = await input.store.acceptedEvent(input.eventId);
  if (!accepted || accepted.eventId !== input.eventId
    || !Number.isSafeInteger(accepted.registrationVersion) || accepted.registrationVersion < 1
    || !populated(accepted.eventId, accepted.siteId, accepted.sourceId, accepted.registrationId,
      accepted.authorityRef, accepted.acceptanceRef)) {
    throw new Error("HOME_EVENT_ACCEPTANCE_UNVERIFIED");
  }
  const existing = await input.store.eventBinding(input.eventId);
  if (existing) {
    assertEventBinding(existing, accepted);
    const original = await input.store.qualifiedVersion(existing.registrationId, existing.version);
    if (!original || original.state !== "QUALIFIED" || !sameScope(existing, original)
      || existing.authorityRef !== original.authorityRef) {
      throw new Error("HOME_EVENT_AUTHORITY_HISTORY_CONFLICT");
    }
    return existing; // Replay retains original authority, including after source reassignment.
  }
  const registration = await input.store.qualifiedVersion(accepted.registrationId, accepted.registrationVersion);
  if (!registration || registration.state !== "QUALIFIED" || registration.siteId !== accepted.siteId
    || registration.sourceId !== accepted.sourceId || registration.authorityRef !== accepted.authorityRef
    || !populated(registration.authorityRef, registration.auditRef)) {
    throw new Error("HOME_EVENT_REGISTRATION_UNVERIFIED");
  }
  assertScope(registration);
  const bound = await input.store.bindEvent(accepted, registration);
  assertEventBinding(bound, accepted);
  if (!sameScope(bound, registration) || bound.authorityRef !== registration.authorityRef) {
    throw new Error("HOME_EVENT_BINDING_CONFLICT");
  }
  return bound;
}

function assertEventBinding(binding: EventBoundRegistration, accepted: AcceptedEvent): void {
  assertScope(binding);
  if (binding.state !== "EVENT_BOUND" || binding.eventId !== accepted.eventId
    || binding.siteId !== accepted.siteId || binding.sourceId !== accepted.sourceId
    || binding.registrationId !== accepted.registrationId
    || binding.version !== accepted.registrationVersion
    || binding.authorityRef !== accepted.authorityRef
    || binding.acceptanceRef !== accepted.acceptanceRef
    || !populated(binding.authorityRef, binding.bindingRef, binding.auditRef)) {
    throw new Error("HOME_EVENT_BINDING_CONFLICT");
  }
}

/** Trusted history reader adapter; not wired to ingest, DB or the risk worker. */
export function prospectiveHomeEventReader(input: {
  canonical: ModelAOwnershipReader;
  store: TrustedHomeRegistrationStore;
}): AuthoritativeEventOwnershipReader {
  return {
    site: id => input.canonical.site(id),
    source: id => input.canonical.source(id),
    event: id => input.canonical.event(id),
    incident: id => input.canonical.incident(id),
    riskDecision: id => input.canonical.riskDecision(id),
    async authoritativeTenantForEvent(siteId, eventId): Promise<EventTimeTenantEvidence | null> {
      const accepted = await input.store.acceptedEvent(eventId);
      const binding = await input.store.eventBinding(eventId);
      if (!accepted || !binding || accepted.siteId !== siteId) return null;
      assertEventBinding(binding, accepted);
      const version = await input.store.qualifiedVersion(binding.registrationId, binding.version);
      if (!version || version.state !== "QUALIFIED" || !sameScope(binding, version)
        || binding.authorityRef !== version.authorityRef) throw new Error("HOME_EVENT_AUTHORITY_HISTORY_CONFLICT");
      return Object.freeze({ tenantId: binding.tenantId, siteId: binding.siteId,
        sourceId: binding.sourceId,
        eventId: binding.eventId, evidenceRef: binding.bindingRef,
        verifiedForEvent: true, historicallyAmbiguous: false });
    }
  };
}
