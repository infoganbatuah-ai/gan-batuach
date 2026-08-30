import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const gatewayPairingCodeTtlMs = 10 * 60 * 1000;
export const gatewayDiscoveryTokenTtlMs = 15 * 60 * 1000;

type GatewayPairingClaims = {
  version: 1;
  pairing_id: string;
  gateway_id: string;
  observer_site_id: string;
  scope: "cloud_discovery";
  exp: number;
};

function signature(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function newGatewayPairingCode() {
  return randomBytes(24).toString("base64url");
}

export function hashGatewayPairingCode(code: string) {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function issueGatewayDiscoveryToken(
  input: Omit<GatewayPairingClaims, "version" | "scope" | "exp">,
  secret: string
) {
  const payload: GatewayPairingClaims = {
    ...input,
    version: 1,
    scope: "cloud_discovery",
    exp: Date.now() + gatewayDiscoveryTokenTtlMs
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyGatewayDiscoveryToken(token: string, secret: string): GatewayPairingClaims | null {
  const [encoded, receivedSignature, ...rest] = token.split(".");
  if (!encoded || !receivedSignature || rest.length || !safeEqual(signature(encoded, secret), receivedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GatewayPairingClaims;
    if (
      payload.version !== 1
      || payload.scope !== "cloud_discovery"
      || !payload.pairing_id
      || !payload.gateway_id
      || !payload.observer_site_id
      || !Number.isFinite(payload.exp)
      || payload.exp <= Date.now()
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
