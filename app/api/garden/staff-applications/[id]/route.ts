import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["under_review", "request_more_information", "approve", "reject"]),
  decision_reason: z.string().optional(),
  assigned_role: z.string().optional(),
  assigned_class_group: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("המנהל/ת לא משויך/ת לגן.", 422);
    if (!isAdminClientConfigured()) return fail("אישור מועמדות צוות דורש Service Role בצד השרת.", 503);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const application = await admin.from("staff_job_applications" as any)
      .select("*, staff_candidate_profiles:staff_candidate_id(*)")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .maybeSingle();
    if (application.error || !application.data) return fail("המועמדות לא נמצאה בגן שלך.", 404);

    const now = new Date().toISOString();
    let status = application.data.status as string;
    let activatedStaffId: string | null = null;
    if (payload.action === "under_review") status = "under_review";
    if (payload.action === "request_more_information") status = "more_information_requested";
    if (payload.action === "reject") status = "rejected";
    if (payload.action === "approve") {
      const candidate = (application.data as any).staff_candidate_profiles;
      const staffWrite = await admin.from("staff" as any).insert({
        profile_id: application.data.staff_candidate_id,
        garden_id: profile.garden_id,
        full_name: candidate?.full_name ?? "איש צוות",
        role_title: payload.assigned_role ?? application.data.requested_role ?? "צוות",
        phone: candidate?.phone ?? null,
        email: candidate?.email ?? null,
        class_group: payload.assigned_class_group ?? null,
        approved_to_work: true,
        background_check_status: "pending_review",
        police_clearance_status: "pending_review",
        onboarding_status: "active",
        manager_approved_at: now,
        invited_by: profile.id,
        account_created_at: now
      }).select("id").single();
      if (staffWrite.error) return fail(staffWrite.error.message, 400);
      activatedStaffId = staffWrite.data.id as string;
      await Promise.all([
        admin.from("profiles" as any).update({
          garden_id: profile.garden_id,
          active: true,
          self_service_status: "active",
          self_service_approved_at: now,
          self_service_approved_by: profile.id
        }).eq("id", application.data.staff_candidate_id),
        admin.from("staff_candidate_profiles" as any).update({ status: "active" }).eq("profile_id", application.data.staff_candidate_id)
      ]);
      status = "approved";
    }

    const update = await admin.from("staff_job_applications" as any).update({
      status,
      manager_decision: payload.action,
      decision_reason: payload.decision_reason ?? null,
      decided_at: ["approve", "reject"].includes(payload.action) ? now : application.data.decided_at,
      activated_at: activatedStaffId ? now : application.data.activated_at,
      activated_staff_id: activatedStaffId ?? application.data.activated_staff_id,
      metadata: {
        ...(application.data.metadata ?? {}),
        assigned_role: payload.assigned_role ?? application.data.requested_role,
        assigned_class_group: payload.assigned_class_group ?? null
      }
    }).eq("id", id).select("*").single();
    if (update.error) return fail(update.error.message, 400);

    await Promise.all([
      admin.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: application.data.staff_candidate_id,
        recipient_role: "staff",
        title: status === "approved" ? "המועמדות אושרה" : status === "rejected" ? "המועמדות נדחתה" : "המועמדות עודכנה",
        body: payload.decision_reason ?? "סטטוס המועמדות שלך עודכן.",
        message: payload.decision_reason ?? "סטטוס המועמדות שלך עודכן.",
        entity_type: "staff_job_applications",
        entity_id: id,
        severity: "low",
        action_url: "/dashboard/staff",
        recipient_profile_id: application.data.staff_candidate_id,
        kindergarten_id: profile.garden_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        garden_id: profile.garden_id,
        entity_type: "staff_job_applications",
        entity_id: id,
        action: `staff_application_${payload.action}`,
        before_data: { status: application.data.status },
        after_data: { status, activated_staff_id: activatedStaffId }
      })
    ]);

    return ok({ application: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
