import "server-only";
import { createHash } from "node:crypto";
import { assertRateLimit } from "@/lib/security/rate-limit";
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
const QA_HANDOFF_RATE_KEY = createHash("sha256").update("push44-qa-handoff-global-v1").digest("hex");
const QA_HANDOFF_RATE_ROUTE = "push44-qa-handoff";
// 30 attempts per fixed minute: any 30-minute interval intersects at most 31
// buckets, so this stays below the 1,000-attempt application ceiling.
const QA_HANDOFF_ATTEMPTS_PER_MINUTE = 30;

// No route imports this module. There is no runtime enablement parameter.
export function createQaHandoffHandler(db: Database) {
  const authenticate: (request: Request) => Promise<Identity> = getQaVerifiedSession;
  return async (request: Request): Promise<Response> => handleQaHandoff(request, {
    enabled: QA_HANDOFF_ACTIVATED,
    reserveAttempt: async () => {
      await assertRateLimit(QA_HANDOFF_RATE_KEY, QA_HANDOFF_RATE_ROUTE,
        QA_HANDOFF_ATTEMPTS_PER_MINUTE, 60);
      return true;
    },
    now: () => Date.now(),
    authenticate,
    consume: (input: ConsumeInput) => consumeStoredQaChallenge(db, input,
      () => authenticate(request))
  });
}
