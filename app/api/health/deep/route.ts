import { NextResponse } from "next/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const tables = ["profiles", "gardens", "children", "parents", "staff", "camera_streams", "notifications"];

function isAuthorized(request: Request) {
  const configuredSecret = process.env.HEALTHCHECK_SECRET;
  const providedSecret = request.headers.get("x-health-secret");
  return Boolean(configuredSecret && providedSecret && configuredSecret === providedSecret);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  if (!isAdminClientConfigured()) {
    return NextResponse.json({
      ok: false,
      status: "degraded",
      supabase: "missing_service_role",
      timestamp: new Date().toISOString()
    }, { status: 503 });
  }

  const supabase = createAdminClient();
  const checks = await Promise.all(tables.map(async (table) => {
    try {
      const { count, error } = await supabase.from(table as any).select("id", { count: "exact", head: true }).limit(1);
      return { table, ok: !error, count: count ?? null, error: error?.message ?? null };
    } catch (error) {
      return { table, ok: false, count: null, error: error instanceof Error ? error.message : "Unknown error" };
    }
  }));
  const ok = checks.every((check) => check.ok);

  return NextResponse.json({
    ok,
    status: ok ? "ok" : "degraded",
    checks,
    timestamp: new Date().toISOString()
  }, { status: ok ? 200 : 503 });
}
