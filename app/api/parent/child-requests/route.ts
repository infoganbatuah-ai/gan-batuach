import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  child_id: z.string().uuid(),
  request_type: z.string().min(2),
  content: z.string().min(3),
  reminder_at: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const parent = await supabase.from("parents" as any).select("id, garden_id").eq("profile_id", profile.id).maybeSingle();
    const child = await supabase.from("children" as any).select("id, garden_id, full_name, primary_parent_id").eq("id", payload.child_id).maybeSingle();
    if (parent.error || child.error || !parent.data || !child.data || (child.data as any).primary_parent_id !== (parent.data as any).id) {
      return fail("אין הרשאה לשלוח בקשה עבור ילד זה.", 403);
    }
    const row = {
      garden_id: (child.data as any).garden_id,
      child_id: payload.child_id,
      parent_id: (parent.data as any).id,
      parent_profile_id: profile.id,
      request_type: payload.request_type,
      content: payload.content,
      reminder_at: payload.reminder_at ?? null,
      status: "new"
    };
    const { data, error } = await supabase.from("parent_child_requests" as any).insert(row).select("*").single();
    if (error) {
      console.error("[parent-child-requests:create]", error);
      return fail("לא ניתן לשלוח את הבקשה כרגע.", 500);
    }
    const managers = await supabase.from("profiles" as any).select("id, role").eq("garden_id", (child.data as any).garden_id).in("role", ["manager", "owner"]);
    await Promise.all(((managers.data ?? []) as any[]).map((manager) => supabase.from("notifications" as any).insert({
      garden_id: (child.data as any).garden_id,
      recipient_id: manager.id,
      recipient_role: manager.role,
      title: "בקשת הורה חדשה",
      body: `${(child.data as any).full_name}: ${payload.request_type}`,
      entity_type: "parent_child_request",
      entity_id: data.id,
      status: "pending"
    })));
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
