// Disconnected contract. No provider verifier or durable writer is installed.
// Never accept a verdict supplied by an HTTP client as a VerifyEvidence adapter.
import { createHash } from "node:crypto";
import { pushRegistrationChallengeHash, type PushRegistrationChallenge } from "./push-registration-challenge";
import { pushAttestationPolicyAllows, type AlreadyVerifiedPushVerdict } from "./push-attestation-policy";

export type PushBindingReceipt = {
  profileId: string;
  installationId: string;
  tokenSha256: string;
  audience: PushRegistrationChallenge["audience"];
  provider: PushRegistrationChallenge["provider"];
  appId: string;
  challengeDigest: string;
  expiresAt: string;
};

export type PushBindingAdapters = {
  // Must validate Apple/Google cryptography and provenance, not client JSON.
  verifyEvidence: (challengeDigest: string) => Promise<AlreadyVerifiedPushVerdict | null>;
  // One database transaction: consume nonce once and persist binding/receipt.
  consumeAndPersist: (nonce: string, receipt: PushBindingReceipt) => Promise<boolean>;
};

export type PushBindingResult = { status: "issued"; receipt: PushBindingReceipt } |
  { status: "denied"; reason: "disabled" | "missing_adapter" | "invalid_challenge" |
    "wrong_profile" | "expired" | "unverified_evidence" | "persistence_denied" };

export async function issuePushBindingOfflineContract(input: {
  enabled?: boolean;
  authenticatedProfileId: string;
  challenge: PushRegistrationChallenge;
  nowMs: number;
  adapters?: Partial<PushBindingAdapters>;
}): Promise<PushBindingResult> {
  if (input.enabled !== true) return { status: "denied", reason: "disabled" };
  if (!input.adapters?.verifyEvidence || !input.adapters.consumeAndPersist)
    return { status: "denied", reason: "missing_adapter" };
  const { challenge } = input;
  if (!challenge || !Number.isFinite(input.nowMs)) return { status: "denied", reason: "invalid_challenge" };
  if (!input.authenticatedProfileId || input.authenticatedProfileId !== challenge.profileId)
    return { status: "denied", reason: "wrong_profile" };
  const expiry = Date.parse(challenge.expiresAt);
  if (!Number.isFinite(expiry) || expiry <= input.nowMs) return { status: "denied", reason: "expired" };
  let challengeDigest: string;
  try { challengeDigest = pushRegistrationChallengeHash(challenge); }
  catch { return { status: "denied", reason: "invalid_challenge" }; }
  try {
    const verdict = await input.adapters.verifyEvidence(challengeDigest);
    if (!verdict || !pushAttestationPolicyAllows({
      verdict, expectedChallengeDigest: challengeDigest, expectedAudience: challenge.audience,
      expectedProvider: challenge.provider, expectedAppId: challenge.appId, nowMs: input.nowMs
    })) return { status: "denied", reason: "unverified_evidence" };
    const receipt: PushBindingReceipt = {
      profileId: challenge.profileId, installationId: challenge.installationId,
      tokenSha256: createHash("sha256").update(challenge.providerToken, "utf8").digest("hex"),
      audience: challenge.audience, provider: challenge.provider, appId: challenge.appId,
      challengeDigest, expiresAt: new Date(Math.min(expiry, verdict.expiresAtMs)).toISOString()
    };
    const persisted = await input.adapters.consumeAndPersist(challenge.nonce, receipt);
    return persisted ? { status: "issued", receipt } : { status: "denied", reason: "persistence_denied" };
  } catch { return { status: "denied", reason: "unverified_evidence" }; }
}
