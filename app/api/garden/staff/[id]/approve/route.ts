import { fail, handleRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { adminManagementContactVerification } from "@/lib/management/contact-verification";
import { z } from "zod";

const schema = z.object({
  action: z.enum(["approve", "request_correction", "suspend"]).default("approve"),
  note: z.string().optional()
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const { profile } = access.session;
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const { id } = await context.params;
    const payload = schema.parse(await request.json().catch(() => ({})));
    const supabase = createAdminClient();

    const { data: staff, error: readError } = await supabase
      .from("staff")
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .single();

    if (readError || !staff) return fail(readError?.message ?? "Staff member not found", 404);
    if (payload.action === "approve" && (staff.background_check_status !== "valid" || staff.police_clearance_status !== "valid")) {
      return fail("Cannot approve staff before background check and police clearance are valid", 422);
    }
    if (payload.action === "approve" && staff.profile_id) {
      const contact = await adminManagementContactVerification(supabase, staff.profile_id);
      if (!contact.available) return fail("לא ניתן לבדוק כרגע את אימות פרטי הקשר של איש הצוות.", 503);
      if (!contact.state.complete) return fail("יש להשלים אימות דוא״ל וטלפון לפני אישור הצוות.", 409);
    }

    const now = new Date().toISOString();
    const history = [...((staff as any).verification_history ?? []), { action: payload.action, note: payload.note ?? null, by: profile.id, at: now }];
    const patch = payload.action === "approve" ? {
      approved_to_work: true,
      onboarding_status: "active",
      manager_approved_at: now,
      activated_at: now,
      activated_by: profile.id,
      correction_note: null,
      verification_history: history
    } : payload.action === "request_correction" ? {
      approved_to_work: false,
      onboarding_status: "correction_required",
      correction_note: payload.note || "נדרשת השלמה לפני אישור",
      verification_history: history
    } : {
      approved_to_work: false,
      onboarding_status: "suspended",
      correction_note: payload.note || "החשבון הושהה",
      verification_history: history
    };

    const { data, error } = await supabase.from("staff").update(patch).eq("id", id).select("*").single();
    if (error) return fail(error.message, 400);
    const employmentStatus = payload.action === "approve" ? "active" : payload.action === "request_correction" ? "pending_approval" : "suspended";
    const employment = await supabase.from("staff_kindergarten_employments" as never)
      .update({
        status: employmentStatus,
        approved_at: payload.action === "approve" ? now : null,
        approved_by: payload.action === "approve" ? profile.id : null,
        updated_at: now
      })
      .eq("staff_id", id)
      .eq("profile_id", staff.profile_id)
      .eq("garden_id", profile.garden_id)
      .select("id") as unknown as { data: Array<{ id: string }> | null; error: { message?: string } | null };
    if (employment.error || !employment.data?.length) {
      return fail("כרטיס הצוות עודכן, אך מצב ההעסקה הקנוני לא עודכן. הגישה התפעולית תישאר חסומה עד לתיקון.", 409);
    }
    await supabase.from("staff_onboarding_records" as any).upsert({
      staff_id: id,
      profile_id: staff.profile_id,
      garden_id: profile.garden_id,
      status: patch.onboarding_status,
      progress_percent: payload.action === "approve" ? 100 : 80,
      activated_by: payload.action === "approve" ? profile.id : null,
      activated_at: payload.action === "approve" ? now : null,
      correction_note: payload.action === "approve" ? null : patch.correction_note,
      verification_history: history,
      updated_at: now
    }, { onConflict: "staff_id" });
    if (staff.profile_id) {
      await supabase.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: staff.profile_id,
        title: payload.action === "approve" ? "החשבון אושר" : payload.action === "request_correction" ? "נדרש תיקון בפרטי צוות" : "חשבון הצוות הושהה",
        body: payload.action === "approve" ? "אפשר להיכנס לממשק הצוות." : payload.note || "יש הודעה חדשה מהמנהלת.",
        entity_type: "staff",
        entity_id: id,
        severity: payload.action === "approve" ? "low" : "medium",
        metadata: { href: payload.action === "approve" ? "/dashboard/staff" : "/onboarding/staff" }
      });
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "staff",
      entityId: id,
      action: `staff_${payload.action}`,
      afterData: { staff_id: id, ...patch }
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
