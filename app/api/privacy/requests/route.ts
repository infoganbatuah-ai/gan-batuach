import crypto from "node:crypto";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstForwardedIp } from "@/lib/security/audit-log-service";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { assertTrustedMutationOrigin, parseBoundedJson, privateRateLimitIdentifier } from "@/lib/security/request-guards";

const privacyRequestSchema = z.object({
  request_type: z.enum(["access", "correction", "deletion", "export", "restriction", "anonymization"]),
  subject_type: z.enum(["self", "child", "garden"]).default("self"),
  child_id: z.string().uuid().optional(),
  request_reason: z.string().max(1200).optional()
});

function publicStatus(status: string) {
  return status === "submitted" ? "submitted" : status;
}

export async function POST(request: Request) {
  try {
    assertTrustedMutationOrigin(request);
    const { profile } = await getSessionProfile();
    if (!profile) return fail("נדרשת התחברות מחדש.", 401);
    const payload = privacyRequestSchema.parse(await parseBoundedJson(request, 4 * 1024));
    const supabase = await createClient() as unknown as SupabaseClient;
    await assertRateLimit(privateRateLimitIdentifier({ userId: profile.id, tenantId: profile.garden_id, headers: request.headers }), "privacy:rights-request", 6, 60 * 60);
    if (payload.subject_type === "child") {
      if (!payload.child_id) return fail("נדרש מזהה ילד תקין לבקשה הזאת.", 422);
      const child = await supabase.from("children").select("id").eq("id", payload.child_id).maybeSingle();
      if (!child.data) return fail("אין הרשאה להגיש בקשה עבור הילד הזה.", 403);
    }
    const requestKey = `privacy:${profile.id}:${payload.request_type}:${crypto.randomUUID()}`;
    const dataSubjectType = payload.subject_type === "self" ? String(profile.role ?? "parent") : payload.subject_type;
    const dataSubjectId = payload.subject_type === "child" ? payload.child_id ?? null : profile.id;
    const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const insert = await supabase.from("privacy_rights_requests").insert({
    request_key: requestKey,
    requester_profile_id: profile.id,
    requested_by: profile.id,
    subject_user_id: payload.subject_type === "self" ? profile.id : null,
    garden_id: profile.garden_id ?? null,
    child_id: payload.subject_type === "child" ? payload.child_id ?? null : null,
    request_type: payload.request_type,
    data_subject_type: dataSubjectType,
    data_subject_id: dataSubjectId,
    subject_type: dataSubjectType,
    status: "submitted",
    due_at: dueAt,
    request_reason: payload.request_reason ?? null,
    response_summary: "הבקשה התקבלה ותועבר לבדיקה ידנית.",
    metadata: {
      source: "user_privacy_portal",
      ip: firstForwardedIp(request.headers),
      parent_visible: true
    }
    }).select("id,request_type,status,due_at").single();
    if (insert.error || !insert.data) return fail("לא ניתן לשמור את בקשת הפרטיות.", 400);

    await writeAuditEvent({
    eventType: "privacy_request_submitted",
    eventCategory: "regulatory",
    actorProfileId: profile.id,
    actorRole: profile.role,
    targetType: "privacy_request",
    targetId: insert.data?.id ?? null,
    gardenId: profile.garden_id ?? null,
    childId: payload.child_id ?? null,
    ipAddress: firstForwardedIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: { request_type: payload.request_type, subject_type: payload.subject_type },
    riskLevel: payload.request_type === "deletion" || payload.request_type === "anonymization" ? "high" : "medium"
    });

    return ok({
      id: insert.data.id,
      request_type: insert.data.request_type,
      status: publicStatus(insert.data.status),
      due_at: insert.data.due_at
    }, 201);
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
