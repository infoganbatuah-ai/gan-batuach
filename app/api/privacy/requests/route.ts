import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstForwardedIp } from "@/lib/security/audit-log-service";
import { writeAuditEvent } from "@/lib/security/audit-log-service";
import { PrivacySubjectDenied, resolvePrivacyRequestSubject } from "@/lib/privacy/request-subject";

const privacyRequestSchema = z.object({
  request_type: z.enum(["access", "correction", "deletion", "export", "restriction", "anonymization"]),
  subject_type: z.enum(["self", "child", "garden"]).default("self"),
  child_id: z.string().uuid().optional(),
  request_reason: z.string().max(1200).optional()
}).refine(value => value.subject_type === "child" ? Boolean(value.child_id) : !value.child_id, { message: "Invalid privacy subject" });

function publicStatus(status: string) {
  return status === "submitted" ? "submitted" : status;
}

export async function POST(request: Request) {
  const { profile } = await requireUser();
  const parsed = privacyRequestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid privacy request" }, { status: 400 });
  const payload = parsed.data;
  const supabase = await createClient();
  let subject;
  try {
    subject = await resolvePrivacyRequestSubject(supabase, profile, payload.subject_type, payload.child_id);
  } catch (error) {
    if (error instanceof PrivacySubjectDenied) return NextResponse.json({ error: "Privacy subject unavailable" }, { status: 403 });
    throw error;
  }
  const requestKey = `privacy:${profile.id}:${payload.request_type}:${Date.now()}`;
  const dueAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const insert = await supabase.from("privacy_rights_requests" as never).insert({
    request_key: requestKey,
    requester_profile_id: profile.id,
    requested_by: profile.id,
    subject_user_id: subject.subjectUserId,
    garden_id: subject.gardenId,
    child_id: subject.childId,
    request_type: payload.request_type,
    data_subject_type: subject.subjectType,
    data_subject_id: subject.dataSubjectId,
    subject_type: subject.subjectType,
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
    return NextResponse.json({ error: "Privacy request could not be submitted" }, { status: 400 });
  }
  const submitted = insert.data as unknown as { id: string; request_type: string; status: string; due_at: string };

  await writeAuditEvent({
    eventType: "privacy_request_submitted",
    eventCategory: "regulatory",
    actorProfileId: profile.id,
    actorRole: profile.role,
    targetType: "privacy_request",
    targetId: submitted.id,
    gardenId: subject.gardenId,
    childId: subject.childId,
    ipAddress: firstForwardedIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    metadata: { request_type: payload.request_type, subject_type: payload.subject_type },
    riskLevel: payload.request_type === "deletion" || payload.request_type === "anonymization" ? "high" : "medium"
  });

  return NextResponse.json({
    data: {
      id: submitted.id,
      request_type: submitted.request_type,
      status: publicStatus(submitted.status),
      due_at: submitted.due_at
    }
  }, { status: 201 });
}
