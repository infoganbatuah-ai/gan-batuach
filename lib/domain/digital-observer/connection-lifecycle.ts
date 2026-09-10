import { z } from "zod";

export const connectionLifecycleVersion = "connection-lifecycle-v1";
const states = ["IDENTIFY", "ASSESS", "CONNECT", "TEST", "CONFIRM", "ACTIVE", "ACTION_REQUIRED", "REVOKED"] as const;
export const connectionSessionSchema = z.object({
  version: z.literal(connectionLifecycleVersion),
  id: z.string().uuid(), siteId: z.string().uuid(),
  state: z.enum(states), configurationVersion: z.number().int().min(1),
  registryVersion: z.string().regex(/^connectivity-registry-v\d{1,3}$/),
  expiresAt: z.string().datetime()
}).strict();
export type ConnectionSession = z.infer<typeof connectionSessionSchema>;
export type RuntimeConnectionProof = {
  siteId: string; configurationVersion: number; authenticated: boolean;
  framesFresh: boolean; codecSupported: boolean; aiReady: boolean;
  observedAt: number; revoked: boolean;
};

const transitions: Record<ConnectionSession["state"], readonly ConnectionSession["state"][]> = {
  IDENTIFY: ["ASSESS", "ACTION_REQUIRED"], ASSESS: ["CONNECT", "ACTION_REQUIRED"],
  CONNECT: ["TEST", "ACTION_REQUIRED"], TEST: ["CONFIRM", "ACTION_REQUIRED"],
  CONFIRM: ["ACTIVE", "ACTION_REQUIRED"], ACTIVE: ["ACTION_REQUIRED", "REVOKED"],
  ACTION_REQUIRED: ["ASSESS", "REVOKED"], REVOKED: []
};

// Pure gate shared by future orchestration adapters. No network/control commands.
// Existing production activation still validates its own runtime proof.
export function advanceConnectionSession(input: unknown, next: ConnectionSession["state"], scope: {
  siteId: string; userConfirmed?: boolean; proof?: RuntimeConnectionProof;
}, now = Date.now()): ConnectionSession {
  const current = connectionSessionSchema.parse(input);
  if (current.siteId !== scope.siteId) throw new Error("CONNECTION_SCOPE_DENIED");
  if (Date.parse(current.expiresAt) <= now) throw new Error("CONNECTION_SESSION_EXPIRED");
  if (next === current.state) return current;
  if (!transitions[current.state].includes(next)) throw new Error("CONNECTION_TRANSITION_DENIED");
  if (next === "CONFIRM" || next === "ACTIVE") {
    const proof = scope.proof;
    if (!proof || proof.siteId !== scope.siteId || proof.configurationVersion !== current.configurationVersion
      || proof.revoked || !proof.authenticated || !proof.framesFresh || !proof.codecSupported || !proof.aiReady
      || !Number.isFinite(proof.observedAt) || proof.observedAt > now || now - proof.observedAt > 120000)
      throw new Error("FRESH_RUNTIME_PROOF_REQUIRED");
    if (next === "ACTIVE" && !scope.userConfirmed) throw new Error("USER_CONFIRMATION_REQUIRED");
  }
  return { ...current, state: next };
}
