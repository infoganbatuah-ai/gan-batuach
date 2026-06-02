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
    const profile = permission.session.profile;
    const staffLookup = await supabase.from("staff" as any).select("id, profile_id, garden_id").eq("id", payload.staff_id).maybeSingle();
    if (staffLookup.error || !staffLookup.data) {
      console.error("[staff-gps-attendance] staff lookup failed", { staff_id: payload.staff_id, error: staffLookup.error?.message });
      return fail("לא נמצא איש צוות להחתמה.", 404);
    }
    const staff = staffLookup.data as any;
    const canWrite =
      profile.role === "admin" ||
      (staff.profile_id === profile.id && staff.garden_id === payload.garden_id) ||
      (["manager", "owner"].includes(profile.role) && profile.garden_id === payload.garden_id);
    if (!canWrite) return fail("אין הרשאה להחתים איש צוות שאינו משויך אליך.", 403);
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
