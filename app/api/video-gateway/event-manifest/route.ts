import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEventGateway, eventEnvironmentFingerprint } from "@/lib/domain/event-engine/gateway-auth";
import { cameraZoneMapper, validCrossingLine } from "@/lib/domain/event-engine/camera-zone-mapper";
import { CONTEXT_RULES_MATRIX } from "@/lib/domain/event-engine/event-validation-pipeline";
import { cameraReportsLocalEventInsights } from "@/lib/domain/digital-observer/edge-ai-policy";
import { scheduleIsOffHours } from "@/lib/domain/event-engine/off-hours";
import { eventManifestPolicy } from "@/lib/domain/event-engine/event-manifest-policy";
import { isExpectedCamera } from "@/lib/domain/digital-observer/camera-health-model";

export const dynamic = "force-dynamic";
type ManifestCamera = {
  id: string;
  display_name?: string | null;
  location_label?: string | null;
  status?: string | null;
  source_mode?: string | null;
  capabilities?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};
type AutomationPolicyRow = {
  camera_source_id: string;
  enabled?: boolean | null;
  allowed_actions?: unknown;
  siren_event_types?: unknown;
};
type WatchRuleRow = { camera_source_id?: string | null; structured_rule?: Record<string, unknown> | null };
type IncidentRow = { involved_camera_ids?: unknown };

function boundedNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback;
}

function watchRuleCameraIds(rows: WatchRuleRow[]) {
  const ids = new Set<string>();
  for (const row of rows) {
    if (typeof row.camera_source_id === "string") ids.add(row.camera_source_id);
    const target = row.structured_rule?.target;
    if (!target || typeof target !== "object" || Array.isArray(target)) continue;
    const cameraIds = (target as Record<string, unknown>).cameraSourceIds;
    if (Array.isArray(cameraIds)) for (const id of cameraIds) if (typeof id === "string") ids.add(id);
  }
  return ids;
}

export async function GET(request: Request) {
  try {
    const db = createAdminClient();
    const device = await authenticateEventGateway(request, db, "CONFIG_READ");
    if (!device) return fail("Gateway identity is invalid or revoked.", 401);
    const environmentFingerprint = eventEnvironmentFingerprint();
    if (!environmentFingerprint) throw new Error("GATEWAY_ENV_FINGERPRINT_UNAVAILABLE");
    const [site, sources, schedule, automationPolicies, watchRules, activeIncidents, learningBaseline] = await Promise.all([
      db.from("observer_sites").select("id,garden_id,site_type,monitoring_enabled,vision_privacy_mode,business_handles_children,metadata").eq("id", device.observer_site_id).single(),
      db.from("digital_observer_camera_sources").select("id,display_name,location_label,status,source_mode,capabilities,metadata").eq("observer_site_id", device.observer_site_id),
      db.from("observer_monitoring_schedules").select("schedule,timezone,status").eq("observer_site_id", device.observer_site_id).maybeSingle(),
      db.from("digital_observer_camera_automation_policies")
        .select("camera_source_id,enabled,allowed_actions,siren_event_types")
        .eq("observer_site_id", device.observer_site_id),
      db.from("observer_watch_requests")
        .select("camera_source_id,structured_rule")
        .eq("observer_site_id", device.observer_site_id)
        .eq("active", true)
        .eq("rule_state", "ACTIVE"),
      db.from("observer_correlated_events")
        .select("involved_camera_ids")
        .eq("observer_site_id", device.observer_site_id)
        .in("status", ["open", "reviewing", "escalated", "needs_more_data"]),
      db.from("site_behavior_baselines")
        .select("baseline_value")
        .eq("observer_site_id", device.observer_site_id)
        .eq("baseline_type", "normal_camera_activity")
        .maybeSingle()
    ]);
    if (site.error || sources.error || schedule.error || automationPolicies.error || watchRules.error || activeIncidents.error || learningBaseline.error) throw new Error("EVENT_MANIFEST_UNAVAILABLE");
    if (site.data.garden_id || site.data.site_type === "kindergarten") return fail("Separate kindergarten engine required.", 403);
    const enabled = site.data.monitoring_enabled === true && site.data.metadata?.observer_monitoring_consent === true;
    const offHoursActive = schedule.data?.status === "active" && scheduleIsOffHours(schedule.data);
    const automationRows = (automationPolicies.data ?? []) as unknown as AutomationPolicyRow[];
    const cameraRows = (sources.data ?? []) as unknown as ManifestCamera[];
    const automationByCamera = new Map(automationRows.map((policy) => [String(policy.camera_source_id), policy]));
    const watchedCameras = watchRuleCameraIds((watchRules.data ?? []) as unknown as WatchRuleRow[]);
    const incidentCameras = new Set<string>();
    for (const incident of (activeIncidents.data ?? []) as unknown as IncidentRow[]) {
      if (Array.isArray(incident.involved_camera_ids)) for (const id of incident.involved_camera_ids) if (typeof id === "string") incidentCameras.add(id);
    }
    const learningValue = learningBaseline.data?.baseline_value && typeof learningBaseline.data.baseline_value === "object" && !Array.isArray(learningBaseline.data.baseline_value)
      ? learningBaseline.data.baseline_value as Record<string, unknown> : {};
    const cameraBaselines = learningValue.camera_baselines && typeof learningValue.camera_baselines === "object" && !Array.isArray(learningValue.camera_baselines)
      ? learningValue.camera_baselines as Record<string, Record<string, unknown>> : {};
    const cycleBudget = Math.max(1, Math.min(64, Math.floor(boundedNumber(site.data.metadata?.adaptive_sampling_cycle_budget, 4, 1, 64))));
    return ok({ gateway_id: device.gateway_id, observer_site_id: device.observer_site_id, environment_fingerprint: environmentFingerprint, monitoring_enabled: enabled,
      sampling: { contract: "observer-adaptive-sampling-v1", purposes: ["REALTIME_DETECTION", "TRACKING_CONTINUITY", "SITE_LEARNING", "HEALTH_FRESHNESS", "INVESTIGATION"],
        cycle_budget: cycleBudget, resource_pressure: "NORMAL", policy_version: "observer-adaptive-sampling-v1", candidate_contract: "observer-ai-candidate-v2" }, cameras: cameraRows
      .filter((camera) => !["demo", "mock", "local_shadow"].includes(String(camera.source_mode)) && camera.metadata?.gateway_id === device.gateway_id)
      .map((camera) => {
        const zone = cameraZoneMapper.map(camera);
        const allowed = [...new Set([...(zone.source === "default" ? ["person_detected"] : [...CONTEXT_RULES_MATRIX[zone.zone_type]]), "camera_offline", "camera_reconnected"])];
        const implemented = ["person_detected", "camera_offline", "camera_reconnected",
          ...(offHoursActive ? ["person_near_pool_off_hours", "unauthorized_night_motion"] : []),
          ...(validCrossingLine(camera.metadata?.crossing_line) ? ["person_entered", "person_exited", "vehicle_entered", "vehicle_exited"] : [])];
        const expectedPhysicalCamera = isExpectedCamera({ channelAssignment: typeof camera.metadata?.channel_assignment === "string" ? camera.metadata.channel_assignment : typeof camera.metadata?.channel_state === "string" ? camera.metadata.channel_state : null,
          physicalCameraAttached: typeof camera.metadata?.physical_camera_attached === "boolean" ? camera.metadata.physical_camera_attached : null });
        const monitoringEnabled = enabled && expectedPhysicalCamera && camera.metadata?.monitoring_enabled !== false && camera.status !== "disabled";
        const automation = automationByCamera.get(String(camera.id));
        const criticalEventTypes = automation?.enabled === true
          && Array.isArray(automation.allowed_actions) && automation.allowed_actions.includes("siren")
          && validCrossingLine(camera.metadata?.crossing_line)
          ? (Array.isArray(automation.siren_event_types) ? automation.siren_event_types : [])
            .filter((type: unknown): type is string => typeof type === "string" && implemented.includes(type))
          : [];
        const policy = eventManifestPolicy({ zone_type: zone.zone_type, monitoring_enabled: monitoringEnabled,
          off_hours_active: offHoursActive, allowed_event_types: allowed, implemented_event_types: implemented,
          verified_event_models: camera.metadata?.verified_event_models });
        const capabilities = camera.capabilities ?? {};
        const availableSignals = [
          capabilities.native_motion_events === true ? "NATIVE_MOTION" : null,
          capabilities.native_person_events === true ? "NATIVE_PERSON_EVENT" : null,
          capabilities.native_vehicle_events === true ? "NATIVE_VEHICLE_EVENT" : null,
          capabilities.scene_change_events === true ? "SCENE_CHANGE" : null,
          "LOCAL_FRAME_DIFF"
        ].filter((value): value is string => Boolean(value));
        const activeWatchRule = watchedCameras.has(String(camera.id));
        const activeIncident = incidentCameras.has(String(camera.id));
        const criticalPolicy = criticalEventTypes.length > 0 || camera.metadata?.critical_camera === true;
        const configuredPolicy = camera.metadata?.preprocessing_policy;
        const preprocessingPolicy = activeWatchRule || criticalPolicy ? "ALWAYS_ANALYZE"
          : ["CANDIDATE_DRIVEN", "ADAPTIVE"].includes(String(configuredPolicy))
            && camera.metadata?.preprocessing_quality_gate_approved === true ? String(configuredPolicy) : "ALWAYS_ANALYZE";
        return { ...zone, stream_id: camera.metadata?.gateway_stream_id, status: camera.status, source_mode: camera.source_mode,
          channel_assignment: expectedPhysicalCamera ? "ASSIGNED" : "CHANNEL_EMPTY", physical_camera_attached: expectedPhysicalCamera,
          monitoring_enabled: monitoringEnabled,
          object_analysis_enabled: site.data.vision_privacy_mode !== "skeleton_only"
            && site.data.business_handles_children !== true
            && cameraReportsLocalEventInsights(camera),
          off_hours_active: policy.off_hours_active,
          zone_confirmed: zone.source !== "default", crossing_line: camera.metadata?.crossing_line ?? null,
          allowed_event_types: allowed,
          supported_event_types: policy.supported_event_types,
          verified_event_types: policy.verified_event_types,
          critical_event_types: criticalEventTypes,
          preprocessing: { contract: "observer-preprocessing-v1", policy: expectedPhysicalCamera ? preprocessingPolicy : "ADAPTIVE",
            available_signals: availableSignals, native_events_are_candidates_only: true, active_watch_rule: activeWatchRule,
            critical_policy: criticalPolicy, vendor: typeof camera.metadata?.vendor === "string" ? camera.metadata.vendor : "unknown",
            motion_threshold: boundedNumber(camera.metadata?.preprocessing_motion_threshold, 0.025, 0.001, 1),
            coalesce_window_ms: boundedNumber(camera.metadata?.preprocessing_coalesce_window_ms, 5_000, 250, 60_000),
            max_quiet_interval_ms: boundedNumber(camera.metadata?.preprocessing_max_quiet_interval_ms, 30_000, 5_000, 300_000),
            quality_gate: "HUMAN_APPROVAL_REQUIRED" },
          sampling: { contract: "observer-adaptive-sampling-v1", active_watch_rule: activeWatchRule, active_incident: activeIncident,
            critical_policy: criticalPolicy, recovering: camera.status === "recovering", frame_fresh: camera.status === "connected" ? true : null,
            learning_sample_count: Number(cameraBaselines[String(camera.id)]?.samples ?? 0),
            learning_under_covered: !cameraBaselines[String(camera.id)] || Number(cameraBaselines[String(camera.id)]?.samples ?? 0) < 288,
            purposes: ["REALTIME_DETECTION", "TRACKING_CONTINUITY", "SITE_LEARNING", "HEALTH_FRESHNESS", "INVESTIGATION"],
            never_blind_floor_ms: boundedNumber(camera.metadata?.sampling_never_blind_floor_ms, criticalPolicy ? 10_000 : 30_000, 5_000, 300_000),
            explanation_required: true },
          unavailable_event_types: allowed.filter(type => !policy.supported_event_types.includes(type)) };
      }) });
  } catch (error) { return handleRouteError(error); }
}
