import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("escalate_overdue_complaints" as never, { p_limit: 100 } as never);
  if (error) return NextResponse.json({ error: "Escalation scan unavailable" }, { status: 503 });
  return NextResponse.json({ data: { escalated: data } });
}
