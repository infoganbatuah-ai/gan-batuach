import type { AuthenticatorTransportFuture, WebAuthnCredential } from "@simplewebauthn/server";

export type PasskeyContext = {
  rpName: string;
  rpID: string;
  origin: string;
};

export function getPasskeyContext(request: Request): PasskeyContext {
  const requestUrl = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? requestUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? requestUrl.protocol.replace(":", "");
  const hostname = host.split(":")[0];

  return {
    rpName: process.env.PASSKEY_RP_NAME || "גן בטוח",
    rpID: process.env.PASSKEY_RP_ID || hostname,
    origin: process.env.PASSKEY_ORIGIN || protocol + "://" + host
  };
}

export function toBase64Url(value: Uint8Array | ArrayBuffer): string {
  const bytes = value instanceof ArrayBuffer ? new Uint8Array(value) : value;
  return Buffer.from(bytes).toString("base64url");
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const source = Buffer.from(value, "base64url");
  const target = new Uint8Array(new ArrayBuffer(source.byteLength));
  target.set(source);
  return target;
}

export function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

export function credentialFromRow(row: { credential_id: string; public_key: string; counter?: number | null; transports?: unknown }): WebAuthnCredential {
  return {
    id: row.credential_id,
    publicKey: fromBase64Url(row.public_key),
    counter: Number(row.counter ?? 0),
    transports: toAuthenticatorTransports(row.transports)
  };
}

export function toAuthenticatorTransports(value: unknown): AuthenticatorTransportFuture[] | undefined {
  const transports = Array.isArray(value) ? value.filter(isAuthenticatorTransport) : [];
  return transports.length ? transports : undefined;
}

function isAuthenticatorTransport(value: unknown): value is AuthenticatorTransportFuture {
  return value === "ble" || value === "cable" || value === "hybrid" || value === "internal" || value === "nfc" || value === "smart-card" || value === "usb";
}
