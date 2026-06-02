import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function appVersion() {
  return process.env.npm_package_version ?? "unknown";
}

export async function GET() {
  const timestamp = new Date().toISOString();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    return NextResponse.json({
      ok: false,
      status: "degraded",
      app: "ok",
      version: appVersion(),
      supabase: "missing_env",
      timestamp
    }, { status: 503 });
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/`, {
      headers: { apikey: publishableKey },
      cache: "no-store"
    });
    const supabaseOk = response.ok || response.status === 404;

    return NextResponse.json({
      ok: supabaseOk,
      status: supabaseOk ? "ok" : "degraded",
      app: "ok",
      version: appVersion(),
      supabase: supabaseOk ? "ok" : "unreachable",
      timestamp
    }, { status: supabaseOk ? 200 : 503 });
  } catch {
    return NextResponse.json({
      ok: false,
      status: "degraded",
      app: "ok",
      version: appVersion(),
      supabase: "unreachable",
      timestamp
    }, { status: 503 });
  }
}
