import { NextResponse } from "next/server";
import { z } from "zod";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getDigitalObserverApiUser, getObserverSiteAccess } from "@/lib/domain/digital-observer/access";
import { loadCameraHealthSnapshot } from "@/lib/domain/digital-observer/camera-health-data";

export const runtime = "nodejs"; export const dynamic = "force-dynamic";
const query = z.object({ site: z.string().uuid() }).strict();
export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request); if (!session) return fail("נדרשת התחברות מחדש.", 401);
    const input = query.parse(Object.fromEntries(new URL(request.url).searchParams));
    const site = await getObserverSiteAccess(session.supabase, session.profile, input.site); if (!site) return fail("אין הרשאה לצפות בבריאות אתר זה.", 403);
    return NextResponse.json({ data: await loadCameraHealthSnapshot(input.site) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return handleSafeRouteError(error); }
}
