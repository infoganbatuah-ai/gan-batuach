import { NextResponse } from "next/server";
import { fail, handleSafeRouteError } from "@/lib/api";
import { hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { loadDigitalObserverOperationalTelemetry, safeOperationalSnapshot } from "@/lib/domain/digital-observer/operational-telemetry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session) return fail("נדרשת התחברות מחדש לתצפיתן הדיגיטלי.", 401);
    if (!hasObserverAdminClaim(session.user.app_metadata)) return fail("נדרשת הרשאת ניהול תצפיתן.", 403);
    const snapshot = safeOperationalSnapshot(await loadDigitalObserverOperationalTelemetry());
    return NextResponse.json({ data: snapshot }, { headers: { "Cache-Control": "private, no-store, max-age=0" } });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
