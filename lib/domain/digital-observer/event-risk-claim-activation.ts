import type { FencedRiskRunner } from "./event-risk-claim-boundary";

// A reviewed PostgreSQL claim plus all four fenced writer bodies, canonical
// historical Tenant ownership and Data API/ACL proof are still missing.
// Keeping the runner absent makes an accidental flag change fail closed.
export const EVENT_RISK_CLAIM_ACTIVATION: Readonly<{
  enabled: boolean;
  runner: FencedRiskRunner | null;
}> = Object.freeze({ enabled: false, runner: null });
