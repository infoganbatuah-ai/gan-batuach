import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL(request.url);
  const requested = url.searchParams.get("redirectTo");
  const destination = requested?.startsWith("/digital-observer") && !requested.startsWith("//")
    ? requested
    : "/login";
  return NextResponse.redirect(new URL(destination, request.url));
}
