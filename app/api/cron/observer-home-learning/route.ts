import { NextResponse } from "next/server";
import { sampleConsentedHomeLearning } from "@/lib/domain/digital-observer/home-learning-sampler";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const results = await sampleConsentedHomeLearning(createAdminClient() as any);
  return NextResponse.json({ ok: true, sampled_at: new Date().toISOString(), results, raw_video_received: false });
}
