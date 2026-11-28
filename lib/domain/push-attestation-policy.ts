// Offline policy for a structured verdict already cryptographically verified by
// a separate trusted component. This code does NOT verify Apple/Google evidence.
export type AlreadyVerifiedPushVerdict = {
  source: "apple_app_attest" | "google_play_integrity";
  platform: "ios" | "android";
  build: "qa" | "release";
  audience: "gan_management" | "digital_observer";
  provider: "apns" | "fcm";
  appId: string;
  challengeDigest: string;
  issuedAtMs: number;
  expiresAtMs: number;
  revokedAtMs?: number | null;
};

export type PushAttestationPolicyInput = {
  verdict: AlreadyVerifiedPushVerdict;
  expectedChallengeDigest: string;
  expectedAudience: AlreadyVerifiedPushVerdict["audience"];
  expectedProvider: AlreadyVerifiedPushVerdict["provider"];
  expectedAppId: string;
  nowMs: number;
};

// Only release Gan identifiers have a source-backed native package/bundle and
// provider pairing today. Observer QA and all other QA builds stay denied.
const allowed = [
  { source: "apple_app_attest", platform: "ios", build: "release", audience: "gan_management", provider: "apns", appId: "com.ganbatuach.app" },
  { source: "google_play_integrity", platform: "android", build: "release", audience: "gan_management", provider: "fcm", appId: "com.ganbatuach.app" }
] as const;

export function pushAttestationPolicyAllows(input: PushAttestationPolicyInput): boolean {
  const { verdict, nowMs } = input;
  if (!verdict || !Number.isFinite(nowMs) || !Number.isFinite(verdict.issuedAtMs) ||
      !Number.isFinite(verdict.expiresAtMs) || verdict.issuedAtMs > nowMs ||
      verdict.expiresAtMs <= nowMs || verdict.expiresAtMs <= verdict.issuedAtMs ||
      verdict.expiresAtMs - verdict.issuedAtMs > 5 * 60_000 ||
      verdict.revokedAtMs != null) return false;
  if (!/^[0-9a-f]{64}$/.test(input.expectedChallengeDigest) ||
      verdict.challengeDigest !== input.expectedChallengeDigest ||
      verdict.audience !== input.expectedAudience || verdict.provider !== input.expectedProvider ||
      verdict.appId !== input.expectedAppId) return false;
  return allowed.some((entry) => entry.source === verdict.source && entry.platform === verdict.platform &&
    entry.build === verdict.build && entry.audience === verdict.audience &&
    entry.provider === verdict.provider && entry.appId === verdict.appId);
}
