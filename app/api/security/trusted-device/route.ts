import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { firstForwardedIp } from "@/lib/security/audit-log-service";
import { recordTrustedDevice } from "@/lib/security/identity-security";

const schema = z.object({
  device_name: z.string().max(120).optional(),
  platform: z.string().max(80).optional()
});

export async function POST(request: Request) {
  const { profile } = await requireUser();
  const payload = schema.parse(await request.json().catch(() => ({})));
  const supabase = await createClient();
  const device = await recordTrustedDevice(supabase, {
    profileId: profile.id,
    role: profile.role,
    ip: firstForwardedIp(request.headers),
    userAgent: request.headers.get("user-agent"),
    acceptLanguage: request.headers.get("accept-language"),
    platform: payload.platform ?? null,
    deviceName: payload.device_name ?? null
  });
  return NextResponse.json({
    data: {
      id: device.id,
      device_name: device.device_name ?? device.device_label,
      risk_status: device.risk_status ?? device.trust_status,
      last_seen_at: device.last_seen_at
    }
  }, { status: 201 });
}
