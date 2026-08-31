import { cameraReportsLocalEventInsights } from "./edge-ai-policy";

type Row = Record<string, any>;

export function observerAnalysisRoundPolicy(site: Row | null, schedule: Row | null, sources: Row[], gatewayId: string, requestedSourceIds: string[], requestId: string, now = Date.now()) {
  const deny = (reason: string) => ({
    request_id: requestId, consentVerified: false, sourceIds: [] as string[],
    expiresAt: now, reason, physical_actions_allowed: false, biometric_matching_allowed: false
  });
  if (site?.active !== true) return deny("site_inactive");
  if (site?.monitoring_enabled !== true || site.metadata?.observer_monitoring_consent !== true) return deny("monitoring_consent_required");
  if (site.vision_privacy_mode === "skeleton_only" || site.business_handles_children === true) return deny("privacy_policy_restricts_inference");
  // Settings currently persist draft schedules even after explicit monitoring consent.
  if (!schedule || schedule.observer_site_id !== site.id || !["draft", "active"].includes(schedule.status)) return deny("monitoring_schedule_unavailable");
  // Restricted schedules require an independently verified time-window evaluator.
  if (!["event_only", "24_7"].includes(schedule.schedule_mode)) return deny("monitoring_schedule_requires_verification");
  const requested = new Set(requestedSourceIds);
  const sourceIds = sources.filter(source => {
    if (source.observer_site_id !== site.id || !requested.has(source.id) || source.metadata?.gateway_id !== gatewayId) return false;
    if (source.status !== "connected" || ["offline", "failed", "error", "blocked", "disabled"].includes(source.health_status)) return false;
    const contract = source.metadata?.edge_capability_contract;
    const issued = Date.parse(String(contract?.issued_at ?? ""));
    return cameraReportsLocalEventInsights(source) && Number.isFinite(issued) && issued <= now && now - issued <= 20 * 60 * 1000
      && Array.isArray(contract.models?.approved_inventory)
      && contract.models.approved_inventory.some((model: Row) => model.capability === "object_detection" && model.loaded === true && model.self_test_passed === true);
  }).map(source => source.id);
  return {
    request_id: requestId, consentVerified: true, sourceIds: [...new Set(sourceIds)],
    expiresAt: now + 60_000, reason: sourceIds.length ? "authorized_round" : "no_verified_sources",
    physical_actions_allowed: false, biometric_matching_allowed: false
  };
}
