import { createHmac, timingSafeEqual } from "node:crypto";

// This is an owned, dedicated media origin, never a browser-supplied endpoint.
export const gatewayRelayOrigin = "https://video-relay.ganbatuach.com";
export const gatewayRelayAccessTtlMs = 120_000;

type RelayClaims = {
  version: 1;
  scope: "relay_transport";
  aud: typeof gatewayRelayOrigin;
  device_id: string;
  gateway_id: string;
  observer_site_id: string;
  exp: number;
};

function signature(encoded: string, secret: string) {
  const key = createHmac("sha256", secret).update("gateway-relay-transport-v1").digest();
  return createHmac("sha256", key).update(encoded).digest();
}

export function issueGatewayRelayAccess(input: Pick<RelayClaims, "device_id" | "gateway_id" | "observer_site_id">, secret: string) {
  const claims: RelayClaims = { ...input, version: 1, scope: "relay_transport", aud: gatewayRelayOrigin, exp: Date.now() + gatewayRelayAccessTtlMs };
  const encoded = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return { token: `${encoded}.${signature(encoded, secret).toString("base64url")}`, expires_at: claims.exp };
}

export function verifyGatewayRelayAccess(token: string, secret: string): RelayClaims | null {
  if (!secret || token.length > 4096) return null;
  try {
    const [encoded, sig, extra] = token.split(".");
    if (!encoded || !sig || extra !== undefined) return null;
    const expected = signature(encoded, secret);
    const received = Buffer.from(sig, "base64url");
    if (received.length !== expected.length || !timingSafeEqual(expected, received)) return null;
    const claims = JSON.parse(Buffer.from(encoded, "base64url").toString()) as RelayClaims;
    if (claims.version !== 1 || claims.scope !== "relay_transport" || claims.aud !== gatewayRelayOrigin
      || !claims.device_id || !claims.gateway_id || !claims.observer_site_id
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now() || claims.exp > Date.now() + gatewayRelayAccessTtlMs) return null;
    return claims;
  } catch { return null; }
}
