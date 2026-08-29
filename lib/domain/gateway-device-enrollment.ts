import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const gatewayEnrollmentTtlMs = 10 * 60 * 1000;
export const gatewayDeviceAccessTtlMs = 10 * 60 * 1000;

type GatewayDeviceAccessClaims = {
  version: 1;
  scope: "cloud_discovery";
  device_id: string;
  gateway_id: string;
  observer_site_id: string;
  exp: number;
};

export type GatewayPlaybackGrantClaims = {
  version: 1;
  scope: "local_playback";
  gateway_id: string;
  observer_site_id: string;
  camera_source_id: string;
  gateway_stream_id: string;
  nonce: string;
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

export function newGatewayEnrollmentPollToken() {
  return randomBytes(32).toString("base64url");
}

export function newGatewayRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashGatewayEnrollmentToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function issueGatewayDeviceAccessToken(input: Omit<GatewayDeviceAccessClaims, "version" | "scope" | "exp">, secret: string) {
  const payload: GatewayDeviceAccessClaims = { ...input, version: 1, scope: "cloud_discovery", exp: Date.now() + gatewayDeviceAccessTtlMs };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyGatewayDeviceAccessToken(token: string, secret: string): GatewayDeviceAccessClaims | null {
  const [encoded, receivedSignature, ...rest] = token.split(".");
  if (!encoded || !receivedSignature || rest.length || !safeEqual(signature(encoded, secret), receivedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GatewayDeviceAccessClaims;
    if (payload.version !== 1 || payload.scope !== "cloud_discovery" || !payload.device_id || !payload.gateway_id || !payload.observer_site_id || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function issueGatewayPlaybackGrant(input: Omit<GatewayPlaybackGrantClaims, "version" | "scope" | "nonce" | "exp">, secret: string) {
  const payload: GatewayPlaybackGrantClaims = {
    ...input,
    version: 1,
    scope: "local_playback",
    nonce: randomBytes(24).toString("base64url"),
    exp: Date.now() + 45_000
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${encoded}.${signature(encoded, secret)}`;
}

export function verifyGatewayPlaybackGrant(token: string, secret: string): GatewayPlaybackGrantClaims | null {
  const [encoded, receivedSignature, ...rest] = token.split(".");
  if (!encoded || !receivedSignature || rest.length || !safeEqual(signature(encoded, secret), receivedSignature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as GatewayPlaybackGrantClaims;
    if (payload.version !== 1 || payload.scope !== "local_playback" || !payload.gateway_id || !payload.observer_site_id || !payload.camera_source_id || !payload.gateway_stream_id || !payload.nonce || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
