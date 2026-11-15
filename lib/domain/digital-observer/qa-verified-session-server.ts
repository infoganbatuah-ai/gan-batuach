import "server-only";
import { getDigitalObserverApiUser } from "./access";
import { resolveQaVerifiedSession } from "./qa-verified-session";

// No route imports this helper. getDigitalObserverApiUser verifies getUser()
// and the existing current-session-active RPC using this same bearer token.
// Receipt consumption must still atomically recheck auth.sessions to close
// the revocation race after this read-only helper returns.
export async function getQaVerifiedSession(request: Request) {
  return resolveQaVerifiedSession(request, getDigitalObserverApiUser);
}
