import type { ManagedDevicePrincipal } from "./managed-device-identity";

/** Model A is a domain contract. No current Home table supplies this mapping. */
export type TenantSite = Readonly<{ tenantId: string; siteId: string }>;
export type CanonicalSite = Readonly<{
  siteId: string;
  tenantId: string | null;
  siteType: string;
  gardenId: string | null;
}>;
export type CanonicalSource = Readonly<{
  id: string;
  siteId: string;
  externalSourceId: string;
}>;
export type CanonicalEvent = Readonly<{
  id: string;
  siteId: string;
  sourceId: string;
  incidentId: string;
}>;
export type CanonicalIncident = Readonly<{
  id: string;
  siteId: string;
  eventIds: readonly string[];
}>;
export type CanonicalRiskDecision = Readonly<{
  id: string;
  siteId: string;
  incidentId: string;
  eventId: string;
}>;

/** A future trusted, server-side adapter must obtain these from canonical rows. */
export interface ModelAOwnershipReader {
  site(siteId: string): Promise<CanonicalSite | null>;
  source(sourceId: string): Promise<CanonicalSource | null>;
  event(eventId: string): Promise<CanonicalEvent | null>;
  incident(incidentId: string): Promise<CanonicalIncident | null>;
  riskDecision(riskDecisionId: string): Promise<CanonicalRiskDecision | null>;
}

export type ResolvedModelAChain = Readonly<{
  tenantId: string;
  siteId: string;
  sourceId: string;
  eventId: string;
  incidentId: string;
  riskDecisionId: string | null;
}>;

export async function resolveModelAChain(input: {
  reader: ModelAOwnershipReader;
  principal: Pick<ManagedDevicePrincipal, "tenantId" | "siteId" | "lifecycleState">;
  sourceId: string;
  eventId: string;
  incidentId: string;
  riskDecisionId?: string;
  clientTenantId?: string;
  clientSiteId?: string;
}): Promise<ResolvedModelAChain> {
  const { principal } = input;
  if (principal.lifecycleState !== "ACTIVE" || !principal.tenantId || !principal.siteId) {
    throw new Error("MODEL_A_PRINCIPAL_SCOPE_UNVERIFIED");
  }
  const [site, source, event, incident, decision] = await Promise.all([
    input.reader.site(principal.siteId),
    input.reader.source(input.sourceId),
    input.reader.event(input.eventId),
    input.reader.incident(input.incidentId),
    input.riskDecisionId ? input.reader.riskDecision(input.riskDecisionId) : Promise.resolve(null)
  ]);
  // Site.tenantId must come from an approved authoritative Site/Tenant mapping.
  // The existing nullable enrollment tenant_id is a consistency check only.
  if (!site?.tenantId || site.siteId !== principal.siteId || site.gardenId !== null
    || site.siteType === "kindergarten" || site.tenantId !== principal.tenantId) {
    throw new Error("MODEL_A_SITE_TENANT_UNVERIFIED");
  }
  if (input.clientTenantId && input.clientTenantId !== site.tenantId
    || input.clientSiteId && input.clientSiteId !== site.siteId) {
    throw new Error("MODEL_A_CLIENT_SCOPE_MISMATCH");
  }
  if (!source || source.id !== input.sourceId || source.siteId !== site.siteId
    || !event || event.id !== input.eventId || event.siteId !== site.siteId
    || event.sourceId !== source.id || event.incidentId !== input.incidentId
    || !incident || incident.id !== input.incidentId || incident.siteId !== site.siteId
    || !incident.eventIds.includes(event.id)) {
    throw new Error("MODEL_A_OWNERSHIP_CHAIN_MISMATCH");
  }
  if (input.riskDecisionId && (!decision || decision.id !== input.riskDecisionId
    || decision.siteId !== site.siteId || decision.eventId !== event.id
    || decision.incidentId !== incident.id)) {
    throw new Error("MODEL_A_RISK_SCOPE_MISMATCH");
  }
  return Object.freeze({ tenantId: site.tenantId, siteId: site.siteId,
    sourceId: source.id, eventId: event.id, incidentId: incident.id,
    riskDecisionId: input.riskDecisionId ?? null });
}
