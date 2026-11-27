import {
  pushDestinationMatchesAudience,
  type PushAudienceToken,
  type PushDestination,
  type TrustedPushBinding
} from "@/lib/domain/push-product-audience";
import { authorizedMobileDestination, nativeAppAcceptsMobileLink, parseMobileLink } from "./mobile-runtime";

// Structural qualification only. No sender imports this module and the QA
// package has no Push entitlement. A trusted binding writer is still missing.
const OBSERVER_QA_PUSH_PAYLOAD_ACTIVATED = false;
const qaAppId = "com.digitalobserver.app.qa";

type Input = {
  profileId: string;
  token: PushAudienceToken;
  binding: TrustedPushBinding;
  platform: "ios" | "android";
  destination: PushDestination;
  deepLink: string;
  now: Date;
};

export function prepareObserverQaPushPayload(input: Input): { deep_link: string } | null {
  if (!OBSERVER_QA_PUSH_PAYLOAD_ACTIVATED || !input.profileId || !input.deepLink ||
      input.binding.verifiedAppId !== qaAppId || input.binding.productAudience !== "digital_observer" ||
      input.binding.deviceTokenId !== input.token.id || input.token.platform !== input.platform ||
      input.token.profileId !== input.profileId || !input.token.isActive || input.token.revokedAt ||
      !input.token.deviceToken || input.binding.revokedAt ||
      !/^[0-9a-f]{64}$/.test(input.binding.evidenceSha256) ||
      !Number.isFinite(Date.parse(input.binding.expiresAt)) ||
      Date.parse(input.binding.expiresAt) <= input.now.getTime() ||
      !pushDestinationMatchesAudience("digital_observer", input.destination)) return null;
  let url: URL;
  try { url = new URL(input.deepLink); } catch { return null; }
  const scheme = input.platform === "ios" ? "observerqaapp:" : "observerqaandroid:";
  if (url.protocol !== scheme || url.searchParams.getAll("site").length !== 1 ||
      [...url.searchParams.keys()].some((key) => key !== "site") ||
      !nativeAppAcceptsMobileLink(input.deepLink, qaAppId, input.platform, "")) return null;
  try {
    if (authorizedMobileDestination(parseMobileLink(input.deepLink)) !== input.destination.actionUrl) return null;
  } catch { return null; }
  return { deep_link: input.deepLink };
}
