import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstForwardedIp } from "@/lib/security/audit-log-service";
import { writeAuditEvent } from "@/lib/security/audit-log-service";

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
  const { profile } = await requireUser();
  const payload = privacyRequestSchema.parse(await request.json().catch(() => ({})));
  const supabase = await createClient();
  const requestKey = `privacy:${profile.id}:${payload.request_type}:${Date.now()}`;
  const dataSubjectType = payload.subject_type === "self" ? String(profile.role ?? "parent") : payload.subject_type;
  const dataSubjectId = payload.subject_type === "child" ? payload.child_id ?? null : profile.id;
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await supabase.from("privacy_rights_requests" as any).insert({
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
  }).select("*").single();
  if (insert.error) {
    return NextResponse.json({ error: insert.error.message }, { status: 400 });
  }

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

  return NextResponse.json({
    data: {
      id: insert.data.id,
      request_type: insert.data.request_type,
      status: publicStatus(insert.data.status),
      due_at: insert.data.due_at
    }
  }, { status: 201 });
}
