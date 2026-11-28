import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { scopeActiveGanNotifications } from "@/lib/domain/gan-notification-visibility";

export async function GET() {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות מחדש.", 401);
    const supabase = await createClient();
    const query = scopeActiveGanNotifications(supabase
      .from("notifications")
      .select("id,garden_id,child_id,source_domain,notification_type,preference_category,title,body,action_url,entity_type,entity_id,status,severity,read_at,archived_at,created_at"), profile.id)
      .order("created_at", { ascending: false })
      .limit(30);
    const { data, error } = await query;
    if (error) {
      console.error("[notifications-list]", { user_id: profile.id, role: profile.role, error: error.message });
      return ok({ rows: [], unread: 0, warning: "חלק מההתראות לא נטענו" });
    }
    const rows = data ?? [];
    const count = await scopeActiveGanNotifications(
      supabase.from("notifications").select("id", { count: "exact", head: true }), profile.id
    ).is("read_at", null);
    if (count.error) return fail("לא ניתן לטעון מונה התראות כרגע", 500);
    return ok({ rows, unread: count.count ?? 0 });
  } catch (error) {
    return handleRouteError(error);
  }
}
