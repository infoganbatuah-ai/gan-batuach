export type ObserverCoreCapability = {
  capability_key?: string | null;
  implementation_status?: string | null;
  reusable?: boolean | null;
  data_boundary?: string | null;
  privacy_level?: string | null;
};

export type ObserverVerticalProfile = {
  profile_key?: string | null;
  vertical_key?: string | null;
  profile_status?: string | null;
  allowed_capabilities?: string[] | null;
  disabled_capabilities?: string[] | null;
  restricted_capabilities?: string[] | null;
  legal_review_required_capabilities?: string[] | null;
};

export type ObserverService = {
  service_key?: string | null;
  extraction_status?: string | null;
};

export type ObserverPolicy = {
  policy_key?: string | null;
  policy_status?: string | null;
  approval_required?: boolean | null;
  restricted_verticals?: string[] | null;
  disabled_verticals?: string[] | null;
};

export type ObserverRoadmapItem = {
  roadmap_key?: string | null;
  roadmap_status?: string | null;
};

export type ObserverCoreSummaryInput = {
  capabilities: ObserverCoreCapability[];
  profiles: ObserverVerticalProfile[];
  services: ObserverService[];
  policies: ObserverPolicy[];
  roadmap: ObserverRoadmapItem[];
};

export type ObserverCoreSummary = {
  totalCapabilities: number;
  reusableCapabilities: number;
  extractReadyCount: number;
  mappedServices: number;
  activeProfiles: number;
  futureProfiles: number;
  ganBatuachEnabled: number;
  ganBatuachDisabled: number;
  restrictedCount: number;
  legalReviewCount: number;
  roadmapItems: number;
  readinessScore: number;
};

function pct(done: number, total: number) {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function buildObserverCoreSummary(input: ObserverCoreSummaryInput): ObserverCoreSummary {
  const totalCapabilities = input.capabilities.length;
  const reusableCapabilities = input.capabilities.filter((item) => item.reusable !== false).length;
  const extractReadyCount = input.capabilities.filter((item) => ["existing", "mapped", "extract_ready"].includes(String(item.implementation_status))).length;
  const mappedServices = input.services.filter((item) => ["mapped", "extract_ready"].includes(String(item.extraction_status))).length;
  const activeProfiles = input.profiles.filter((item) => item.profile_status === "active").length;
  const futureProfiles = input.profiles.filter((item) => item.profile_status === "future").length;
  const ganProfile = input.profiles.find((item) => item.profile_key === "GAN_BATUACH_PROFILE");
  const ganBatuachEnabled = ganProfile?.allowed_capabilities?.length ?? 0;
  const ganBatuachDisabled = ganProfile?.disabled_capabilities?.length ?? 0;
  const restrictedCount = input.policies.reduce((sum, policy) => sum + (policy.restricted_verticals?.length ?? 0) + (policy.disabled_verticals?.length ?? 0), 0);
  const legalReviewCount = input.profiles.reduce((sum, profile) => sum + (profile.legal_review_required_capabilities?.length ?? 0), 0);
  const roadmapItems = input.roadmap.length;

  const capabilityScore = pct(extractReadyCount, Math.max(totalCapabilities, 1));
  const serviceScore = pct(mappedServices, Math.max(input.services.length, 1));
  const profileScore = pct(activeProfiles + futureProfiles, Math.max(input.profiles.length, 1));
  const policyScore = pct(input.policies.filter((item) => item.policy_status === "active").length, Math.max(input.policies.length, 1));
  const roadmapScore = pct(input.roadmap.filter((item) => ["future", "discovery", "planned"].includes(String(item.roadmap_status))).length, Math.max(input.roadmap.length, 1));
  const readinessScore = Math.round((capabilityScore + serviceScore + profileScore + policyScore + roadmapScore) / 5);

  return {
    totalCapabilities,
    reusableCapabilities,
    extractReadyCount,
    mappedServices,
    activeProfiles,
    futureProfiles,
    ganBatuachEnabled,
    ganBatuachDisabled,
    restrictedCount,
    legalReviewCount,
    roadmapItems,
    readinessScore
  };
}
