import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({ status: z.enum(["active", "rejected", "request_missing_details", "pending_manager_approval"]), reason: z.string().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    if (!isAdminClientConfigured()) return fail("אישור ילד דורש הגדרת SUPABASE_SERVICE_ROLE_KEY בשרת.", 503);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    const patch: Record<string, unknown> = { status: payload.status };
    if (payload.status === "active") patch.manager_approved_at = new Date().toISOString();
    if (payload.reason) patch.approval_notes = payload.reason;
    const { data: child, error } = await supabase.from("children" as any).update(patch).eq("id", id).eq("garden_id", profile.garden_id).select("*").single();
    if (error) return fail(error.message, 400);
    await writeUserCreationAudit({ actorId: profile.id, actorRole: profile.role, gardenId: profile.garden_id, entityType: "children", entityId: id, action: `child_registration_${payload.status}`, afterData: { child_id: id, status: payload.status, reason: payload.reason ?? null } });
    if (child.primary_parent_id) {
      const { data: parent } = await supabase.from("parents" as any).select("profile_id").eq("id", child.primary_parent_id).maybeSingle();
      if (parent?.profile_id) await supabase.from("notifications" as any).insert({ garden_id: profile.garden_id, recipient_id: parent.profile_id, recipient_role: "parent", title: "עדכון רישום ילד", body: payload.status === "active" ? "כרטיס הילד אושר על ידי הגן" : payload.reason ?? "עודכן סטטוס רישום הילד", entity_type: "children", entity_id: id, severity: payload.status === "active" ? "low" : "medium" });
    }
    return ok({ child });
  } catch (error) {
    return handleRouteError(error);
  }
}
