// The JWT payload is parsed only after the canonical Auth path has verified
// the same bearer with getUser() and the live auth.sessions RPC.
type Authorized = { user: { id: string }; accessToken: string | null } | null;
type Authorize = (request: Request) => Promise<Authorized>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveQaVerifiedSession(request: Request, authorize: Authorize,
  now: () => number = Date.now): Promise<{ accountId: string; sessionId: string } | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7);
  if (!token || token.length > 8_192 || token.includes(" ")) return null;
  try {
    const verified = await authorize(request);
    if (!verified || verified.accessToken !== token || !uuid.test(verified.user.id)) return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts.some((part) => !part)) return null;
    const payloadBytes = Buffer.from(parts[1], "base64url");
    if (payloadBytes.length > 4_096) return null;
    const claims = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(payloadBytes));
    const currentTime = now();
    if (!claims || typeof claims !== "object" || claims.sub !== verified.user.id
      || typeof claims.session_id !== "string" || !uuid.test(claims.session_id)
      || !Number.isSafeInteger(claims.exp) || !Number.isSafeInteger(claims.exp * 1_000)
      || !Number.isSafeInteger(currentTime) || claims.exp * 1_000 <= currentTime) return null;
    return { accountId: verified.user.id, sessionId: claims.session_id };
  } catch { return null; }
}
