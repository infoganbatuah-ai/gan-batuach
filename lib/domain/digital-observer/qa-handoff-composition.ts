import "server-only";
import { getQaVerifiedSession } from "./qa-verified-session-server";
// Review-only modules are not active routes and do not currently ship TS declarations.
// @ts-expect-error review-only MJS boundary is intentionally not in the active type graph
import { handleQaHandoff } from "../../../review-only/push44-qa-device-proof/handoff-http-gate.mjs";
// @ts-expect-error review-only MJS boundary is intentionally not in the active type graph
import { consumeStoredQaChallenge } from "../../../review-only/push44-qa-device-proof/challenge-store-adapter.mjs";

type Identity = { accountId: string; sessionId: string } | null;
type Database = { query: (sql: string, values: unknown[]) => Promise<{ rows: unknown[] }> };
type ConsumeInput = { challengeId: string; accountId: string; sessionId: string;
  installationId: string; audience: string; signatureBase64: string; now: number };
const QA_HANDOFF_ACTIVATED = false;

// No route imports this module. There is no runtime enablement parameter.
export function createQaHandoffHandler(db: Database) {
  const authenticate: (request: Request) => Promise<Identity> = getQaVerifiedSession;
  return async (request: Request): Promise<Response> => handleQaHandoff(request, {
    enabled: QA_HANDOFF_ACTIVATED,
    now: () => Date.now(),
    authenticate,
    consume: (input: ConsumeInput) => consumeStoredQaChallenge(db, input,
      () => authenticate(request))
  });
}
