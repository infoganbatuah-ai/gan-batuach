import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEventGateway, eventEnvironmentFingerprint } from "@/lib/domain/event-engine/gateway-auth";
import { cameraZoneMapper, validCrossingLine } from "@/lib/domain/event-engine/camera-zone-mapper";
import { CONTEXT_RULES_MATRIX } from "@/lib/domain/event-engine/event-validation-pipeline";
import { cameraReportsLocalEventInsights } from "@/lib/domain/digital-observer/edge-ai-policy";
import { scheduleIsOffHours } from "@/lib/domain/event-engine/off-hours";
import { eventManifestPolicy } from "@/lib/domain/event-engine/event-manifest-policy";

export const dynamic = "force-dynamic";
type ManifestCamera = {
  id: string;
  display_name?: string | null;
  location_label?: string | null;
  status?: string | null;
  source_mode?: string | null;
  metadata?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  gateway_id?: string | null;
  gateway_stream_id?: string | null;
  monitoring_enabled?: boolean | null;
  zone_type?: string | null;
  camera_zone_type?: string | null;
  crossing_line?: unknown;
  verified_event_models?: unknown;
  local_event_insights?: boolean | null;
  edge_inference_policy?: string | null;
  capability_local_event_insights?: boolean | null;
};
type AutomationPolicyRow = {
  camera_source_id: string;
  enabled?: boolean | null;
  allowed_actions?: unknown;
  siren_event_types?: unknown;
};

async function auditRejectedManifest(request: Request, db: ReturnType<typeof createAdminClient> | null, status: number) {
  if (!db) return;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;
  try {
    await db.from("audit_logs").insert({
      entity_type: "http_request", action: "request_observed", http_method: "GET",
      api_endpoint: "/api/video-gateway/event-manifest", http_status_code: status,
      request_id: crypto.randomUUID(), client_source_ip: ip, ip,
      user_agent: request.headers.get("user-agent"),
      compliance_context: { source: "event_manifest_rejection", iso_27001: true, iso_27017: true, iso_27701: true }
    });
  } catch { /* Authentication failure must still return its original status. */ }
}

export async function GET(request: Request) {
  let db: ReturnType<typeof createAdminClient> | null = null;
  try {
    db = createAdminClient();
    const device = await authenticateEventGateway(request, db, "CONFIG_READ");
    if (!device) {
      await auditRejectedManifest(request, db, 401);
      return fail("Gateway identity is invalid or revoked.", 401);
    }
    const environmentFingerprint = eventEnvironmentFingerprint();
    if (!environmentFingerprint) throw new Error("GATEWAY_ENV_FINGERPRINT_UNAVAILABLE");
    const [site, sources, schedule, automationPolicies] = await Promise.all([
      db.from("observer_sites").select("id,garden_id,site_type,monitoring_enabled,vision_privacy_mode,business_handles_children,metadata").eq("id", device.observer_site_id).single(),
      // The full metadata/capabilities payload contains large hardware and
      // connection diagnostics that the event manifest never consumes.
      db.from("digital_observer_camera_sources").select("id,display_name,location_label,status,source_mode,gateway_id:metadata->>gateway_id,gateway_stream_id:metadata->>gateway_stream_id,monitoring_enabled:metadata->monitoring_enabled,zone_type:metadata->>zone_type,camera_zone_type:metadata->>camera_zone_type,crossing_line:metadata->crossing_line,verified_event_models:metadata->verified_event_models,local_event_insights:metadata->local_event_insights,edge_inference_policy:metadata->>edge_inference_policy,capability_local_event_insights:capabilities->local_event_insights").eq("observer_site_id", device.observer_site_id),
      db.from("observer_monitoring_schedules").select("schedule,timezone,status").eq("observer_site_id", device.observer_site_id).maybeSingle(),
      db.from("digital_observer_camera_automation_policies")
        .select("camera_source_id,enabled,allowed_actions,siren_event_types")
        .eq("observer_site_id", device.observer_site_id)
    ]);
    if (site.error || sources.error || schedule.error || automationPolicies.error) throw new Error("EVENT_MANIFEST_UNAVAILABLE");
    if (site.data.garden_id || site.data.site_type === "kindergarten") {
      await auditRejectedManifest(request, db, 403);
      return fail("Separate kindergarten engine required.", 403);
    }
    const enabled = site.data.monitoring_enabled === true && site.data.metadata?.observer_monitoring_consent === true;
    const offHoursActive = schedule.data?.status === "active" && scheduleIsOffHours(schedule.data);
    const automationRows = (automationPolicies.data ?? []) as unknown as AutomationPolicyRow[];
    const cameraRows = ((sources.data ?? []) as unknown as ManifestCamera[]).map((camera) => ({
      ...camera,
      // Preserve the existing policy/mapping input shape while fetching only
      // the JSON fields required for consent, zones and event capabilities.
      metadata: camera.metadata ?? {
        gateway_id: camera.gateway_id, gateway_stream_id: camera.gateway_stream_id,
        monitoring_enabled: camera.monitoring_enabled, zone_type: camera.zone_type,
        camera_zone_type: camera.camera_zone_type, crossing_line: camera.crossing_line,
        verified_event_models: camera.verified_event_models, local_event_insights: camera.local_event_insights,
        edge_inference_policy: camera.edge_inference_policy
      },
      capabilities: camera.capabilities ?? { local_event_insights: camera.capability_local_event_insights }
    }));
    const automationByCamera = new Map(automationRows.map((policy) => [String(policy.camera_source_id), policy]));
    return ok({ gateway_id: device.gateway_id, observer_site_id: device.observer_site_id, environment_fingerprint: environmentFingerprint, monitoring_enabled: enabled, cameras: cameraRows
      .filter((camera) => !["demo", "mock", "local_shadow"].includes(String(camera.source_mode)) && camera.metadata?.gateway_id === device.gateway_id)
      .map((camera) => {
        const zone = cameraZoneMapper.map(camera);
        const allowed = [...new Set([...(zone.source === "default" ? ["person_detected"] : [...CONTEXT_RULES_MATRIX[zone.zone_type]]), "camera_offline", "camera_reconnected"])];
        const implemented = ["person_detected", "camera_offline", "camera_reconnected",
          ...(offHoursActive ? ["person_near_pool_off_hours", "unauthorized_night_motion"] : []),
          ...(validCrossingLine(camera.metadata?.crossing_line) ? ["person_entered", "person_exited", "vehicle_entered", "vehicle_exited"] : [])];
        const monitoringEnabled = enabled && camera.metadata?.monitoring_enabled !== false && camera.status !== "disabled";
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
        return { ...zone, stream_id: camera.metadata?.gateway_stream_id, status: camera.status, source_mode: camera.source_mode,
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
          unavailable_event_types: allowed.filter(type => !policy.supported_event_types.includes(type)) };
      }) });
  } catch (error) {
    const response = handleRouteError(error);
    await auditRejectedManifest(request, db, response.status);
    return response;
  }
}
