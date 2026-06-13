import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scanPermitExpirations } from "@/lib/domain/permit-expiry";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const result = await scanPermitExpirations(supabase as any);
  return NextResponse.json({ data: result });
}
