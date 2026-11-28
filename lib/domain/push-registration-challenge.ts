// Offline contract only. This module does not verify Apple/Google attestations,
// prove provider-token ownership, or provide durable/distributed nonce storage.
import { createHash } from "node:crypto";

export type PushRegistrationAudience = "gan_management" | "digital_observer";
export type PushTokenProvider = "apns" | "fcm";
export type PushRegistrationChallenge = {
  audience: PushRegistrationAudience;
  provider: PushTokenProvider;
  appId: string;
  profileId: string;
  installationId: string;
  providerToken: string;
  nonce: string;
  expiresAt: string;
};

const allowedApps: Record<PushRegistrationAudience, ReadonlySet<string>> = {
  gan_management: new Set(["com.ganbatuach.app"]),
  digital_observer: new Set(["com.digitalobserver.app.qa"])
};

function nonempty(value: string): boolean {
  return typeof value === "string" && value.length > 0 && value.length <= 4096;
}

function field(value: string): string {
  const bytes = Buffer.from(value, "utf8");
  return `${bytes.length}:${value}`;
}

export function encodePushRegistrationChallenge(input: PushRegistrationChallenge): Buffer {
  if (!Object.hasOwn(allowedApps, input.audience) || !allowedApps[input.audience].has(input.appId) ||
      (input.provider !== "apns" && input.provider !== "fcm") ||
      ![input.appId, input.profileId, input.installationId, input.providerToken, input.nonce, input.expiresAt].every(nonempty)) {
    throw new Error("push_challenge_invalid_identity");
  }
  const expiry = Date.parse(input.expiresAt);
  if (!Number.isFinite(expiry) || new Date(expiry).toISOString() !== input.expiresAt) {
    throw new Error("push_challenge_invalid_expiry");
  }
  const tokenHash = createHash("sha256").update(input.providerToken, "utf8").digest("hex");
  return Buffer.from([
    "push-registration-v1", input.audience, input.provider, input.appId, input.profileId,
    input.installationId, tokenHash, input.nonce, input.expiresAt
  ].map(field).join(""), "utf8");
}

export function pushRegistrationChallengeHash(input: PushRegistrationChallenge): string {
  return createHash("sha256").update(encodePushRegistrationChallenge(input)).digest("hex");
}

type State = { hash: string; expiresAt: number; status: "pending" | "consumed" | "revoked" };

// Synchronous in-process fixture for deterministic tests only. A real writer
// must use durable atomic compare-and-consume across processes and restarts.
export class InMemoryPushChallengeFixture {
  private readonly states = new Map<string, State>();

  issue(input: PushRegistrationChallenge, now: number): void {
    const expiresAt = Date.parse(input.expiresAt);
    if (!Number.isFinite(now) || expiresAt <= now || this.states.has(input.nonce)) {
      throw new Error("push_challenge_issue_denied");
    }
    this.states.set(input.nonce, { hash: pushRegistrationChallengeHash(input), expiresAt, status: "pending" });
  }

  consume(input: PushRegistrationChallenge, now: number, verifiedVerdict: boolean): boolean {
    const state = this.states.get(input.nonce);
    if (!state || !Number.isFinite(now) || now >= state.expiresAt || state.status !== "pending" || !verifiedVerdict) return false;
    let hash: string;
    try { hash = pushRegistrationChallengeHash(input); } catch { return false; }
    if (hash !== state.hash) return false;
    state.status = "consumed";
    return true;
  }

  revoke(nonce: string): void {
    const state = this.states.get(nonce);
    if (state) state.status = "revoked";
  }
}
