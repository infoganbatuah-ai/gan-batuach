import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createClient } from "@/lib/supabase/server";

const ageBounds = z.object({
  age_group_key: z.string().trim().min(1).max(80),
  age_group_label: z.string().trim().max(120).optional().nullable(),
  min_age_months: z.number().int().min(0).max(240).optional().nullable(),
  max_age_months: z.number().int().min(0).max(240).optional().nullable()
}).refine((value) => value.min_age_months == null || value.max_age_months == null || value.max_age_months >= value.min_age_months, "טווח הגיל אינו תקין");

const createSchema = ageBounds.extend({ name: z.string().trim().min(1).max(120), sort_order: z.number().int().min(0).max(10000).optional() });
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("update"), classroom_id: z.string().uuid(), name: z.string().trim().min(1).max(120).optional(), age_group_key: z.string().trim().min(1).max(80).optional(), age_group_label: z.string().trim().max(120).optional().nullable(), min_age_months: z.number().int().min(0).max(240).optional().nullable(), max_age_months: z.number().int().min(0).max(240).optional().nullable(), sort_order: z.number().int().min(0).max(10000).optional() }),
  z.object({ action: z.literal("deactivate"), classroom_id: z.string().uuid() }),
  z.object({ action: z.literal("assign_child"), classroom_id: z.string().uuid(), child_id: z.string().uuid(), enrollment_id: z.string().uuid().optional().nullable() }),
  z.object({ action: z.literal("assign_staff"), classroom_id: z.string().uuid(), staff_id: z.string().uuid(), employment_id: z.string().uuid().optional().nullable(), responsibility: z.enum(["staff","lead_teacher","assistant","support"]).optional() }),
  z.object({ action: z.literal("unassign_staff"), assignment_id: z.string().uuid() })
]);

export async function GET() {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const supabase = await createClient();
    const { data, error } = await supabase.from("classrooms" as never).select("*, child_classroom_assignments(id,child_id,is_current), staff_classroom_assignments(id,staff_id,status,responsibility)").eq("garden_id", access.gardenId).order("sort_order").order("name");
    if (error) return fail("לא ניתן לטעון את הכיתות", 503);
    return ok({ classrooms: data ?? [], garden_id: access.gardenId });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const payload = createSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("classrooms" as never).insert({ ...payload, garden_id: access.gardenId, created_by: access.session.profile.id, updated_by: access.session.profile.id, source: "management" } as never).select("*").single();
    if (error) return fail(error.code === "23505" ? "כבר קיימת כיתה בשם הזה בגן" : "לא ניתן ליצור את הכיתה", 409);
    await writeAdminActionEvent({ eventType: "classroom_created", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "classroom", targetId: (data as unknown as { id: string }).id, gardenId: access.gardenId, riskLevel: "low" });
    return ok(data, 201);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function PATCH(request: Request) {
  try {
    const access = await getManagementGardenContext();
    if (!access.allowed) return access.response;
    const payload = mutationSchema.parse(await request.json());
    const supabase = await createClient();
    if (payload.action === "assign_child") {
      const result = await supabase.rpc("assign_child_to_classroom" as never, { target_child_id: payload.child_id, target_classroom_id: payload.classroom_id, target_enrollment_id: payload.enrollment_id ?? null } as never);
      if (result.error) return fail("לא ניתן לשייך את הילד לכיתה בגן זה", result.error.code === "42501" ? 403 : 409);
      await writeAdminActionEvent({ eventType: "child_classroom_assigned", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "child", targetId: payload.child_id, gardenId: access.gardenId, riskLevel: "low" });
      return ok(result.data);
    }
    if (payload.action === "assign_staff") {
      const result = await supabase.rpc("assign_staff_to_classroom" as never, { target_staff_id: payload.staff_id, target_classroom_id: payload.classroom_id, target_employment_id: payload.employment_id ?? null, target_responsibility: payload.responsibility ?? "staff" } as never);
      if (result.error) return fail("לא ניתן לשייך את איש הצוות לכיתה בגן זה", result.error.code === "42501" ? 403 : 409);
      await writeAdminActionEvent({ eventType: "staff_classroom_assigned", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "staff", targetId: payload.staff_id, gardenId: access.gardenId, riskLevel: "low" });
      return ok(result.data);
    }
    if (payload.action === "unassign_staff") {
      const result = await supabase.from("staff_classroom_assignments" as never).update({ status: "inactive", ended_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", payload.assignment_id).eq("garden_id", access.gardenId).select("id").maybeSingle();
      if (result.error || !result.data) return fail("שיוך הצוות לא נמצא בגן", 404);
      await writeAdminActionEvent({ eventType: "staff_classroom_unassigned", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "staff_classroom_assignment", targetId: payload.assignment_id, gardenId: access.gardenId, riskLevel: "low" });
      return ok(result.data);
    }
    const existing = await supabase.from("classrooms" as never).select("id").eq("id", payload.classroom_id).eq("garden_id", access.gardenId).maybeSingle();
    if (!existing.data) return fail("הכיתה לא נמצאה בגן שנבחר", 404);
    if (payload.action === "deactivate") {
      const current = await supabase.from("child_classroom_assignments" as never).select("id", { count: "exact", head: true }).eq("classroom_id", payload.classroom_id).eq("garden_id", access.gardenId).eq("is_current", true);
      if ((current.count ?? 0) > 0) return fail("יש להעביר את הילדים הפעילים לפני השבתת הכיתה", 409);
      const result = await supabase.from("classrooms" as never).update({ status: "inactive", updated_by: access.session.profile.id, updated_at: new Date().toISOString() } as never).eq("id", payload.classroom_id).eq("garden_id", access.gardenId).select("*").single();
      if (result.error) return fail("לא ניתן להשבית את הכיתה", 409);
      await writeAdminActionEvent({ eventType: "classroom_deactivated", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "classroom", targetId: payload.classroom_id, gardenId: access.gardenId, riskLevel: "low" });
      return ok(result.data);
    }
    const changes = Object.fromEntries(Object.entries(payload).filter(([key]) => !["action", "classroom_id"].includes(key)));
    if (changes.min_age_months != null && changes.max_age_months != null && changes.max_age_months < changes.min_age_months) return fail("טווח הגיל אינו תקין", 422);
    const result = await supabase.from("classrooms" as never).update({ ...changes, updated_by: access.session.profile.id, updated_at: new Date().toISOString() } as never).eq("id", payload.classroom_id).eq("garden_id", access.gardenId).select("*").single();
    if (result.error) return fail("לא ניתן לעדכן את הכיתה", 409);
    await writeAdminActionEvent({ eventType: "classroom_updated", actorProfileId: access.session.profile.id, actorRole: access.session.profile.role, targetType: "classroom", targetId: payload.classroom_id, gardenId: access.gardenId, riskLevel: "low" });
    return ok(result.data);
  } catch (error) { return handleSafeRouteError(error); }
}
