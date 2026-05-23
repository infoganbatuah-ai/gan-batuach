import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fail, handleRouteError, ok } from "@/lib/api";
import { gpsAttendanceSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const permission = await requirePermission("attendance:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const payload = gpsAttendanceSchema.parse(await request.json());
    const supabase = await createClient();
    const timestamp = new Date().toISOString();
    const update =
      payload.action === "check_in"
        ? { actual_start: timestamp, gps_start_lat: payload.gps_lat, gps_start_lng: payload.gps_lng, start_gps_verified: true, status: "started" }
        : { actual_end: timestamp, gps_end_lat: payload.gps_lat, gps_end_lng: payload.gps_lng, end_gps_verified: true, status: "completed" };

    const { data, error } = await supabase
      .from("staff_shifts")
      .upsert(
        {
          staff_id: payload.staff_id,
          garden_id: payload.garden_id,
          shift_date: timestamp.slice(0, 10),
          ...update
        } as any,
        { onConflict: "staff_id,garden_id,shift_date" }
      )
      .select("*")
      .single();
    if (error) return fail(error.message, 400);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
