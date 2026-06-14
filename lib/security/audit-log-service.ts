import "server-only";

import crypto from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionProfile } from "@/lib/auth";

type AuditCategory =
  | "auth"
  | "medical"
  | "camera"
  | "document"
  | "child"
  | "staff"
  | "parent"
  | "inspection"
  | "incident"
  | "observer"
  | "payment"
  | "admin"
  | "security"
  | "regulatory";

type RiskLevel = "low" | "medium" | "high" | "critical";

type AuditInput = {
  eventType: string;
  eventCategory: AuditCategory;
  actorProfileId?: string | null;
  actorRole?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  gardenId?: string | null;
  childId?: string | null;
  cameraId?: string | null;
  documentId?: string | null;
  inspectionId?: string | null;
  incidentId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  deviceFingerprint?: string | null;
  requestId?: string | null;
  sessionId?: string | null;
  metadata?: unknown;
  riskLevel?: RiskLevel;
};

const sensitiveKeyPattern = /(password|passcode|one.?time|otp|token|secret|key|authorization|cookie|signed.?url|rtsp|stream.?url|gateway|credential|identity.?number|id_number|medical|allerg|medication|medicine|dosage|health.?note|signature|private.?url|decrypted|encryption)/i;
const identityLikePattern = /\b\d{7,10}\b/g;
const signedUrlPattern = /(X-Amz-Signature|token=|signature=|signedUrl=|rtsp:\/\/|rtsps:\/\/|webrtc:\/\/|hls:\/\/)/i;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeString(value: string) {
  if (signedUrlPattern.test(value)) return "[redacted-url]";
  return value.replace(identityLikePattern, "[redacted-id]");
}

export function sanitizeAuditMetadata(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (depth > 6) return "[redacted-depth]";
  if (typeof value === "string") return safeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditMetadata(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeAuditMetadata(item, depth + 1)
    ]));
  }
  return "[redacted]";
}

export function firstForwardedIp(headers: Headers) {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || null;
}

export function requestId(headers: Headers) {
  return headers.get("x-vercel-id") || headers.get("x-request-id") || crypto.randomUUID();
}

export function deviceFingerprint(headers: Headers) {
  const raw = [headers.get("user-agent") ?? "", headers.get("accept-language") ?? ""].join("|");
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function uuidOrNull(value: string | null | undefined) {
  return value && uuidPattern.test(value) ? value : null;
}

export async function writeAuditEvent(input: AuditInput) {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("immutable_audit_events" as any).insert({
      event_type: input.eventType,
      event_category: input.eventCategory,
      actor_profile_id: input.actorProfileId ?? null,
      actor_role: input.actorRole ?? null,
      target_type: input.targetType ?? null,
      target_id: uuidOrNull(input.targetId),
      garden_id: uuidOrNull(input.gardenId),
      child_id: uuidOrNull(input.childId),
      camera_id: uuidOrNull(input.cameraId),
      document_id: uuidOrNull(input.documentId),
      inspection_id: uuidOrNull(input.inspectionId),
      incident_id: uuidOrNull(input.incidentId),
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      device_fingerprint: input.deviceFingerprint ?? null,
      request_id: input.requestId ?? null,
      session_id: input.sessionId ?? null,
      metadata: sanitizeAuditMetadata({ ...(input.metadata as Record<string, unknown> ?? {}), raw_target_id: uuidOrNull(input.targetId) ? undefined : input.targetId ?? undefined }),
      risk_level: input.riskLevel ?? "medium"
    });
    if (error) console.error("[immutable-audit] write failed", { eventType: input.eventType, message: error.message });
  } catch (error) {
    console.error("[immutable-audit] write crashed", error);
  }
}

export async function writeMedicalAccessEvent(input: Omit<AuditInput, "eventCategory" | "eventType" | "targetType"> & { action: "decrypt" | "view" | "update" | "export" | "delete_request"; fieldAccessed: string; reason?: string | null }) {
  await writeAuditEvent({
    ...input,
    eventType: `medical_${input.action}`,
    eventCategory: "medical",
    targetType: "medical_record",
    metadata: { ...(input.metadata as Record<string, unknown> ?? {}), field_accessed: input.fieldAccessed, reason: input.reason ?? null },
    riskLevel: input.riskLevel ?? (input.action === "export" || input.action === "delete_request" ? "high" : "medium")
  });
  try {
    const supabase = createAdminClient();
    await supabase.from("medical_data_access_logs" as any).insert({
      user_id: input.actorProfileId ?? null,
      role: input.actorRole ?? null,
      child_id: input.childId ?? null,
      garden_id: input.gardenId ?? null,
      field_accessed: input.fieldAccessed,
      action: input.action,
      ip: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
      reason: input.reason ?? null,
      metadata: sanitizeAuditMetadata(input.metadata ?? {})
    });
  } catch (error) {
    console.error("[medical-audit] compatibility log failed", error);
  }
}

export async function writeCameraAccessEvent(input: Omit<AuditInput, "eventCategory" | "targetType"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "camera", targetType: "camera", riskLevel: input.riskLevel ?? "high" });
}

export async function writeDocumentAccessEvent(input: Omit<AuditInput, "eventCategory" | "targetType"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "document", targetType: "document", riskLevel: input.riskLevel ?? "high" });
}

export async function writeAdminActionEvent(input: Omit<AuditInput, "eventCategory"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "admin", riskLevel: input.riskLevel ?? "medium" });
}

export async function writeSecurityEvent(input: Omit<AuditInput, "eventCategory"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "security", riskLevel: input.riskLevel ?? "high" });
}

export async function writePaymentEvent(input: Omit<AuditInput, "eventCategory"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "payment", riskLevel: input.riskLevel ?? "medium" });
}

export async function writeAIReviewEvent(input: Omit<AuditInput, "eventCategory"> & { eventType: string }) {
  return writeAuditEvent({ ...input, eventCategory: "observer", riskLevel: input.riskLevel ?? "high" });
}

export function withAuditLog<TContext = unknown>(
  handler: (request: Request, context: TContext) => Promise<Response>,
  options?: { eventType?: string; eventCategory?: AuditCategory; targetType?: string; riskLevel?: RiskLevel }
) {
  return async (request: Request, context: TContext) => {
    const started = Date.now();
    let response: Response | null = null;
    let thrown: unknown = null;
    try {
      response = await handler(request, context);
      return response;
    } catch (error) {
      thrown = error;
      throw error;
    } finally {
      const session = await getSessionProfile().catch(() => ({ profile: null }));
      const url = new URL(request.url);
      await writeAuditEvent({
        eventType: thrown ? "api_request_failed" : options?.eventType ?? "api_request",
        eventCategory: options?.eventCategory ?? (response && response.status >= 400 ? "security" : "admin"),
        actorProfileId: session.profile?.id ?? null,
        actorRole: session.profile?.role ?? null,
        targetType: options?.targetType ?? "api_route",
        ipAddress: firstForwardedIp(request.headers),
        userAgent: request.headers.get("user-agent"),
        deviceFingerprint: deviceFingerprint(request.headers),
        requestId: requestId(request.headers),
        metadata: {
          method: request.method,
          route: url.pathname,
          status: response?.status ?? 500,
          duration_ms: Date.now() - started
        },
        riskLevel: options?.riskLevel ?? (response && response.status >= 400 ? "high" : "low")
      });
    }
  };
}
