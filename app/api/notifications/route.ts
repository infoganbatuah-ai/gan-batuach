import { handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    let query = supabase
      .from("notifications" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);
    if (profile.role !== "admin") query = query.or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`);
    const { data, error } = await query;
    if (error) {
      console.error("[notifications-list]", { user_id: profile.id, role: profile.role, error: error.message });
      return ok({ rows: [], unread: 0, warning: "חלק מההתראות לא נטענו" });
    }
    const rows = (data ?? []) as any[];
    return ok({ rows, unread: rows.filter((row) => !row.read_at && row.status !== "read").length });
  } catch (error) {
    return handleRouteError(error);
  }
}
