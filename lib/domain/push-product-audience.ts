// Offline contract only: do not use client metadata or app_channel (device form
// factor) as proof of which independently installed product owns a Push token.
export type PushProductAudience = "gan_management" | "digital_observer";
export type PushDevicePlatform = "web" | "ios" | "android";

export type PushAudienceToken = {
  id: string;
  profileId: string;
  platform: PushDevicePlatform;
  deviceToken: string;
  isActive: boolean;
  revokedAt?: string | null;
};

export type TrustedPushBinding = {
  deviceTokenId: string;
  productAudience: PushProductAudience;
  verifiedAppId: string;
  evidenceSha256: string;
  expiresAt: string;
  revokedAt?: string | null;
};

export type PushDestination = {
  category?: string | null;
  deepLinkType?: string | null;
  actionUrl?: string | null;
};

const nativeAppIds: Record<PushProductAudience, ReadonlySet<string>> = {
  gan_management: new Set(["com.ganbatuach.app"]),
  digital_observer: new Set(["com.digitalobserver.app.qa"])
};

function safeRelativePath(raw: string): string | null {
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\#\s]/.test(raw) || /%2f|%5c/i.test(raw)) return null;
  const path = raw.split("?")[0];
  try {
    const decoded = decodeURIComponent(path);
    if (decoded.includes("\\") || decoded.includes("..") || decoded.includes("//")) return null;
    return decoded;
  } catch { return null; }
}

export function pushDestinationMatchesAudience(audience: PushProductAudience, destination: PushDestination): boolean {
  if (!Object.hasOwn(nativeAppIds, audience)) return false;
  const ganTypes: Record<string, readonly string[]> = {
    registration: ["system"], parent_approval: ["dashboard"], child_approval: ["child_profile"],
    payment_reminder: ["payment"], safety_alert: ["incident"], inspection_alert: ["inspection"],
    camera_alert: ["camera"], observer_alert: ["observer_event"], system_notification: ["system"]
  };
  const observerTypes: Record<string, readonly string[]> = { observer_alert: ["observer_event"] };
  const categories = audience === "digital_observer" ? observerTypes : ganTypes;
  const category = destination.category ?? "";
  if (!Object.hasOwn(categories, category)) return false;
  const allowedTypes = categories[category];
  if (!destination.deepLinkType || !allowedTypes.includes(destination.deepLinkType) || !destination.actionUrl) return false;
  const path = safeRelativePath(destination.actionUrl);
  if (!path) return false;
  if (audience === "gan_management" && destination.category === "camera_alert")
    return path === "/dashboard/garden/cameras" || path.startsWith("/dashboard/garden/cameras/");
  if (audience === "gan_management" && destination.category === "observer_alert")
    return path === "/dashboard/garden/ai-events" || path.startsWith("/dashboard/garden/ai-events/");
  return audience === "digital_observer"
    ? path === "/digital-observer" || path.startsWith("/digital-observer/")
    : path === "/dashboard" || path.startsWith("/dashboard/") ||
        path === "/parent-onboarding" || path.startsWith("/parent-onboarding/");
}

export function selectVerifiedPushTargets(input: {
  profileId: string;
  audience: PushProductAudience;
  destination: PushDestination;
  tokens: readonly PushAudienceToken[];
  bindings: readonly TrustedPushBinding[];
  now: Date;
}): PushAudienceToken[] {
  if (!pushDestinationMatchesAudience(input.audience, input.destination)) return [];
  const bindings = new Map<string, TrustedPushBinding | null>();
  for (const binding of input.bindings) {
    bindings.set(binding.deviceTokenId, bindings.has(binding.deviceTokenId) ? null : binding);
  }
  return input.tokens.filter((token) => {
    const binding = bindings.get(token.id);
    if (!token.isActive || token.revokedAt || token.profileId !== input.profileId || !token.deviceToken || !binding ||
        binding.revokedAt || binding.productAudience !== input.audience ||
        !nativeAppIds[input.audience].has(binding.verifiedAppId) ||
        !/^[0-9a-f]{64}$/.test(binding.evidenceSha256)) return false;
    const expiresAt = Date.parse(binding.expiresAt);
    return Number.isFinite(expiresAt) && expiresAt > input.now.getTime() && token.platform !== "web";
  });
}
