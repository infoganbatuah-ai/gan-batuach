import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok } from "@/lib/api";
import { observerEventNarrative } from "@/lib/domain/digital-observer/event-narrative";
import { eventValidationPipeline } from "@/lib/domain/event-engine/event-validation-pipeline";
import { authenticateEventGateway } from "@/lib/domain/event-engine/gateway-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveMediaFault } from "@/lib/domain/event-engine/media-fault-lifecycle";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const MEDIA_BUCKET = "digital-observer-event-media";
const MAX_CLIP_BYTES = 8 * 1024 * 1024;
const MAX_THUMBNAIL_BYTES = 512 * 1024;
const mediaPersistenceFailureCodes = new Set([
  "EVIDENCE_UPLOAD_IDEMPOTENCY_WRITE_FAILED",
  "EVIDENCE_STORAGE_UPLOAD_FAILED",
  "EVIDENCE_METADATA_WRITE_FAILED",
  "EVENT_MEDIA_LINK_FAILED",
  "EVENT_READ_FAILED",
  "EVENT_SCOPE_UNAVAILABLE",
  "unsafe_event_summary"
]);

const metadataSchema = z.object({
  gateway_id: z.string().min(1).max(128),
  observer_site_id: z.string().uuid(),
  event_id: z.string().uuid(),
  camera_source_id: z.string().uuid(),
  stream_id: z.string().min(1).max(160),
  event_type: z.string().min(1).max(80).default("camera_media_readiness"),
  evidence_kind: z.enum(["object_detection", "object_detection_off_hours", "line_crossing", "validated_rule", "stream_health"]),
  severity: z.enum(["info", "low", "medium", "high", "urgent", "critical"]).default("info"),
  confidence: z.number().min(0).max(1).default(1),
  captured_at: z.string().datetime(),
  duration_seconds: z.number().int().min(1).max(30),
  window_seconds_before: z.number().int().min(0).max(15).default(3),
  window_seconds_after: z.number().int().min(0).max(15).default(5),
  retry_count: z.number().int().min(0).max(5).default(0),
  local_capture: z.literal(true),
  read_only: z.literal(true),
  controls_supported: z.literal(false),
  no_dvr_credentials_returned: z.literal(true),
  no_rtsp_returned: z.literal(true),
  event_summary: z.string().trim().min(2).max(500).optional(),
  event_context: z.enum(["entry", "exit", "presence", "safety", "device_health", "routine", "other"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().default({})
}).strict();

function header(request: Request, name: string) {
  return request.headers.get(name)?.trim() || "";
}

function safeEqual(left: string, right: string) {
  if (!left || !right) return false;
  const a = Buffer.from(left, "utf8");
  const b = Buffer.from(right, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function allowed(gatewayId: string, observerSiteId: string) {
  return String(process.env.VIDEO_GATEWAY_CLOUD_ALLOWED_GATEWAYS ?? "")
    .split(",")
    .map((item) => item.trim())
    .includes(`${gatewayId}:${observerSiteId}`);
}

function signableHash(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

function verifySignature(input: string, signature: string, secret: string) {
  const expected = createHmac("sha256", secret).update(input).digest("hex");
  return safeEqual(expected, signature.replace(/^sha256=/, ""));
}

function extensionFor(type: string) {
  if (type === "video/mp4") return "mp4";
  if (type === "image/webp") return "webp";
  if (type === "image/png") return "png";
  return "jpg";
}

function safeNarrative(value: string | undefined) {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (/(password|credential|secret|rtsp:\/\/|rtsps:\/\/|private_endpoint|stream_url|cookie|authorization)/i.test(normalized)) {
    throw new Error("unsafe_event_summary");
  }
  return normalized;
}

function mediaPersistenceFailure(error: unknown) {
  if (error instanceof z.ZodError) return fail("Evidence media payload is invalid.", 422, { code: "validation_failed" });
  const code = error instanceof Error && mediaPersistenceFailureCodes.has(error.message)
    ? error.message
    : "EVIDENCE_PERSISTENCE_UNEXPECTED";
  // Do not return provider, storage, or SQL messages to the Gateway. The
  // bounded code is enough for a retry-safe operational diagnosis.
  return fail("Evidence media persistence failed.", 500, { code });
}

function retentionHoursForSite(eventRetentionDays: unknown) {
  const requested = Number(eventRetentionDays);
  if (!Number.isFinite(requested)) return 48;
  return requested <= 1 ? 24 : 48;
}

async function readPart(formData: FormData, name: string, maxBytes: number, allowedTypes: string[]) {
  const value = formData.get(name);
  if (!(value instanceof File)) throw new Error(`${name}_missing`);
  if (!allowedTypes.includes(value.type)) throw new Error(`${name}_type_not_allowed`);
  if (value.size < 1 || value.size > maxBytes) throw new Error(`${name}_size_not_allowed`);
  return { file: value, bytes: Buffer.from(await value.arrayBuffer()) };
}

async function uploadPrivateMedia(supabase: ReturnType<typeof createAdminClient>, path: string, bytes: Buffer, contentType: string) {
  let result = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
  if (result.error && /bucket/i.test(result.error.message || "")) {
    await supabase.storage.createBucket(MEDIA_BUCKET, {
      public: false,
      fileSizeLimit: MAX_CLIP_BYTES,
      allowedMimeTypes: ["video/mp4", "image/jpeg", "image/png", "image/webp"]
    });
    result = await supabase.storage.from(MEDIA_BUCKET).upload(path, bytes, { contentType, upsert: true });
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const secret = process.env.VIDEO_GATEWAY_CLOUD_DISCOVERY_SECRET;
    if (!secret) return fail("Cloud event media endpoint is not configured.", 404);
    const gatewayId = header(request, "x-video-gateway-id");
    const timestamp = header(request, "x-video-gateway-timestamp");
    const nonce = header(request, "x-video-gateway-nonce");
    const signature = header(request, "x-video-gateway-signature");
    const supabase = createAdminClient();
    const device = header(request, "x-video-gateway-device-token") ? await authenticateEventGateway(request, supabase) : null;
    const parsedTimestamp = Date.parse(timestamp);
    if (!gatewayId || !nonce || (!signature && !device) || !Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > MAX_CLOCK_SKEW_MS) return fail("Invalid gateway authentication.", 401);

    const formData = await request.formData();
    const metadataText = String(formData.get("metadata") ?? "");
    const metadata = metadataSchema.parse(JSON.parse(metadataText));
    if (metadata.gateway_id !== gatewayId || (device ? device.gateway_id !== gatewayId || device.observer_site_id !== metadata.observer_site_id : !allowed(gatewayId, metadata.observer_site_id))) return fail("Gateway is not allowed for this site.", 403);

    const clip = await readPart(formData, "clip", MAX_CLIP_BYTES, ["video/mp4"]);
    const thumbnail = await readPart(formData, "thumbnail", MAX_THUMBNAIL_BYTES, ["image/jpeg", "image/png", "image/webp"]);
    const clipHash = signableHash(clip.bytes);
    const thumbnailHash = signableHash(thumbnail.bytes);
    if (!device && !verifySignature(`${timestamp}.${nonce}.${metadataText}.${clipHash}.${thumbnailHash}`, signature, secret)) return fail("Invalid signature.", 401);

    const idempotencyKey = `${gatewayId}:${nonce}`;
    const existing = await supabase.from("provider_webhook_events").select("id").eq("webhook_key", "video_gateway_cloud_event_media").eq("idempotency_key", idempotencyKey).maybeSingle();
    if (existing.data?.id) return fail("Replay detected.", 409);

    const { data: camera } = await supabase
      .from("digital_observer_camera_sources")
      .select("id,observer_site_id,display_name,location_label,status,health_status,source_mode,metadata")
      .eq("id", metadata.camera_source_id)
      .eq("observer_site_id", metadata.observer_site_id)
      .maybeSingle();
    if (!camera) return fail("Camera source is not linked to this site.", 403);
    const cameraMetadata = camera.metadata && typeof camera.metadata === "object" ? camera.metadata : {};
    if (camera.source_mode === "demo" || camera.status === "disabled" || cameraMetadata.monitoring_enabled === false) return fail("Camera monitoring is disabled.", 403);
    if (device && cameraMetadata.gateway_id !== device.gateway_id) return fail("Camera belongs to a different Gateway.", 403);
    if (String(cameraMetadata.gateway_stream_id ?? "") !== metadata.stream_id) return fail("Camera source does not match gateway stream.", 403);
    const spatialValidation = eventValidationPipeline.validate(
      { event_type: metadata.event_type, evidence_kind: metadata.evidence_kind, severity: metadata.severity, confidence: metadata.confidence, description: metadata.event_summary, metadata: metadata.metadata },
      { id: camera.id, name: camera.display_name, area: camera.location_label, camera_zone_type: cameraMetadata.zone_type ?? cameraMetadata.camera_zone_type }
    );
    if (!spatialValidation.accepted) {
      // A gateway may report generic motion for every stream. Do not persist
      // or store media when that event is impossible for this camera's zone.
      return ok({ status: "suppressed", reason: "spatial_rule_rejected", camera_source_id: camera.id }, 202);
    }
    if (!spatialValidation.shouldRecord) {
      return ok({ status: "suppressed", reason: "passive_event_not_recorded", camera_source_id: camera.id }, 202);
    }
    const { data: observerSite, error: siteError } = await supabase
      .from("observer_sites")
      .select("event_retention_days,garden_id,site_type,monitoring_enabled,metadata")
      .eq("id", metadata.observer_site_id)
      .maybeSingle();
    if (siteError) throw new Error("EVENT_SCOPE_UNAVAILABLE");
    if (!observerSite || observerSite.garden_id || observerSite.site_type === "kindergarten" || !observerSite.monitoring_enabled || observerSite.metadata?.observer_monitoring_consent !== true) return fail("Monitoring consent required.", 403);
    // Media can only enrich a previously validated event, never originate one.
    const { data: signal, error: signalError } = await supabase.from("observer_intelligence_signals")
      .select("id,created_at,severity,metadata").eq("observer_site_id", metadata.observer_site_id)
      .eq("source_type", "system").eq("source_id", metadata.event_id).maybeSingle();
    if (signalError) throw new Error("EVENT_READ_FAILED");
    if (!signal || signal.metadata?.validated_event !== true || signal.metadata?.recording_required !== true || signal.metadata?.camera_source_id !== camera.id || signal.metadata?.event_type !== spatialValidation.event.event_type) return fail("A matching validated event is required before recording.", 409);
    if (Math.abs(Date.parse(metadata.captured_at) - Date.parse(signal.created_at)) > 60_000 || Date.parse(metadata.captured_at) > Date.now() + 60_000) return fail("Recording is outside the event capture window.", 422);
    const retentionHours = retentionHoursForSite(observerSite?.event_retention_days);
    const eventSummary = safeNarrative(signal.metadata.event_summary);
    const narrative = observerEventNarrative({
      signal_type: metadata.event_type,
      metadata: { event_type: metadata.event_type, event_summary: eventSummary }
    });

    const event = await supabase.from("provider_webhook_events").insert({
      webhook_key: "video_gateway_cloud_event_media",
      integration_type: "camera_gateway",
      provider: gatewayId,
      event_type: "event_media",
      event_id: metadata.event_id,
      idempotency_key: idempotencyKey,
      signature_valid: true,
      replay_detected: false,
      status: "verified",
      related_entity_type: "observer_sites",
      related_entity_id: metadata.observer_site_id,
      raw_payload_reference: null,
      metadata: { clip_hash: clipHash, thumbnail_hash: thumbnailHash, no_raw_payload_stored: true, no_credentials_received: true }
    }).select("id").single();
    if (event.error) throw new Error("EVIDENCE_UPLOAD_IDEMPOTENCY_WRITE_FAILED");

    const day = metadata.captured_at.slice(0, 10).replaceAll("-", "/");
    const basePath = `${metadata.observer_site_id}/${day}/${metadata.event_id}`;
    const clipPath = `${basePath}/clip.${extensionFor(clip.file.type)}`;
    const thumbnailPath = `${basePath}/thumbnail.${extensionFor(thumbnail.file.type)}`;
    const [clipUpload, thumbnailUpload] = await Promise.all([
      uploadPrivateMedia(supabase, clipPath, clip.bytes, clip.file.type),
      uploadPrivateMedia(supabase, thumbnailPath, thumbnail.bytes, thumbnail.file.type)
    ]);
    if (clipUpload.error || thumbnailUpload.error) throw new Error("EVIDENCE_STORAGE_UPLOAD_FAILED");

    const deleteAfter = new Date(Date.parse(metadata.captured_at) + retentionHours * 60 * 60 * 1000).toISOString();
    const clipPayload = {
      observer_site_id: metadata.observer_site_id,
      camera_source_id: metadata.camera_source_id,
      signal_id: signal.id,
      title: narrative.label,
      clip_status: "available",
      storage_bucket: MEDIA_BUCKET,
      storage_path: clipPath,
      snapshot_storage_path: thumbnailPath,
      captured_at: metadata.captured_at,
      duration_seconds: metadata.duration_seconds,
      retention_hours: retentionHours,
      delete_after: deleteAfter,
      downloadable: true,
      media_status: "available",
      media_missing_reason: null,
      retry_count: metadata.retry_count,
      window_seconds_before: metadata.window_seconds_before,
      window_seconds_after: metadata.window_seconds_after,
      last_media_attempt_at: new Date().toISOString(),
      metadata: {
        clip_sha256: clipHash,
        thumbnail_sha256: thumbnailHash,
        clip_available: true,
        thumbnail_available: true,
        media_status: "available",
        media_missing_reason: null,
        retry_count: metadata.retry_count,
        window_seconds_before: metadata.window_seconds_before,
        window_seconds_after: metadata.window_seconds_after,
        last_media_attempt_at: new Date().toISOString(),
        local_capture: true,
        read_only: true,
        no_credentials_received: true
      }
    };
    const existingClip = await supabase
      .from("digital_observer_event_clips")
      .select("id")
      .eq("signal_id", signal.id)
      .maybeSingle();
    const clipResult = existingClip.data?.id
      ? await supabase.from("digital_observer_event_clips").update(clipPayload).eq("id", existingClip.data.id).select("id").single()
      : await supabase.from("digital_observer_event_clips").insert(clipPayload).select("id").single();
    if (clipResult.error) throw new Error("EVIDENCE_METADATA_WRITE_FAILED");

    // Preserve original classification, tracking, timestamp and human review.
    const mediaAvailableAt = new Date().toISOString();
    const lifecycle = resolveMediaFault(signal.metadata, mediaAvailableAt);
    const signalUpdate = await supabase.from("observer_intelligence_signals").update({ metadata: {
      ...lifecycle.metadata, local_capture: true, media_status: "available", media_missing_reason: null,
      last_media_attempt_at: mediaAvailableAt
    } }).eq("id", signal.id).eq("observer_site_id", metadata.observer_site_id);
    if (signalUpdate.error) throw new Error("EVENT_MEDIA_LINK_FAILED");

    if (lifecycle.transition === "resolved") await writeAuditEvent({
      eventType: "observer_media_fault_resolved", eventCategory: "observer", targetType: "observer_intelligence_signal",
      targetId: signal.id, cameraId: camera.id, riskLevel: "low",
      metadata: { observer_site_id: metadata.observer_site_id, status: "resolved", resolution: "media_uploaded", occurred_at: mediaAvailableAt }
    });

    await supabase.from("provider_webhook_events").update({ status: "processed", processed_at: new Date().toISOString() }).eq("id", event.data.id);
    return ok({ status: "stored", signal_id: signal.id, clip_id: clipResult.data.id, signed_urls_returned: false }, 201);
  } catch (error) { return mediaPersistenceFailure(error); }
}
