import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { activateKindergartenEnrollment } from "@/lib/domain/enrollment-activation";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["under_review", "request_more_information", "approve_pending_payment", "approve_without_payment", "mark_payment_paid", "reject"]),
  decision_reason: z.string().optional(),
  assigned_age_group: z.string().optional(),
  assigned_class_id: z.string().uuid().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("המנהל/ת לא משויך/ת לגן.", 422);
    if (!isAdminClientConfigured()) return fail("אישור בקשות דורש Service Role בצד השרת.", 503);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const requestRes = await admin.from("kindergarten_enrollment_requests" as any)
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .maybeSingle();
    if (requestRes.error || !requestRes.data) return fail("בקשת ההצטרפות לא נמצאה בגן שלך.", 404);

    const now = new Date().toISOString();
    let status = requestRes.data.status as string;
    let paymentStatus = requestRes.data.payment_status as string;
    let activatedChildId: string | null = null;
    if (payload.action === "under_review") status = "under_review";
    if (payload.action === "request_more_information") status = "more_information_requested";
    if (payload.action === "reject") status = "rejected";
    if (payload.action === "approve_pending_payment") {
      status = "approved_pending_payment";
      paymentStatus = "pending";
    }
    if (payload.action === "approve_without_payment" || payload.action === "mark_payment_paid") {
      status = "approved";
      paymentStatus = payload.action === "mark_payment_paid" ? "paid" : "waived";
      activatedChildId = await activateKindergartenEnrollment(admin, requestRes.data, profile, {
        assigned_age_group: payload.assigned_age_group,
        assigned_class_id: payload.assigned_class_id,
        source: "parent_self_service_enrollment"
      });
    }

    const update = await admin.from("kindergarten_enrollment_requests" as any).update({
      status,
      manager_decision: payload.action,
      decision_reason: payload.decision_reason ?? null,
      decided_at: ["reject", "approve_pending_payment", "approve_without_payment", "mark_payment_paid"].includes(payload.action) ? now : requestRes.data.decided_at,
      payment_status: paymentStatus,
      activated_at: activatedChildId ? now : requestRes.data.activated_at,
      activated_child_id: activatedChildId ?? requestRes.data.activated_child_id,
      metadata: {
        ...(requestRes.data.metadata ?? {}),
        assigned_age_group: payload.assigned_age_group ?? requestRes.data.requested_age_group,
        assigned_class_id: payload.assigned_class_id ?? requestRes.data.requested_class_id
      }
    }).eq("id", id).select("*").single();
    if (update.error) return fail(update.error.message, 400);

    await Promise.all([
      admin.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: requestRes.data.parent_id,
        recipient_role: "parent",
        title: status === "rejected" ? "בקשת ההצטרפות נדחתה" : status === "approved_pending_payment" ? "הבקשה אושרה וממתינה לתשלום" : status === "approved" ? "הילד/ה הופעל/ה בגן" : "בקשת ההצטרפות עודכנה",
        body: payload.decision_reason ?? "סטטוס בקשת ההצטרפות עודכן.",
        message: payload.decision_reason ?? "סטטוס בקשת ההצטרפות עודכן.",
        entity_type: "kindergarten_enrollment_requests",
        entity_id: id,
        severity: status === "rejected" ? "medium" : "low",
        action_url: "/dashboard/parent",
        recipient_profile_id: requestRes.data.parent_id,
        kindergarten_id: profile.garden_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        garden_id: profile.garden_id,
        entity_type: "kindergarten_enrollment_requests",
        entity_id: id,
        action: `enrollment_request_${payload.action}`,
        before_data: { status: requestRes.data.status, payment_status: requestRes.data.payment_status },
        after_data: { status, payment_status: paymentStatus, activated_child_id: activatedChildId }
      })
    ]);

    return ok({ enrollment_request: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
