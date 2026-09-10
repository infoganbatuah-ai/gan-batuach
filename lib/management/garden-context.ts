import { fail } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Management operational context. A selected garden is not an access grant.
 * Delegate to the same database authority used by RLS, using the actor's
 * session (never a service-role client). Keep target-record checks in callers.
 */
export async function getManagementGardenContext() {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile || session.user.id !== session.profile.id) {
      return { allowed: false as const, response: fail("נדרשת התחברות מחדש.", 401) };
    }
    const { profile } = session;
    if (!["manager", "owner"].includes(profile.role) || profile.active !== true) {
      return { allowed: false as const, response: fail("אין הרשאה לפעול בניהול הגן.", 403) };
    }
    const gardenId = profile.garden_id;
    if (typeof gardenId !== "string" || !gardenId) {
      return { allowed: false as const, response: fail("לא נמצא גן משויך למשתמש.", 403) };
    }

    const supabase = await createClient();
    const decision = await supabase.rpc("can_manage_garden", { target_garden_id: gardenId });
    if (decision.error) {
      return { allowed: false as const, response: fail("בדיקת הרשאות הגן אינה זמינה כרגע.", 503) };
    }
    if (decision.data !== true) {
      return { allowed: false as const, response: fail("אין הרשאה לפעול בגן שנבחר.", 403) };
    }
    return { allowed: true as const, session, gardenId };
  } catch {
    // Do not expose database/auth errors or proceed on an unavailable authority.
    return { allowed: false as const, response: fail("בדיקת הרשאות הגן אינה זמינה כרגע.", 503) };
  }
}
