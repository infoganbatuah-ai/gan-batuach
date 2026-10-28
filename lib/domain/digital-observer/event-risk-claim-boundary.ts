import "server-only";
import { randomUUID } from "node:crypto";
import { DIGITAL_OBSERVER_RISK_ENGINE_VERSION } from "./risk-decision-engine";
import type { evaluateAndPersistIncidentRisk } from "./risk-decision-service";

type RiskOutcome = Awaited<ReturnType<typeof evaluateAndPersistIncidentRisk>>;
type ClaimReply = { data: unknown; error: unknown };

export type RiskClaimDatabase = {
  rpc?: (name: string, args: Record<string, unknown>) => PromiseLike<ClaimReply>;
};

export type RiskClaimFence = {
  signalId: string;
  siteId: string;
  engineVersion: string;
  ownerNonce: string;
  ownerEpoch: number;
  leaseExpiresAt: string;
};

export type FencedRiskRunner = (claim: RiskClaimFence) => Promise<RiskOutcome>;

type SignalScope = {
  id: unknown;
  observer_site_id: unknown;
  metadata?: unknown;
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Review-only integration boundary. The live route's activation object has
// enabled=false and runner=null. The current Data API writers are not fenced;
// they must never be supplied as this runner merely to turn the flag on.
export async function evaluateRiskBehindClaim(input: {
  db: RiskClaimDatabase;
  signal: SignalScope;
  expectedSiteId: string;
  runner: FencedRiskRunner | null;
  now?: () => number;
}): Promise<RiskOutcome | { status: "deferred" }> {
  const metadata = input.signal.metadata;
  const details = metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? metadata as Record<string, unknown> : {};
  const eventType = details.event_type;
  if (eventType !== "person_entered" && eventType !== "person_exited") {
    return { status: "not_applicable" };
  }
  if (typeof input.signal.id !== "string" || !uuid.test(input.signal.id)
    || typeof input.expectedSiteId !== "string" || !uuid.test(input.expectedSiteId)
    || input.signal.observer_site_id !== input.expectedSiteId
    || details.observation_provenance !== "REAL_CAMERA_AI" || details.validated_event !== true) {
    throw new Error("RISK_CLAIM_SCOPE_UNVERIFIED");
  }
  // Never acquire a durable claim if the transactionally fenced writer is
  // absent. The route currently has no such writer and remains on legacy flow.
  if (!input.runner) throw new Error("RISK_FENCED_WRITER_UNAVAILABLE");
  if (typeof input.db.rpc !== "function") throw new Error("RISK_CLAIM_RPC_UNAVAILABLE");

  const ownerNonce = randomUUID();
  const reply = await input.db.rpc("claim_event_risk_v1", {
    p_signal_id: input.signal.id,
    p_engine_version: DIGITAL_OBSERVER_RISK_ENGINE_VERSION,
    p_owner_nonce: ownerNonce,
    p_lease_seconds: 30
  });
  if (reply.error || !reply.data || typeof reply.data !== "object" || Array.isArray(reply.data)) {
    throw new Error("RISK_CLAIM_FAILED");
  }
  const claim = reply.data as Record<string, unknown>;
  if (claim.kind === "BUSY") return { status: "deferred" };
  if (claim.kind === "NOT_APPLICABLE") {
    if (eventType !== "person_exited") throw new Error("RISK_CLAIM_STATE_UNSUPPORTED");
    return { status: "not_applicable" };
  }
  // RESUME_EFFECTS and COMPLETED require separate durable receipt/recovery
  // readers; treating either as a fresh evaluation could duplicate effects.
  if (claim.kind !== "OWNED") throw new Error("RISK_CLAIM_STATE_UNSUPPORTED");
  const leaseExpiresAt = claim.lease_expires_at;
  const ownerEpoch = claim.owner_epoch;
  if (typeof leaseExpiresAt !== "string" || !Number.isFinite(Date.parse(leaseExpiresAt))
    || Date.parse(leaseExpiresAt) <= (input.now?.() ?? Date.now())
    || typeof ownerEpoch !== "number" || !Number.isSafeInteger(ownerEpoch) || ownerEpoch < 1) {
    throw new Error("RISK_CLAIM_FENCE_INVALID");
  }
  return input.runner({
    signalId: input.signal.id,
    siteId: input.expectedSiteId,
    engineVersion: DIGITAL_OBSERVER_RISK_ENGINE_VERSION,
    ownerNonce,
    ownerEpoch,
    leaseExpiresAt
  });
}
