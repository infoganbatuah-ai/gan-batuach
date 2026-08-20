import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { activateKindergartenEnrollment } from "@/lib/domain/enrollment-activation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const actionSchema = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
  child_profile_id: z.string().uuid().optional(),
  requested_class_id: z.string().uuid().optional()
});

export async function GET() {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!isAdminClientConfigured()) return fail("טעינת הזמנות דורשת שירות שרת מאובטח.", 503);
    const admin = createAdminClient();
    const [invitationsRes, childrenRes] = await Promise.all([
      admin.from("user_affiliation_requests" as any)
        .select("id,requester_id,target_id,status,metadata,created_at,updated_at")
        .eq("target_type", "kindergarten")
        .eq("request_type", "parent_to_kindergarten")
        .in("status", ["submitted", "under_review"])
        .contains("metadata", { invited_parent_profile_id: profile.id, direction: "kindergarten_to_parent" })
        .order("created_at", { ascending: false }),
      admin.from("permanent_child_files" as any).select("id,full_name,birth_date,owner_status").eq("primary_parent_profile_id", profile.id).order("created_at", { ascending: false })
    ]);
    const invitations = (invitationsRes.data ?? []) as any[];
    const gardenIds = invitations.map((row) => row.target_id).filter(Boolean);
    const gardens = gardenIds.length ? await admin.from("gardens" as any).select("id,name,city,address,image_url,public_description,phone,email").in("id", gardenIds) : { data: [] };
    const groups = gardenIds.length ? await admin.from("kindergarten_fee_groups" as any).select("id,garden_id,group_name,age_range,monthly_fee,billing_day,show_price_public,active").in("garden_id", gardenIds).eq("active", true) : { data: [] };
    return ok({ invitations, children: childrenRes.data ?? [], gardens: gardens.data ?? [], fee_groups: groups.data ?? [] });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!isAdminClientConfigured()) return fail("אישור הזמנה דורש שירות שרת מאובטח.", 503);
    const payload = actionSchema.parse(await request.json());
    const admin = createAdminClient();
    const invitationRes = await admin.from("user_affiliation_requests" as any)
      .select("*")
      .eq("id", payload.invitation_id)
      .eq("target_type", "kindergarten")
      .eq("request_type", "parent_to_kindergarten")
      .in("status", ["submitted", "under_review"])
      .contains("metadata", { invited_parent_profile_id: profile.id, direction: "kindergarten_to_parent" })
      .maybeSingle();
    if (!invitationRes.data) return fail("ההזמנה לא נמצאה או אינה שייכת לחשבון שלך.", 404);
    const invitation = invitationRes.data as any;
    const now = new Date().toISOString();
    if (payload.action === "reject") {
      await admin.from("user_affiliation_requests" as any).update({ status: "rejected", decision_by: profile.id, decision_at: now, audit_status: "recorded", updated_at: now }).eq("id", invitation.id);
      return ok({ status: "rejected" });
    }
    if (!payload.child_profile_id) return fail("יש לבחור ילד לפני אישור ההצטרפות.", 422);
    const child = await admin.from("permanent_child_files" as any).select("id,full_name,primary_parent_profile_id,duplicate_flags").eq("id", payload.child_profile_id).eq("primary_parent_profile_id", profile.id).maybeSingle();
    if (!child.data) return fail("כרטיס הילד לא נמצא או אינו שייך לחשבון שלך.", 403);
    const classId = payload.requested_class_id ?? invitation.metadata?.requested_class_id ?? null;
    let price = invitation.metadata?.published_price_snapshot ?? null;
    let requestedAgeGroup: string | null = null;
    if (classId) {
      const fee = await admin.from("kindergarten_fee_groups" as any).select("id,group_name,monthly_fee").eq("id", classId).eq("garden_id", invitation.target_id).maybeSingle();
      if (!fee.data) return fail("קבוצת התשלום אינה זמינה בגן.", 422);
      price = Number((fee.data as any).monthly_fee ?? 0);
      requestedAgeGroup = (fee.data as any).group_name ?? null;
    }
    const enrollment = await admin.from("kindergarten_enrollment_requests" as any).upsert({
      parent_id: profile.id,
      child_profile_id: payload.child_profile_id,
      garden_id: invitation.target_id,
      requested_age_group: requestedAgeGroup,
      requested_class_id: classId,
      published_price_snapshot: price,
      parent_message: "הצטרפות אושרה על ידי ההורה בעקבות הזמנת הגן",
      status: "submitted",
      requested_at: now,
      payment_required: true,
      payment_status: "not_requested",
      duplicate_flags: (child.data as any).duplicate_flags ?? [],
      metadata: { source: "kindergarten_invitation", invitation_id: invitation.id, parent_accepted_at: now }
    }, { onConflict: "parent_id,child_profile_id,garden_id" }).select("*").single();
    if (enrollment.error) return fail(enrollment.error.message, 400);
    const childId = await activateKindergartenEnrollment(admin, enrollment.data, { id: invitation.requester_id }, {
      assigned_age_group: requestedAgeGroup,
      assigned_class_id: classId,
      source: "kindergarten_invitation_parent_accepted",
      invitation_status: "parent_accepted"
    });
    await Promise.all([
      admin.from("kindergarten_enrollment_requests" as any).update({ status: "approved", manager_decision: "invited_by_kindergarten", decision_reason: "ההורה אישר הזמנה ישירה מהגן", decided_at: now, activated_at: now, activated_child_id: childId, metadata: { ...(enrollment.data.metadata ?? {}), parent_accepted_at: now } }).eq("id", enrollment.data.id),
      admin.from("user_affiliation_requests" as any).update({ status: "approved", decision_by: profile.id, decision_at: now, audit_status: "recorded", metadata: { ...(invitation.metadata ?? {}), child_profile_id: payload.child_profile_id, activated_child_id: childId, accepted_at: now }, updated_at: now }).eq("id", invitation.id),
      admin.from("notifications" as any).insert({ garden_id: invitation.target_id, recipient_id: invitation.requester_id, recipient_profile_id: invitation.requester_id, recipient_role: "manager", title: "הורה אישר הצטרפות", body: `${profile.full_name ?? "הורה"} אישר/ה את ההזמנה והילד/ה שויך/ה לגן.`, entity_type: "kindergarten_enrollment_requests", entity_id: enrollment.data.id, severity: "low", action_url: "/dashboard/garden/children", kindergarten_id: invitation.target_id, created_by: profile.id }),
      admin.from("audit_logs" as any).insert({ actor_id: profile.id, actor_role: "parent", garden_id: invitation.target_id, entity_type: "user_affiliation_requests", entity_id: invitation.id, action: "parent_accepted_kindergarten_invitation", after_data: { child_profile_id: payload.child_profile_id, activated_child_id: childId } })
    ]);
    return ok({ status: "approved", child_id: childId, enrollment_request_id: enrollment.data.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
