import { cookies } from "next/headers";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { resolveStaffEmploymentContext, STAFF_GARDEN_COOKIE } from "@/lib/management/staff-employment-context";
import { createClient } from "@/lib/supabase/server";

async function staffSession() {
  const session = await getSessionProfile();
  return session.user?.id === session.profile?.id && session.profile?.role === "staff" && session.profile.active
    ? session : null;
}

export async function GET() {
  try {
    const session = await staffSession();
    if (!session) return fail("נדרשת התחברות צוות.", 401);
    const context = await resolveStaffEmploymentContext(session.profile);
    if (!context.available) return fail("בדיקת העסקה אינה זמינה כרגע.", 503);
    return ok({ employments: context.employments, active_garden_id: context.activeEmployment?.garden_id ?? null });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await staffSession();
    if (!session) return fail("נדרשת התחברות צוות.", 401);
    const { garden_id: gardenId } = z.object({ garden_id: z.string().uuid() }).parse(await request.json());
    const context = await resolveStaffEmploymentContext(session.profile);
    if (!context.available) return fail("בדיקת העסקה אינה זמינה כרגע.", 503);
    if (!context.employments.some(item => item.garden_id === gardenId)) return fail("אין העסקה פעילה בגן המבוקש.", 403);
    const supabase = await createClient();
    const authority = await supabase.rpc("can_staff_access_garden", { target_garden_id: gardenId });
    if (authority.error) return fail("בדיקת העסקה אינה זמינה כרגע.", 503);
    if (authority.data !== true) return fail("אין העסקה פעילה בגן המבוקש.", 403);
    (await cookies()).set(STAFF_GARDEN_COOKIE, gardenId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365
    });
    return ok({ active_garden_id: gardenId });
  } catch (error) { return handleSafeRouteError(error); }
}
