import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["change_clothes", "parent_request_status"]),
  has_change_clothes: z.boolean().optional(),
  change_clothes_notes: z.string().optional(),
  request_id: z.string().uuid().optional(),
  status: z.enum(["new", "viewed", "in_progress", "handled", "rejected"]).optional(),
  manager_response: z.string().optional()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const { profile } = await requireRole(["manager", "owner", "staff"]);
    const supabase = await createClient();
    const child = await supabase.from("children" as any).select("id, garden_id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("id", id).maybeSingle();
    if (child.error || !child.data || (child.data as any).garden_id !== profile.garden_id) return fail("אין הרשאה לעדכן ילד שאינו משויך לגן שלך.", 403);

    if (payload.action === "change_clothes") {
      const patch = {
        has_change_clothes: payload.has_change_clothes ?? false,
        change_clothes_notes: payload.change_clothes_notes ?? null,
        last_change_clothes_check: new Date().toISOString().slice(0, 10)
      };
      const updated = await supabase.from("children" as any).update(patch).eq("id", id).select("id").single();
      if (updated.error) return fail("לא ניתן לעדכן סטטוס בגדים להחלפה כרגע.", 500);
      const parentProfileId = (child.data as any).parents?.profile_id;
      if (parentProfileId && payload.has_change_clothes === false) {
        await supabase.from("notifications" as any).insert({
          garden_id: profile.garden_id,
          recipient_id: parentProfileId,
          recipient_role: "parent",
          title: "נא להביא בגדים להחלפה",
          body: `${(child.data as any).full_name}: חסרים בגדים להחלפה. ${payload.change_clothes_notes ?? ""}`,
          entity_type: "child_change_clothes",
          entity_id: id,
          status: "pending",
          metadata: { updated_by: profile.id, child_id: id }
        });
      }
      await supabase.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        performed_by_user: profile.id,
        performed_by_role: profile.role,
        garden_id: profile.garden_id,
        entity_type: "children",
        entity_id: id,
        action: "update_change_clothes",
        after_data: patch
      });
      return ok(patch);
    }

    if (!payload.request_id || !payload.status) return fail("חסרים פרטי בקשת הורה.", 422);
    const patch = {
      status: payload.status,
      manager_response: payload.manager_response ?? null,
      response_text: payload.manager_response ?? null,
      handled_by: ["handled", "rejected"].includes(payload.status) ? profile.id : null,
      handled_at: ["handled", "rejected"].includes(payload.status) ? new Date().toISOString() : null,
      viewed_at: ["viewed", "in_progress", "handled", "rejected"].includes(payload.status) ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };
    const updated = await supabase.from("parent_child_requests" as any).update(patch).eq("id", payload.request_id).eq("garden_id", profile.garden_id).select("*").single();
    if (updated.error) return fail("לא ניתן לעדכן בקשת הורה כרגע.", 500);
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "parent_child_requests",
      entity_id: payload.request_id,
      action: "update_parent_request_status",
      after_data: patch
    });
    return ok(updated.data);
  } catch (error) {
    return handleRouteError(error);
  }
}
