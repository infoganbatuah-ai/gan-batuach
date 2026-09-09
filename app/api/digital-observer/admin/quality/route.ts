import { NextResponse } from "next/server";
import { fail, handleSafeRouteError } from "@/lib/api";
import { getDigitalObserverApiUser } from "@/lib/domain/digital-observer/access";
import { hasObserverAdminClaim } from "@/lib/domain/digital-observer/admin-access";
import { loadCurrentQualityBenchmark } from "@/lib/domain/digital-observer/quality-benchmark-data";
import { formatBenchmarkReport } from "@/lib/domain/digital-observer/quality-benchmark";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getDigitalObserverApiUser(request);
    if (!session || !hasObserverAdminClaim(session.user.app_metadata)) return fail("Quality administration requires platform authorization.", 403);
    const url = new URL(request.url);
    const siteId = url.searchParams.get("site");
    if (siteId && !/^[0-9a-f-]{36}$/i.test(siteId)) return fail("Invalid Site filter.", 400);
    const result = await loadCurrentQualityBenchmark(createAdminClient(), { siteId });
    if (url.searchParams.get("format") === "markdown") {
      if (!result.benchmark) return fail("No reviewed benchmark is available for export.", 404);
      return new NextResponse(formatBenchmarkReport(result.benchmark), { headers: { "Cache-Control": "private, no-store", "Content-Type": "text/markdown; charset=utf-8", "Content-Disposition": `attachment; filename=observer-quality-${result.benchmark.runId}.md` } });
    }
    return NextResponse.json({ data: result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return handleSafeRouteError(error);
  }
}
