import { fail, handleRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canReadSkeletonJournal, searchSkeletonJournal } from "@/lib/domain/observer-engine/skeleton-journal";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { user, profile } = await getSessionProfile();
    if (!user || !profile) return fail("נדרשת התחברות לגן בטוח.", 401);
    if (profile.id !== user.id || !canReadSkeletonJournal(profile)) return fail("היומן זמין רק למנהל או לבעלים הפעיל של הגן.", 403);
    const params = new URL(request.url).searchParams;
    // Reject ambiguous duplicate filters; never silently drop a requested scope.
    if ([...params.keys()].some(key => params.getAll(key).length !== 1)) return fail("מסנן מופיע יותר מפעם אחת.", 422);
    const input = Object.fromEntries(params);
    const result = await searchSkeletonJournal(await createClient(), profile, {
      ...input, ...(params.has("limit") ? { limit: Number(params.get("limit")) } : {})
    });
    return ok(result);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "SKELETON_JOURNAL_UNAVAILABLE") return fail("היומן אינו זמין כרגע. אין להסיק מכך שלא היו אירועים.", 503);
    if (code === "SKELETON_JOURNAL_FORBIDDEN" || code === "SKELETON_JOURNAL_CAMERA_FORBIDDEN") return fail("אין הרשאה ליומן או למצלמה שנבחרה.", 403);
    return handleRouteError(error);
  }
}
