import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { z } from "zod";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("activate_owner_teacher") }),
  z.object({ action: z.literal("delegate_teacher"), staff_id: z.string().uuid(), title: z.string().trim().min(2).max(80).default("גננת") }),
  z.object({ action: z.enum(["suspend", "revoke", "reactivate"]), assignment_id: z.string().uuid() })
]);

type GardenRow = { id: string; owner_profile_id: string | null; ownership_type: string };
type StaffRow = { id: string; profile_id: string | null; approved_to_work: boolean; onboarding_status: string | null };

export async function GET() {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    if (!isAdminClientConfigured()) return fail("שירות ניהול ההקצאות אינו זמין כרגע.", 503);
    const admin = createAdminClient();
    const [{ data: garden, error: gardenError }, { data: assignments, error: assignmentsError }] = await Promise.all([
      admin.from("gardens" as never).select("id, owner_profile_id, ownership_type").eq("id", access.gardenId).maybeSingle(),
      admin.from("garden_teaching_assignments" as never).select("id, garden_id, profile_id, staff_id, assignment_kind, title, access_scope, status, granted_at, revoked_at").eq("garden_id", access.gardenId).order("created_at")
    ]);
    if (gardenError || assignmentsError || !garden) return fail("לא ניתן לטעון כרגע את הקצאות ההוראה.", 503);
    return ok({ garden, assignments: assignments ?? [] });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    if (!isAdminClientConfigured()) return fail("שירות ניהול ההקצאות אינו זמין כרגע.", 503);
    const payload = mutationSchema.parse(await request.json());
    const admin = createAdminClient();
    const { data: garden, error: gardenError } = await admin
      .from("gardens" as never).select("id, owner_profile_id, ownership_type").eq("id", access.gardenId).maybeSingle() as unknown as { data: GardenRow | null; error: unknown };
    if (gardenError || !garden) return fail("הגן לא נמצא.", 404);

    let assignmentId: string | null = null;
    let eventType = "teaching_assignment_updated";

    if (payload.action === "activate_owner_teacher") {
      if (access.session.profile.role !== "owner" || garden.owner_profile_id !== access.session.profile.id || garden.ownership_type !== "teacher_is_owner") {
        return fail("הפעלת בעלים כגננת זמינה רק לבעלי הגן כאשר הגן מוגדר כבעלים שהוא גם גננת.", 403);
      }
      const { data, error } = await admin.from("garden_teaching_assignments" as never).upsert({
        garden_id: access.gardenId,
        profile_id: access.session.profile.id,
        staff_id: null,
        assignment_kind: "owner_teacher",
        title: garden.ownership_type === "teacher_is_owner" ? "בעלים וגננת" : "גננת",
        access_scope: { children: true, attendance: true, journal: true, communication: true },
        status: "active",
        granted_by: access.session.profile.id,
        granted_at: new Date().toISOString(),
        revoked_by: null,
        revoked_at: null
      }, { onConflict: "garden_id,profile_id" }).select("id").single() as unknown as { data: { id: string } | null; error: { message?: string } | null };
      if (error || !data) return fail("לא ניתן להפעיל את תפקיד הגננת.", 409);
      assignmentId = data.id;
      eventType = "owner_teacher_activated";
    } else if (payload.action === "delegate_teacher") {
      const { data: staff, error: staffError } = await admin.from("staff" as never)
        .select("id, profile_id, approved_to_work, onboarding_status")
        .eq("id", payload.staff_id).eq("garden_id", access.gardenId).maybeSingle() as unknown as { data: StaffRow | null; error: unknown };
      if (staffError || !staff?.profile_id) return fail("איש הצוות לא נמצא בגן.", 404);
      if (!staff.approved_to_work || staff.onboarding_status !== "active") return fail("אפשר להאציל הוראה רק לאיש צוות מאושר ופעיל.", 409);
      const { data: employment } = await admin.from("staff_kindergarten_employments" as never).select("id")
        .eq("staff_id", staff.id).eq("profile_id", staff.profile_id).eq("garden_id", access.gardenId).eq("status", "active").limit(1).maybeSingle() as unknown as { data: { id: string } | null };
      if (!employment) return fail("לא נמצאה העסקה פעילה של איש הצוות בגן.", 409);
      const { data, error } = await admin.from("garden_teaching_assignments" as never).upsert({
        garden_id: access.gardenId,
        profile_id: staff.profile_id,
        staff_id: staff.id,
        assignment_kind: "delegated_teacher",
        title: payload.title,
        access_scope: { children: true, attendance: true, journal: true, communication: true },
        status: "active",
        granted_by: access.session.profile.id,
        granted_at: new Date().toISOString(),
        revoked_by: null,
        revoked_at: null
      }, { onConflict: "garden_id,profile_id" }).select("id").single() as unknown as { data: { id: string } | null; error: { message?: string } | null };
      if (error || !data) return fail("לא ניתן לשמור את האצלת ההוראה.", 409);
      assignmentId = data.id;
      eventType = "delegated_teacher_activated";
    } else {
      const { data: existing } = await admin.from("garden_teaching_assignments" as never).select("id, assignment_kind")
        .eq("id", payload.assignment_id).eq("garden_id", access.gardenId).maybeSingle() as unknown as { data: { id: string; assignment_kind: string } | null };
      if (!existing) return fail("הקצאת ההוראה לא נמצאה בגן.", 404);
      if (existing.assignment_kind === "owner_teacher" && access.session.profile.id !== garden.owner_profile_id) {
        return fail("רק בעלי הגן יכולים לשנות את הקצאת הבעלים כגננת.", 403);
      }
      const nextStatus = payload.action === "reactivate" ? "active" : payload.action === "suspend" ? "suspended" : "revoked";
      const { error } = await admin.from("garden_teaching_assignments" as never).update({
        status: nextStatus,
        revoked_by: nextStatus === "active" ? null : access.session.profile.id,
        revoked_at: nextStatus === "active" ? null : new Date().toISOString()
      }).eq("id", existing.id).eq("garden_id", access.gardenId);
      if (error) return fail("לא ניתן לעדכן את הקצאת ההוראה.", 409);
      assignmentId = existing.id;
      eventType = `teaching_assignment_${payload.action}`;
    }

    await writeAdminActionEvent({
      eventType,
      actorProfileId: access.session.profile.id,
      actorRole: access.session.profile.role,
      targetType: "garden_teaching_assignment",
      targetId: assignmentId,
      gardenId: access.gardenId,
      metadata: { action: payload.action }
    });
    return ok({ id: assignmentId, action: payload.action });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
