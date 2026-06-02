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
  let actionContext: Record<string, unknown> = { action: "child_operation" };
  try {
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const { profile } = await requireRole(["manager", "owner", "staff"]);
    actionContext = { action: payload.action, entity_id: id, user_id: profile.id, user_role: profile.role, garden_id: profile.garden_id, new_status: payload.status };
    const supabase = await createClient();
    const child = await supabase.from("children" as any).select("id, garden_id, full_name, primary_parent_id, parents:primary_parent_id(profile_id)").eq("id", id).maybeSingle();
    if (child.error || !child.data || (child.data as any).garden_id !== profile.garden_id) {
      console.error("[child-operation] permission/lookup failed", { ...actionContext, error: child.error?.message, found: Boolean(child.data) });
      return fail("אין הרשאה לעדכן ילד שאינו משויך לגן שלך.", 403);
    }

    if (payload.action === "change_clothes") {
      const patch = {
        has_change_clothes: payload.has_change_clothes ?? false,
        change_clothes_notes: payload.change_clothes_notes ?? null,
        last_change_clothes_check: new Date().toISOString().slice(0, 10)
      };
      const updated = await supabase.from("children" as any).update(patch).eq("id", id).select("id").single();
      if (updated.error) {
        console.error("[child-operation] change clothes update failed", { ...actionContext, error: updated.error.message });
        return fail("לא ניתן לעדכן סטטוס בגדים להחלפה כרגע.", 500);
      }
      const parentProfileId = (child.data as any).parents?.profile_id;
      if (parentProfileId && payload.has_change_clothes === false) {
        const notificationResult = await supabase.from("notifications" as any).insert({
          garden_id: profile.garden_id,
          recipient_id: parentProfileId,
          recipient_profile_id: parentProfileId,
          recipient_role: "parent",
          title: "נא להביא בגדים להחלפה",
          body: `${(child.data as any).full_name}: חסרים בגדים להחלפה. ${payload.change_clothes_notes ?? ""}`,
          message: `${(child.data as any).full_name}: חסרים בגדים להחלפה. ${payload.change_clothes_notes ?? ""}`,
          entity_type: "child_change_clothes",
          entity_id: id,
          child_id: id,
          status: "pending",
          action_url: `/dashboard/parent/children/${id}`,
          metadata: { href: `/dashboard/parent/children/${id}`, updated_by: profile.id, child_id: id }
        });
        if (notificationResult.error) {
          console.error("[child-operation] change clothes notification failed", { ...actionContext, parent_profile_id: parentProfileId, error: notificationResult.error.message });
          return fail("סטטוס בגדים נשמר, אך ההתראה להורה לא נשלחה.", 409, { child_id: id });
        }
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
      console.info("[child-operation] change clothes completed", actionContext);
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
    if (updated.error) {
      console.error("[child-operation] parent request update failed", { ...actionContext, request_id: payload.request_id, error: updated.error.message });
      return fail("לא ניתן לעדכן בקשת הורה כרגע.", 500);
    }
    const parentProfileId = (updated.data as any)?.parent_profile_id;
    if (parentProfileId && ["in_progress", "handled", "rejected"].includes(payload.status)) {
      const statusText = payload.status === "handled" ? "הבקשה שלך טופלה" : payload.status === "rejected" ? "הבקשה שלך נדחתה" : "הבקשה שלך בטיפול";
      const notificationResult = await supabase.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: parentProfileId,
        recipient_profile_id: parentProfileId,
        recipient_role: "parent",
        title: "עדכון פנייה מהגן",
        body: payload.manager_response ? `${statusText}: ${payload.manager_response}` : statusText,
        message: payload.manager_response ? `${statusText}: ${payload.manager_response}` : statusText,
        entity_type: "parent_child_requests",
        entity_id: payload.request_id,
        child_id: id,
        status: "pending",
        severity: payload.status === "rejected" ? "medium" : "low",
        action_url: "/dashboard/parent/messages",
        created_by: profile.id,
        metadata: { href: "/dashboard/parent/messages", request_id: payload.request_id, child_id: id, status: payload.status }
      });
      if (notificationResult.error) {
        console.error("[child-operation] parent request notification failed", { ...actionContext, request_id: payload.request_id, parent_profile_id: parentProfileId, error: notificationResult.error.message });
        return fail("הפנייה עודכנה, אך ההתראה להורה לא נשלחה.", 409, { request_id: payload.request_id });
      }
    }
    await supabase.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: profile.role,
      garden_id: profile.garden_id,
      entity_type: "parent_child_requests",
      entity_id: payload.request_id,
      action: "update_parent_request_status",
      after_data: patch
    });
    console.info("[child-operation] parent request completed", { ...actionContext, request_id: payload.request_id });
    return ok(updated.data);
  } catch (error) {
    console.error("[child-operation] unhandled failure", { ...actionContext, error });
    return handleRouteError(error);
  }
}
