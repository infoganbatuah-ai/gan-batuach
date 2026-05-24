import { requireUser } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const { ids } = await request.json().catch(() => ({ ids: [] }));
    const supabase = await createClient();
    let query = supabase.from("notifications" as any).update({ read_at: new Date().toISOString(), status: "read" });
    if (profile.role !== "admin") query = query.eq("recipient_id", profile.id);
    if (Array.isArray(ids) && ids.length) query = query.in("id", ids);
    const { data, error } = await query.select("*");
    if (error) {
      console.error("[notifications-mark-read]", error);
      return fail("לא ניתן לסמן התראות כנקראו כרגע", 400);
    }
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}
