import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { unregisterPushDevice } from "@/lib/domain/push-service";
import { z } from "zod";

const logoutBody = z.object({ observer_push_device_id: z.string().uuid().optional() }).strict();

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (rawBody.length > 256) return NextResponse.json({ error: "INVALID_LOGOUT_REQUEST" }, { status: 413 });
  let parsed: unknown = {};
  if (rawBody) {
    try { parsed = JSON.parse(rawBody); }
    catch { return NextResponse.json({ error: "INVALID_LOGOUT_REQUEST" }, { status: 400 }); }
  }
  const body = logoutBody.safeParse(parsed);
  if (!body.success) return NextResponse.json({ error: "INVALID_LOGOUT_REQUEST" }, { status: 400 });
  const supabase = await createClient();
  if (body.data.observer_push_device_id) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "SESSION_REQUIRED" }, { status: 401 });
    const revoked = await unregisterPushDevice(supabase as unknown as Parameters<typeof unregisterPushDevice>[0], user.id, null, body.data.observer_push_device_id);
    if (!revoked.ok) return NextResponse.json({ error: "PUSH_REVOCATION_FAILED" }, { status: 503 });
  }
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) return NextResponse.json({ error: "LOGOUT_FAILED" }, { status: 503 });
  return NextResponse.json({ ok: true });
}

export function GET() {
  return NextResponse.json({ error: "POST_REQUIRED" }, { status: 405, headers: { Allow: "POST" } });
}
