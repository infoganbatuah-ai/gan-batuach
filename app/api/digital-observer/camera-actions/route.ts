import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import {
  PHYSICAL_COMMAND_TTL_MS, allowedPhysicalControls, physicalPayloadDigest,
  type CameraQueueResult
} from "@/lib/domain/digital-observer/camera-queue-contract";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const camera = z.string().uuid();
const prepare = z.discriminatedUnion("camera_action", [
  z.object({ action: z.literal("prepare"), request_id: z.string().uuid(), camera_source_id: camera,
    camera_action: z.literal("lighting"), payload: z.object({ enabled: z.boolean(), level: z.number().int().min(0).max(100).optional() }).strict() }).strict(),
  z.object({ action: z.literal("prepare"), request_id: z.string().uuid(), camera_source_id: camera,
    camera_action: z.literal("siren"), payload: z.object({ enabled: z.boolean(), duration_ms: z.number().int().min(250).max(5_000), volume: z.number().int().min(0).max(100).optional() }).strict() }).strict(),
  z.object({ action: z.literal("prepare"), request_id: z.string().uuid(), camera_source_id: camera,
    camera_action: z.literal("ptz"), payload: z.object({ command: z.enum([
      "Ptz_Cmd_Up", "Ptz_Cmd_Down", "Ptz_Cmd_Left", "Ptz_Cmd_Right",
      "Ptz_Cmd_UpLeft", "Ptz_Cmd_UpRight", "Ptz_Cmd_DownLeft", "Ptz_Cmd_DownRight",
      "Ptz_Cmd_ZoomMinus", "Ptz_Cmd_ZoomAdd", "Ptz_Cmd_FocusMinus", "Ptz_Cmd_FocusAdd"
    ]), duration_ms: z.number().int().min(50).max(500), speed: z.number().int().min(0).max(100) }).strict() }).strict()
]);
const requestSchema = z.union([
  z.object({ action: z.literal("controls"), camera_source_id: camera }).strict(),
  prepare,
  z.object({ action: z.literal("status"), request_id: z.string().uuid() }).strict(),
  z.object({ action: z.literal("confirm"), request_id: z.string().uuid(), confirmation_id: z.string().uuid(), confirmation_nonce: z.string().regex(/^[A-Za-z0-9_-]{32,128}$/) }).strict()
]);

type Source = {
  id: string; observer_site_id: string; status: string | null; health_status: string | null;
  metadata: Record<string, unknown> | null;
};

function sourceBinding(source: Source) {
  const gatewayId = source.metadata?.gateway_id;
  const streamId = source.metadata?.gateway_stream_id;
  const channel = source.metadata?.dvr_channel;
  if (typeof gatewayId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(gatewayId)
    || typeof streamId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(streamId)
    || !Number.isInteger(channel) || Number(channel) < 1 || Number(channel) > 64) return null;
  return { gatewayId, streamId, channel: Number(channel) };
}

function sourceOnline(source: Source) {
  return ["connected", "online", "active", "ready"].includes(String(source.status ?? "").toLowerCase())
    && ["healthy", "online", "connected", "ok"].includes(String(source.health_status ?? "").toLowerCase());
}

async function latestCapabilitySnapshot(admin: ReturnType<typeof createAdminClient>, source: Source) {
  const result = await admin.from("digital_observer_camera_action_requests")
    .select("id,result,completed_at")
    .eq("observer_site_id", source.observer_site_id).eq("camera_source_id", source.id)
    .eq("task_kind", "capability_snapshot").eq("action_status", "completed")
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("CAMERA_CONTROL_QUEUE_UNAVAILABLE");
  const persisted = result.data?.result;
  if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) return null;
  const { reported_by_gateway: reportedByGateway, ...wire } = persisted as Record<string, unknown>;
  return reportedByGateway === true ? wire as CameraQueueResult : null;
}

async function unresolvedPhysicalResult(admin: ReturnType<typeof createAdminClient>, source: Source) {
  const result = await admin.from("digital_observer_camera_action_requests")
    .select("id,action_status,completed_at").eq("observer_site_id", source.observer_site_id)
    .eq("camera_source_id", source.id).eq("task_kind", "physical_command")
    .in("action_status", ["reconciliation_required", "unknown"])
    .order("completed_at", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error("CAMERA_CONTROL_QUEUE_UNAVAILABLE");
  return result.data as { id: string; action_status: "reconciliation_required" | "unknown"; completed_at: string | null } | null;
}

async function cameraAutomationPolicy(admin: ReturnType<typeof createAdminClient>, source: Source) {
  const result = await admin.from("digital_observer_camera_automation_policies")
    .select("id,enabled,allowed_actions,siren_duration_ms,active_from,active_until,minimum_confidence,siren_minimum_confidence")
    .eq("observer_site_id", source.observer_site_id).eq("camera_source_id", source.id).maybeSingle();
  if (result.error) throw new Error("CAMERA_CONTROL_AUTOMATION_UNAVAILABLE");
  if (!result.data?.enabled) return { enabled: false, allowed_actions: [] as string[] };
  return {
    enabled: true,
    policy_id: result.data.id,
    allowed_actions: Array.isArray(result.data.allowed_actions) ? result.data.allowed_actions : [],
    siren_duration_ms: result.data.siren_duration_ms,
    active_from: result.data.active_from,
    active_until: result.data.active_until,
    minimum_confidence: result.data.minimum_confidence,
    siren_minimum_confidence: result.data.siren_minimum_confidence,
    trigger_guard: "verified_event_and_live_capability_required"
  };
}

function snapshotMatchesSource(result: CameraQueueResult | null, source: Source, binding: ReturnType<typeof sourceBinding>) {
  if (!result || !binding || result.outcome !== "capability_snapshot") return false;
  const value = result.outcome_payload;
  return value.site_id === source.observer_site_id && value.camera_id === source.id && value.gateway_id === binding.gatewayId
    && value.stream_id === binding.streamId && value.channel === binding.channel;
}

function capabilityEvidence(result: CameraQueueResult, action: "lighting" | "siren" | "ptz") {
  if (result.outcome !== "capability_snapshot") throw new Error("CAMERA_CONTROL_CAPABILITY_UNAVAILABLE");
  const value = result.outcome_payload;
  if (value.executor_installed !== true || value.capabilities[action] !== true || !value.live
    || !value.gateway_id || !value.source_generation || !value.binding_generation) throw new Error("CAMERA_CONTROL_CAPABILITY_UNAVAILABLE");
  return {
    adapter: value.driver, action, supported: true, executor_installed: true,
    evidence_id: value.evidence_id, verified_at: value.verified_at, site_id: value.site_id,
    camera_id: value.camera_id, gateway_id: value.gateway_id, stream_id: value.stream_id, channel: value.channel,
    source_generation: value.source_generation, binding_generation: value.binding_generation,
    live: value.live
  };
}

async function accessibleSource(
  supabase: Parameters<typeof getObserverSiteAccess>[0],
  admin: ReturnType<typeof createAdminClient>,
  profile: Parameters<typeof getObserverSiteAccess>[1],
  cameraSourceId: string
) {
  const result = await admin.from("digital_observer_camera_sources")
    .select("id,observer_site_id,status,health_status,metadata").eq("id", cameraSourceId).maybeSingle();
  if (result.error || !result.data) return { error: fail("המצלמה לא נמצאה.", 404) };
  const site = await getObserverSiteAccess(supabase, profile, result.data.observer_site_id, { manage: true });
  if (!site) return { error: fail("אין הרשאת ניהול למצלמה הזו.", 403) };
  return { source: result.data as Source };
}

export async function POST(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    const input = requestSchema.parse(await request.json());
    const supabase = session.supabase;
    const admin = createAdminClient();

    if (input.action === "status") {
      const found = await admin.from("digital_observer_camera_action_requests")
        .select("id,observer_site_id,requested_by,task_kind,action_status,non_retryable,completed_at")
        .eq("id", input.request_id).maybeSingle();
      if (found.error || !found.data) return fail("בקשת הפעולה אינה זמינה.", 404);
      if (found.data.task_kind !== "physical_command" || found.data.requested_by !== session.profile.id) {
        return fail("הבקשה אינה שייכת למשתמש הזה.", 403);
      }
      const site = await getObserverSiteAccess(supabase, session.profile, found.data.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאת ניהול לפעולה הזו.", 403);
      const warning = ["reconciliation_required", "unknown"].includes(found.data.action_status);
      const terminal = ["completed", "failed", "reconciliation_required", "unknown", "blocked", "expired", "cancelled"].includes(found.data.action_status);
      const messages: Record<string, string> = {
        completed: "הפעולה בוצעה ואומתה.",
        failed: "הפעולה נכשלה לפני אישור ביצוע.",
        blocked: "הפעולה נחסמה לפני ביצוע.",
        expired: "הפעולה פגה לפני ביצוע.",
        cancelled: "הפעולה בוטלה.",
        reconciliation_required: "התקבל אישור מהמכשיר אך המצב הסופי דורש בדיקה ידנית. אין לשלוח את הפעולה שוב.",
        unknown: "בוצע ניסיון כתיבה אך לא התקבל אישור מצב. אין לשלוח את הפעולה שוב עד בדיקה ידנית."
      };
      return ok({ request_id: input.request_id, observer_site_id: found.data.observer_site_id,
        status: found.data.action_status, terminal, operator_warning: warning,
        non_retryable: found.data.non_retryable === true, completed_at: found.data.completed_at,
        message: messages[found.data.action_status] ?? "הפעולה ממתינה לעדכון מה-Gateway." });
    }

    if (input.action === "confirm") {
      const found = await admin.from("digital_observer_camera_action_requests")
        .select("id,camera_source_id,observer_site_id,requested_by,task_kind,action_status,expires_at")
        .eq("id", input.request_id).maybeSingle();
      if (found.error || !found.data) return fail("בקשת הפעולה אינה זמינה.", 404);
      if (found.data.task_kind !== "physical_command" || found.data.requested_by !== session.profile.id) return fail("האישור אינו שייך למשתמש או לפעולה הזו.", 403);
      const site = await getObserverSiteAccess(supabase, session.profile, found.data.observer_site_id, { manage: true });
      if (!site) return fail("אין הרשאת ניהול למצלמה הזו.", 403);
      const confirmed = await admin.rpc("confirm_camera_physical_command", {
        requested_action_id: input.request_id, confirming_actor_id: session.profile.id,
        confirmation_value: input.confirmation_id, confirmation_nonce: input.confirmation_nonce
      });
      if (confirmed.error) {
        const expired = Date.parse(found.data.expires_at) <= Date.now();
        return fail(expired ? "תוקף האישור פג. יש להתחיל פעולה חדשה." : "האישור כבר נוצל או אינו תואם לפעולה.", 409);
      }
      return ok({ accepted: true, queued: true, executed: false, request_id: input.request_id,
        observer_site_id: found.data.observer_site_id,
        message: "האישור החד-פעמי נרשם. הפעולה ממתינה ל-Gateway ולא תישלח שוב אוטומטית." }, 202);
    }

    const access = await accessibleSource(supabase, admin, session.profile, input.camera_source_id);
    if (access.error) return access.error;
    const source = access.source!;
    const binding = sourceBinding(source);
    const [unresolved, snapshot, automation] = await Promise.all([
      unresolvedPhysicalResult(admin, source),
      latestCapabilitySnapshot(admin, source),
      cameraAutomationPolicy(admin, source)
    ]);
    const controls = !unresolved && snapshotMatchesSource(snapshot, source, binding) ? allowedPhysicalControls(snapshot) : [];
    const diagnostics = unresolved ? "operator_lock"
      : controls.length ? "live_capabilities"
        : sourceOnline(source) ? "online" : "unavailable";

    if (input.action === "controls") return ok({ camera_source_id: source.id, observer_site_id: source.observer_site_id,
      controls, diagnostics, requires_immediate_confirmation: true, digital_guard_automation: automation,
      operator_warning: Boolean(unresolved), non_retryable: Boolean(unresolved),
      message: unresolved ? "קיימת פעולה שמחייבת בדיקה ידנית. הבקרים הפיזיים נעולים ואין לשלוח אותה שוב." : null });
    if (unresolved) return fail("קיימת פעולה במצב לא ודאי. הבקרים נעולים עד בירור ידני ואין לשלוח אותה שוב.", 423);
    if (!binding || !sourceOnline(source)) return fail("המצלמה אינה מחוברת כרגע. לא הוכנה פעולה.", 409);
    if (!controls.includes(input.camera_action)) return fail("הפעולה אינה נתמכת בראיות היכולת החיות של המצלמה.", 422);
    const normalized = physicalPayloadDigest(input.camera_action, input.payload);
    const evidence = capabilityEvidence(snapshot!, input.camera_action);
    const now = Date.now(), requestedAt = new Date(now).toISOString(), expiresAt = new Date(now + PHYSICAL_COMMAND_TTL_MS).toISOString();
    const confirmationId = randomUUID();
    const confirmationNonce = randomBytes(32).toString("base64url");
    const nonceHash = createHash("sha256").update(confirmationNonce).digest("hex");
    const inserted = await admin.from("digital_observer_camera_action_requests").insert({
      id: input.request_id, observer_site_id: source.observer_site_id, camera_source_id: source.id,
      requested_by: session.profile.id, action_type: input.camera_action, request_origin: "dashboard",
      action_status: "awaiting_confirmation", task_kind: "physical_command",
      gateway_id: binding.gatewayId, stream_id: binding.streamId, channel: binding.channel,
      source_generation: evidence.source_generation, binding_generation: evidence.binding_generation,
      parameters: normalized.payload, payload_digest: normalized.digest, capability_evidence: evidence,
      idempotency_key: `physical:${input.request_id}`, requested_at: requestedAt, expires_at: expiresAt,
      confirmation_nonce_hash: nonceHash, confirmation_expires_at: expiresAt
    }).select("id,expires_at").single();
    if (inserted.error) return fail(inserted.error.code === "23505" ? "הבקשה כבר קיימת ולא ניתן להפיק לה אישור חדש." : "לא ניתן להכין את הפעולה בבטחה.", inserted.error.code === "23505" ? 409 : 503);
    return ok({ prepared: true, executed: false, request_id: input.request_id, confirmation_id: confirmationId,
      confirmation_nonce: confirmationNonce,
      expires_at: expiresAt, camera_source_id: source.id, observer_site_id: source.observer_site_id,
      camera_action: input.camera_action,
      message: "הפעולה הוכנה בלבד. נדרש אישור מיידי וחד-פעמי לפני מסירה ל-Gateway." }, 201);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("CAMERA_CONTROL_")) return fail("ראיית היכולת החיה אינה זמינה. לא הוכנה פעולה.", 428);
    return handleRouteError(error);
  }
}
