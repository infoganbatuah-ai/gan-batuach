import { createHash } from "node:crypto";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateEventGateway } from "@/lib/domain/event-engine/gateway-auth";
import { eventValidationPipeline } from "@/lib/domain/event-engine/event-validation-pipeline";
import { validCrossingLine } from "@/lib/domain/event-engine/camera-zone-mapper";
import { cloudCameraEventSchema, eventEvidenceCompatibility } from "@/lib/domain/event-engine/event-evidence-compatibility";
import { scheduleIsOffHours } from "@/lib/domain/event-engine/off-hours";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { dispatchDigitalGuardActionsForValidatedEvent } from "@/lib/domain/digital-observer/guard-autonomy-service";
import type { GuardCommandDatabase } from "@/lib/domain/digital-observer/guard-command-client";
import { recordEventNotifications } from "@/lib/domain/event-engine/notifications";
import { openMediaFault } from "@/lib/domain/event-engine/media-fault-lifecycle";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
const namespacedId = (site: string, id: string) => {
  const hex = createHash("sha256").update(`${site}:${id}`).digest("hex");
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20,32)}`;
};

export async function POST(request: Request) {
  try {
    const db = createAdminClient();
    const device = await authenticateEventGateway(request, db);
    if (!device) return fail("Gateway identity is invalid or revoked.", 401);
    const event = cloudCameraEventSchema.parse(await request.json());
    // Authenticated backlog delivery after an outage keeps its original event time.
    // Duplicate IDs are checked below; old observations must not poison the durable outbox.
    if (Date.parse(event.timestamp) > Date.now() + 60_000) return fail("Future event timestamp.", 422);
    const [site, source] = await Promise.all([
      db.from("observer_sites").select("id,garden_id,site_type,monitoring_enabled,metadata").eq("id", device.observer_site_id).single(),
      db.from("digital_observer_camera_sources").select("id,observer_site_id,display_name,location_label,metadata,status,health_status,source_mode").eq("id", event.camera_source_id).eq("observer_site_id", device.observer_site_id).maybeSingle()
    ]);
    if (site.error || source.error) throw new Error("EVENT_SCOPE_UNAVAILABLE");
    if (site.data.garden_id || site.data.site_type === "kindergarten" || !site.data.monitoring_enabled || site.data.metadata?.observer_monitoring_consent !== true) return fail("Monitoring consent required.", 403);
    const camera = source.data;
    if (!camera || camera.source_mode === "demo" || camera.status === "disabled" || camera.metadata?.monitoring_enabled === false || camera.metadata?.gateway_id !== device.gateway_id || camera.metadata?.gateway_stream_id !== event.stream_id) return fail("Camera is not assigned to this Gateway.", 403);
    const result = eventValidationPipeline.validate(event, camera);
    if (!result.accepted) return ok({ status: "suppressed", reason: result.reason }, 202);
    let offHoursActive = false;
    if (event.evidence_kind === "object_detection_off_hours") {
      const schedule = await db.from("observer_monitoring_schedules").select("schedule,timezone,status")
        .eq("observer_site_id", device.observer_site_id).maybeSingle();
      if (schedule.error) throw new Error("EVENT_SCOPE_UNAVAILABLE");
      offHoursActive = schedule.data?.status === "active" && scheduleIsOffHours(schedule.data, new Date(event.timestamp));
    }
    const evidence = eventEvidenceCompatibility(
      { evidence_kind: event.evidence_kind, event_type: result.event.event_type },
      { zone_type: result.camera.zone_type, crossing_line_valid: validCrossingLine(camera.metadata?.crossing_line),
        off_hours_active: offHoursActive, verified_event_models: camera.metadata?.verified_event_models }
    );
    if (!evidence.compatible) return ok({ status: "suppressed", reason: evidence.reason }, 202);
    const sourceId = namespacedId(device.observer_site_id, event.event_id);
    const narrative = observerEventNarrative({ signal_type: result.event.event_type });
    const severity: "info" | "medium" | "critical" = result.event.severity === "CRITICAL"
      ? "critical"
      : result.event.severity === "WARNING" ? "medium" : "info";
    let signal = await db.from("observer_intelligence_signals").select("id,severity,metadata").eq("observer_site_id", device.observer_site_id).eq("source_type", "system").eq("source_id", sourceId).maybeSingle();
    if (signal.error) throw new Error("EVENT_READ_FAILED");
    if (!signal.data) {
      signal = await db.from("observer_intelligence_signals").insert({
        source_type: "system", source_id: sourceId, signal_type: "ai_camera", observer_site_id: device.observer_site_id,
        severity, confidence: event.confidence, created_at: event.timestamp, review_status: "needs_review",
        human_review_required: true, parent_visible: false, recommended_action: result.shouldRecord ? narrative.action : "לידיעה בלבד; לא נדרשה הקלטה.",
        metadata: { event_type: result.event.event_type, camera_source_id: camera.id, camera_name: result.camera.camera_name,
          zone_type: result.camera.source === "default" ? null : result.camera.zone_type, track_id: event.track_id,
          event_summary: `${narrative.summary} · ${result.camera.camera_name}`, validated_event: true,
          recording_required: result.shouldRecord, media_status: result.shouldRecord ? "pending" : "not_required",
          evidence_kind: event.evidence_kind, first_seen: event.timestamp, last_seen: event.timestamp,
          received_at: new Date().toISOString(), received_late: Date.now() - Date.parse(event.timestamp) > 300_000 }
      }).select("id,severity,metadata").single();
      if (signal.error?.code === "23505") signal = await db.from("observer_intelligence_signals").select("id,severity,metadata").eq("observer_site_id", device.observer_site_id).eq("source_type", "system").eq("source_id", sourceId).single();
      if (signal.error) throw new Error("EVENT_WRITE_FAILED");
    }
    const persistedSignal = signal.data;
    if (!persistedSignal) throw new Error("EVENT_WRITE_FAILED");
    if (persistedSignal.metadata.camera_source_id !== camera.id || persistedSignal.metadata.event_type !== result.event.event_type || persistedSignal.metadata.first_seen !== event.timestamp) return fail("Event id was already used for a different observation.", 409);
    if (event.media_failure_reason && persistedSignal.metadata.recording_required && persistedSignal.metadata.media_status !== "available") {
      const observedAt = new Date().toISOString();
      const lifecycle = openMediaFault(persistedSignal.metadata, event.media_failure_reason, observedAt);
      const updated = { ...lifecycle.metadata, media_status: "missing", media_missing_reason: event.media_failure_reason, last_media_attempt_at: observedAt };
      const write = await db.from("observer_intelligence_signals").update({ metadata: updated }).eq("id", persistedSignal.id).eq("observer_site_id", device.observer_site_id);
      if (write.error) throw new Error("EVENT_MEDIA_STATUS_FAILED");
      persistedSignal.metadata = updated;
      if (lifecycle.transition === "opened") await writeAuditEvent({
        eventType: "observer_media_fault_opened", eventCategory: "observer", targetType: "observer_intelligence_signal",
        targetId: persistedSignal.id, cameraId: camera.id, riskLevel: "medium",
        metadata: { observer_site_id: device.observer_site_id, status: "open", reason: lifecycle.fault.reason, occurred_at: observedAt }
      });
    }
    const notifications = await recordEventNotifications(db, device.observer_site_id, persistedSignal.id, persistedSignal.severity);
    const digitalGuard = await dispatchDigitalGuardActionsForValidatedEvent({
      database: db as unknown as GuardCommandDatabase,
      siteId: device.observer_site_id,
      source: camera,
      gatewayId: device.gateway_id,
      signalId: persistedSignal.id,
      eventType: result.event.event_type,
      evidenceKind: event.evidence_kind,
      severity,
      confidence: event.confidence,
      occurredAt: event.timestamp,
      validated: true
    });
    // An in-app alert exists as soon as the signal is persisted. External delivery is a separate provider workflow.
    return ok({ status: "stored", signal_id: persistedSignal.id, recording_required: persistedSignal.metadata.recording_required,
      media_event_id: sourceId, media_status: persistedSignal.metadata.media_status, in_app_available: true,
      notifications_pending: notifications.push_pending, digital_guard: digitalGuard }, 201);
  } catch (error) { return handleRouteError(error); }
}
