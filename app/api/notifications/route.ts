import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { profile } = await requireUser();
    const supabase = await createClient();
    const query = supabase
      .from("notifications" as any)
      .select("id,garden_id,child_id,source_domain,notification_type,preference_category,title,body,action_url,entity_type,entity_id,status,severity,read_at,archived_at,created_at")
      .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data, error } = await query;
    if (error) {
      console.error("[notifications-list]", { user_id: profile.id, role: profile.role, error: error.message });
      return ok({ rows: [], unread: 0, warning: "חלק מההתראות לא נטענו" });
    }
    const rows = data ?? [];
    const count = await supabase.from("notifications" as any).select("id", { count: "exact", head: true })
      .or(`recipient_id.eq.${profile.id},recipient_profile_id.eq.${profile.id}`)
      .is("read_at", null).is("archived_at", null);
    if (count.error) return fail("לא ניתן לטעון מונה התראות כרגע", 500);
    return ok({ rows, unread: count.count ?? 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}
