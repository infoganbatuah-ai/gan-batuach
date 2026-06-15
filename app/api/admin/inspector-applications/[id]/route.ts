import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["under_review", "request_more_information", "approve_pending_assignment", "approve", "reject", "suspend"]),
  decision_reason: z.string().optional(),
  assigned_regions: z.array(z.string()).optional(),
  garden_ids: z.array(z.string().uuid()).optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin"]);
    if (!isAdminClientConfigured()) return fail("אישור מפקחים דורש Service Role בצד השרת.", 503);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const application = await admin.from("inspector_applications" as any).select("*").eq("id", id).maybeSingle();
    if (application.error || !application.data) return fail("בקשת המפקח לא נמצאה.", 404);

    const now = new Date().toISOString();
    let status = application.data.status as string;
    if (payload.action === "under_review") status = "under_review";
    if (payload.action === "request_more_information") status = "more_information_requested";
    if (payload.action === "approve_pending_assignment") status = "approved_pending_assignment";
    if (payload.action === "reject") status = "rejected";
    if (payload.action === "suspend") status = "suspended";
    if (payload.action === "approve") {
      status = "approved";
      const inspector = await admin.from("inspectors" as any).upsert({
        id: application.data.profile_id,
        service_cities: payload.assigned_regions ?? application.data.preferred_regions ?? [],
        certification_notes: application.data.experience_summary ?? null
      }, { onConflict: "id" });
      if (inspector.error) return fail(inspector.error.message, 400);
      if (payload.garden_ids?.length) {
        const gardens = await admin.from("gardens" as any).update({ inspector_id: application.data.profile_id }).in("id", payload.garden_ids).select("id");
        if (gardens.error || (gardens.data?.length ?? 0) !== payload.garden_ids.length) {
          return fail("המפקח אושר, אך שיוך הגנים לא נשמר במלואו. יש להשלים שיוך ידנית.", 409);
        }
      }
      await admin.from("profiles" as any).update({
        active: true,
        self_service_status: "active",
        self_service_approved_at: now,
        self_service_approved_by: profile.id
      }).eq("id", application.data.profile_id);
    }

    const update = await admin.from("inspector_applications" as any).update({
      status,
      admin_decision: payload.action,
      decision_reason: payload.decision_reason ?? null,
      decided_at: ["approve", "reject", "suspend"].includes(payload.action) ? now : application.data.decided_at,
      activated_at: payload.action === "approve" ? now : application.data.activated_at,
      metadata: {
        ...(application.data.metadata ?? {}),
        assigned_regions: payload.assigned_regions ?? null,
        garden_ids: payload.garden_ids ?? []
      }
    }).eq("id", id).select("*").single();
    if (update.error) return fail(update.error.message, 400);

    await Promise.all([
      admin.from("notifications" as any).insert({
        recipient_id: application.data.profile_id,
        recipient_role: "inspector",
        title: status === "approved" ? "בקשת המפקח אושרה" : status === "rejected" ? "בקשת המפקח נדחתה" : "בקשת המפקח עודכנה",
        body: payload.decision_reason ?? "סטטוס הבקשה שלך עודכן.",
        message: payload.decision_reason ?? "סטטוס הבקשה שלך עודכן.",
        entity_type: "inspector_applications",
        entity_id: id,
        severity: "low",
        action_url: "/dashboard/inspector/apply",
        recipient_profile_id: application.data.profile_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: "admin",
        entity_type: "inspector_applications",
        entity_id: id,
        action: `inspector_application_${payload.action}`,
        before_data: { status: application.data.status },
        after_data: { status, garden_ids: payload.garden_ids ?? [] }
      })
    ]);

    return ok({ application: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
