import { cookies } from "next/headers";
import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { ACTIVE_GARDEN_COOKIE, resolveManagementGardenContext } from "@/lib/management/active-garden-context";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { createClient } from "@/lib/supabase/server";

const selectionSchema = z.object({ garden_id: z.string().uuid() });

async function managementSession() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile || session.user.id !== session.profile.id) return null;
  if (!session.profile.active || !["owner", "manager"].includes(session.profile.role)) return null;
  return session;
}

export async function GET() {
  try {
    const session = await managementSession();
    if (!session) return fail("נדרשת הרשאת ניהול גן.", 403);
    const context = await resolveManagementGardenContext(session.profile);
    if (!context.available) return fail("רשימת הגנים אינה זמינה כרגע.", 503);
    return ok({ gardens: context.gardens, active_garden_id: context.activeGarden?.id ?? null });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await managementSession();
    if (!session) return fail("נדרשת הרשאת ניהול גן.", 403);
    const payload = selectionSchema.parse(await request.json());
    const supabase = await createClient();
    const authority = await supabase.rpc("can_manage_garden", { target_garden_id: payload.garden_id });
    if (authority.error) return fail("בדיקת הרשאת הגן אינה זמינה כרגע.", 503);
    if (authority.data !== true) return fail("אין הרשאה לבחור בגן זה.", 403);
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_GARDEN_COOKIE, payload.garden_id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
    await writeAdminActionEvent({ eventType: "management_garden_context_switched", actorProfileId: session.profile.id, actorRole: session.profile.role, targetType: "garden", targetId: payload.garden_id, gardenId: payload.garden_id, riskLevel: "low" });
    return ok({ active_garden_id: payload.garden_id });
  } catch (error) { return handleSafeRouteError(error); }
}
