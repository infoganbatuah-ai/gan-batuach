import { NextResponse } from "next/server";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { formatCostCsv, loadCostIntelligence } from "@/lib/domain/digital-observer/cost-intelligence-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session || !hasObserverAdminClaim(session.user.app_metadata)) return fail("Cost administration requires platform authorization.", 403);
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenant"), siteId = url.searchParams.get("site"), sourceId = url.searchParams.get("camera");
    if ([tenantId, siteId, sourceId].some(value => value && !uuid.test(value))) return fail("Invalid cost attribution filter.", 400);
    const result = await loadCostIntelligence({ tenantId, siteId, sourceId, resourceType: url.searchParams.get("resource"), from: url.searchParams.get("from"), to: url.searchParams.get("to") });
    if (url.searchParams.get("format") === "csv") return new NextResponse(formatCostCsv(result.events), { headers: { "Cache-Control": "private, no-store", "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=observer-operational-costs.csv" } });
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
