import { z } from "zod";
import { handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid().optional(),
  action: z.string().min(2),
  gps_lat: z.number(),
  gps_lng: z.number(),
  distance_meters: z.number().optional(),
  valid: z.boolean().default(false),
  status: z.string().default("recorded")
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("gps_verification_logs").insert({
      user_id: profile.id,
      user_role: profile.role,
      garden_id: payload.garden_id,
      child_id: payload.child_id ?? null,
      action: payload.action,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      distance_meters: payload.distance_meters ?? null,
      valid: payload.valid,
      status: payload.status
    }).select("*").single();
    if (error) throw new Error(error.message);
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
