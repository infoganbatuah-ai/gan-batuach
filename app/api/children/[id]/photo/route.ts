import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ photo_url: z.string().url(), field: z.enum(["photo_url", "face_image_url"]).default("photo_url") });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["parent", "manager", "owner", "staff"]);
    const { id } = await context.params;
    const payload = schema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();
    const { data: child, error: childError } = await supabase.from("children" as any).select("id, garden_id, primary_parent_id").eq("id", id).maybeSingle();
    if (childError || !child) return fail("לא נמצא כרטיס ילד", 404);
    let allowed = false;
    if (["manager", "owner", "staff"].includes(profile.role)) allowed = profile.garden_id === child.garden_id;
    if (profile.role === "parent") {
      const { data: parentByProfile } = await supabase.from("parents" as any).select("id").eq("profile_id", profile.id).maybeSingle();
      const { data: parentByUser } = parentByProfile ? { data: null } : await supabase.from("parents" as any).select("id").eq("user_id", profile.id).maybeSingle();
      const parentId = parentByProfile?.id ?? parentByUser?.id;
      allowed = Boolean(parentId && parentId === child.primary_parent_id);
    }
    if (!allowed) return fail("אין הרשאה לעדכן תמונת ילד", 403);
    const { data, error } = await supabase.from("children" as any).update({ [payload.field]: payload.photo_url }).eq("id", id).select("id, full_name, photo_url, face_image_url").single();
    if (error) return fail("שמירת תמונת הילד נכשלה", 400);
    await supabase.from("audit_logs" as any).insert({ actor_id: profile.id, actor_role: profile.role, garden_id: child.garden_id, entity_type: "children", entity_id: id, action: "update_child_photo", after_data: { field: payload.field } });
    return ok({ child: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
