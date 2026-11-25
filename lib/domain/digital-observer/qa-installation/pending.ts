import { createHash, createPublicKey } from "node:crypto";
import { resolveQaVerifiedSession } from "../qa-verified-session";

export const qaProject = "https://qrkodgtccyzmshitowdt.supabase.co";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type OperatorRequest = Readonly<{
  requestId: string; ownerSubject: string; publicKeyDigest: string;
  siteId: string; sourceId: string; issuedAt: number; expiresAt: number;
}>;
export type ProductSession = {
  accessToken: string | null;
  user: { id: string; email_confirmed_at?: string | null };
  profile: { id: string; active: boolean | null };
  observerAccount: { profile_id: string; account_type: string; status: string } | null;
};
type OwnedScope = {
  site: { id: string; owner_profile_id: string | null; garden_id: string | null; site_type: string };
  source: { id: string; observer_site_id: string | null };
};

function keyDigest(body: unknown): string | null {
  if (!body || typeof body !== "object" || Object.keys(body).length !== 1 || !("spki" in body)) return null;
  if (typeof body.spki !== "string" || body.spki.length !== 124) return null;
  const der = Buffer.from(body.spki, "base64");
  if (der.length !== 91 || der.toString("base64") !== body.spki) return null;
  const key = createPublicKey({key: der, format: "der", type: "spki"});
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1" ||
      !key.export({format:"der",type:"spki"}).equals(der)) return null;
  return createHash("sha256").update(der).digest("hex");
}

// Pure candidate builder with read-only adapters. Never authorizes transport.
// The operator record is a server-side input. No request-supplied identity,
// Site, fixture ID or key pin can select it.
type Config<S extends ProductSession> = {
  project: string | undefined;
  authorize(request: Request): Promise<S | null>;
  readScope(session: S, siteId: string, sourceId: string): Promise<OwnedScope | null>;
  now?: () => number;
};

export function pendingProductKey<S extends ProductSession>(request: Request, body: unknown,
  operator: OperatorRequest, config: Config<S>) {
  return buildPending(request, body, operator, config, qaProject, qaProject + "/auth/v1");
}

async function buildPending<S extends ProductSession>(request: Request, body: unknown,
  operator: OperatorRequest, config: Config<S>, project: string, issuer: string) {
  try {
    const now = config.now ?? Date.now;
    const withinWindow = (time: number) => Number.isSafeInteger(time) &&
      operator.issuedAt <= time && time < operator.expiresAt;
    if (config.project !== project || request.method !== "POST" ||
        ![operator.requestId,operator.ownerSubject,operator.siteId,operator.sourceId].every(v => uuid.test(v)) ||
        !Number.isSafeInteger(operator.issuedAt) || !Number.isSafeInteger(operator.expiresAt) ||
        operator.expiresAt - operator.issuedAt > 300000 || !withinWindow(now())) return null;
    const digest = keyDigest(body);
    if (!digest || digest !== operator.publicKeyDigest) return null;
    const bearer = request.headers.get("authorization");
    if (!bearer?.startsWith("Bearer ") || bearer.length > 8199) return null;
    // Bind the verifier and subsequent reads to this immutable header snapshot.
    const authRequest = new Request(request.url, {headers:{authorization:bearer}});
    const session = await config.authorize(authRequest);
    if (!session) return null;
    const verified = await resolveQaVerifiedSession(authRequest, async () => session, now);
    if (!verified || verified.accountId !== operator.ownerSubject || !session.user.email_confirmed_at ||
        session.profile.active !== true || session.profile.id !== verified.accountId) return null;
    const claims = JSON.parse(Buffer.from(bearer.slice(7).split(".")[1],"base64url").toString());
    if (claims.iss !== issuer || claims.aud !== "authenticated" || claims.role !== "authenticated") return null;
    const account = session.observerAccount;
    if (account?.profile_id !== verified.accountId || !["home","business"].includes(account.account_type) ||
        !["onboarding","trial","active"].includes(account.status)) return null;
    const scope = await config.readScope(session, operator.siteId, operator.sourceId);
    if (!scope || scope.site.id !== operator.siteId || scope.site.owner_profile_id !== verified.accountId ||
        scope.site.garden_id !== null || !["home","office","business","warehouse","store","parking_lot","custom"].includes(scope.site.site_type) ||
        scope.source.id !== operator.sourceId || scope.source.observer_site_id !== scope.site.id) return null;
    const expiresAt = Math.min(operator.expiresAt, claims.exp * 1000);
    const checkedAt = now();
    if (!withinWindow(checkedAt) || checkedAt >= expiresAt) return null;
    return Object.freeze({status:"PENDING" as const, requestId:operator.requestId, issuer,
      audience:"authenticated", subject:verified.accountId, sessionId:verified.sessionId,
      observerAccountId:account.profile_id, siteId:scope.site.id, sourceId:scope.source.id,
      spkiSha256:digest, expiresAt, possessionVerified:false as const,
      sourceDelegated:false as const, grantsAccess:false as const});
  } catch { return null; }
}
