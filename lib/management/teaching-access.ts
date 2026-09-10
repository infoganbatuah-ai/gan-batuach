import { fail } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

export type TeachingScope = "children" | "attendance" | "journal" | "communication";

/** Managers keep their management authority. Staff teaching actions additionally
 * require an active, narrow teaching assignment in the same garden. */
export async function requireStaffTeachingScope(profile: { role: string; garden_id?: string | null }, scope: TeachingScope) {
  if (profile.role !== "staff") return { allowed: true as const };
  if (!profile.garden_id) return { allowed: false as const, response: fail("לא נמצא גן משויך למשתמש.", 403) };
  try {
    const supabase = await createClient();
    const decision = await supabase.rpc("can_teach_in_garden", { target_garden_id: profile.garden_id, required_scope: scope });
    if (decision.error) return { allowed: false as const, response: fail("בדיקת הרשאת ההוראה אינה זמינה כרגע.", 503) };
    if (decision.data !== true) return { allowed: false as const, response: fail("נדרשת הקצאת הוראה פעילה לביצוע פעולה זו.", 403) };
    return { allowed: true as const };
  } catch {
    return { allowed: false as const, response: fail("בדיקת הרשאת ההוראה אינה זמינה כרגע.", 503) };
  }
}
