import { fail, handleRouteError, ok } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { gpsAttendanceSchema } from "@/lib/validation";

const THRESHOLD_MINUTES = 30;

function distanceMeters(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null) {
  if (![lat1, lng1, lat2, lng2].every((value) => Number.isFinite(Number(value)))) return null;
  const r = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(Number(lat2) - Number(lat1));
  const dLng = toRad(Number(lng2) - Number(lng1));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(Number(lat1))) * Math.cos(toRad(Number(lat2))) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function confidenceStatus(inside: boolean, accuracy?: number | null, sampleCount = 1) {
  if (!inside) return { status: "requires_review", score: 45, reason: "מחוץ לאזור הגן" };
  if (Number(accuracy ?? 999) <= 50 && sampleCount >= 3) return { status: "verified", score: 95, reason: null };
  if (Number(accuracy ?? 999) <= 120 && sampleCount >= 2) return { status: "probable", score: 78, reason: null };
  return { status: "requires_review", score: 58, reason: "דיוק מיקום נמוך או מעט דגימות" };
}

async function writeAudit(supabase: Awaited<ReturnType<typeof createClient>>, row: Record<string, any>) {
  await supabase.from("staff_workforce_audit_events" as any).insert(row);
}

export async function POST(request: Request) {
  try {
    const permission = await requirePermission("attendance:write");
    if (!permission.allowed) return fail("Forbidden", 403);
    const payload = gpsAttendanceSchema.parse(await request.json());
    const supabase = await createClient();
    const profile = permission.session.profile;
    const staffLookup = await supabase
      .from("staff" as any)
      .select("id, profile_id, garden_id, full_name")
      .eq("id", payload.staff_id)
      .maybeSingle();
    if (staffLookup.error || !staffLookup.data) {
      console.error("[staff-gps-attendance] staff lookup failed", { staff_id: payload.staff_id, error: staffLookup.error?.message });
      return fail("לא נמצא איש צוות לנוכחות.", 404);
    }
    const staff = staffLookup.data as any;
    const canWrite =
      profile.role === "admin" ||
      (staff.profile_id === profile.id && staff.garden_id === payload.garden_id) ||
      (["manager", "owner"].includes(profile.role) && profile.garden_id === payload.garden_id);
    if (!canWrite) return fail("אין הרשאה לעדכן נוכחות של איש צוות שאינו משויך אליך.", 403);

    const timestamp = payload.captured_at ? new Date(payload.captured_at) : new Date();
    const iso = timestamp.toISOString();
    const shiftDate = iso.slice(0, 10);
    const gardenRes = await supabase
      .from("gardens" as any)
      .select("id, gps_lat, gps_lng, attendance_radius_meters, workforce_auto_attendance_enabled")
      .eq("id", payload.garden_id)
      .maybeSingle();
    const garden = gardenRes.data as any;
    const radius = Number(garden?.attendance_radius_meters ?? 120);
    const distance = distanceMeters(garden?.gps_lat, garden?.gps_lng, payload.gps_lat, payload.gps_lng);
    const inside = distance !== null && distance <= radius;
    const manualAction = payload.action === "check_in" || payload.action === "check_out";

    if (!garden?.workforce_auto_attendance_enabled && !manualAction) {
      return fail("נוכחות אוטומטית אינה פעילה בגן הזה.", 400);
    }

    const sampleInsert = await supabase.from("staff_location_samples" as any).insert({
      staff_id: staff.id,
      profile_id: staff.profile_id,
      garden_id: payload.garden_id,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      gps_accuracy_meters: payload.gps_accuracy_meters ?? null,
      distance_meters: distance,
      inside_geofence: inside,
      network_reliable: payload.network_reliable ?? true,
      sample_source: manualAction ? "manager_review" : "mobile_browser",
      captured_at: iso,
      metadata: { action: payload.action, radius_meters: radius }
    }).select("*").single();
    if (sampleInsert.error) return fail(sampleInsert.error.message, 400);

    await writeAudit(supabase, {
      staff_id: staff.id,
      garden_id: payload.garden_id,
      actor_profile_id: profile.id,
      event_type: "location_sample",
      entity_type: "staff_location_sample",
      entity_id: sampleInsert.data?.id,
      details: { inside_geofence: inside, distance_meters: distance, accuracy_meters: payload.gps_accuracy_meters ?? null }
    });

    const openShiftRes = await supabase
      .from("staff_shifts" as any)
      .select("*")
      .eq("staff_id", staff.id)
      .eq("garden_id", payload.garden_id)
      .eq("shift_date", shiftDate)
      .not("actual_start", "is", null)
      .is("actual_end", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const openShift = openShiftRes.data as any;

    if (manualAction) {
      const confidence = confidenceStatus(inside, payload.gps_accuracy_meters, 1);
      const update = payload.action === "check_in"
        ? { actual_start: iso, gps_start_lat: payload.gps_lat, gps_start_lng: payload.gps_lng, start_gps_verified: inside, status: "started", attendance_confidence: confidence.status, confidence_score: confidence.score, review_reason: confidence.reason }
        : { actual_end: iso, gps_end_lat: payload.gps_lat, gps_end_lng: payload.gps_lng, end_gps_verified: inside, status: "completed", attendance_confidence: confidence.status, confidence_score: confidence.score, review_reason: confidence.reason };
      const { data, error } = await supabase.from("staff_shifts").upsert({ staff_id: staff.id, garden_id: payload.garden_id, shift_date: shiftDate, ...update } as any, { onConflict: "staff_id,garden_id,shift_date" }).select("*").single();
      if (error) return fail(error.message, 400);
      return ok({ mode: "manual_fallback", shift: data, sample: sampleInsert.data, inside_geofence: inside, distance_meters: distance });
    }

    const since = new Date(timestamp.getTime() - (THRESHOLD_MINUTES + 6) * 60000).toISOString();
    const threshold = new Date(timestamp.getTime() - THRESHOLD_MINUTES * 60000).toISOString();
    const sampleWindow = await supabase
      .from("staff_location_samples" as any)
      .select("id, inside_geofence, captured_at, gps_accuracy_meters, distance_meters")
      .eq("staff_id", staff.id)
      .eq("garden_id", payload.garden_id)
      .gte("captured_at", since)
      .order("captured_at", { ascending: true });
    const samples = (sampleWindow.data ?? []) as any[];
    const insideSamples = samples.filter((sample) => sample.inside_geofence);
    const outsideSamples = samples.filter((sample) => !sample.inside_geofence);
    const oldestInside = insideSamples[0];
    const oldestOutside = outsideSamples[0];
    const confidence = confidenceStatus(inside, payload.gps_accuracy_meters, inside ? insideSamples.length : outsideSamples.length);

    if (!openShift && inside && oldestInside?.captured_at && oldestInside.captured_at <= threshold && insideSamples.length >= 2) {
      const { data, error } = await supabase.from("staff_shifts").upsert({
        staff_id: staff.id,
        garden_id: payload.garden_id,
        shift_date: shiftDate,
        actual_start: oldestInside.captured_at,
        gps_start_lat: payload.gps_lat,
        gps_start_lng: payload.gps_lng,
        start_gps_verified: confidence.status !== "requires_review",
        status: "started",
        auto_attendance_enabled: true,
        auto_started: true,
        auto_start_detected_at: iso,
        attendance_confidence: confidence.status,
        confidence_score: confidence.score,
        review_reason: confidence.reason
      } as any, { onConflict: "staff_id,garden_id,shift_date" }).select("*").single();
      if (error) return fail(error.message, 400);
      await writeAudit(supabase, { staff_id: staff.id, garden_id: payload.garden_id, actor_profile_id: profile.id, event_type: "auto_shift_started", entity_type: "staff_shift", entity_id: data.id, details: { detected_at: iso, start_time: oldestInside.captured_at, confidence: confidence.status } });
      return ok({ mode: "automatic", attendance_event: "started", shift: data, sample: sampleInsert.data, inside_geofence: inside, distance_meters: distance, confidence });
    }

    if (openShift && !inside && oldestOutside?.captured_at && oldestOutside.captured_at <= threshold && outsideSamples.length >= 2) {
      const start = new Date(openShift.actual_start).getTime();
      const end = new Date(oldestOutside.captured_at).getTime();
      const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
      const { data, error } = await supabase.from("staff_shifts").update({
        actual_end: oldestOutside.captured_at,
        gps_end_lat: payload.gps_lat,
        gps_end_lng: payload.gps_lng,
        end_gps_verified: confidence.status !== "requires_review",
        status: "completed",
        auto_closed: true,
        auto_end_detected_at: iso,
        attendance_confidence: confidence.status,
        confidence_score: confidence.score,
        total_minutes: totalMinutes,
        overtime_minutes: Math.max(0, totalMinutes - 480),
        review_reason: confidence.reason
      } as any).eq("id", openShift.id).select("*").single();
      if (error) return fail(error.message, 400);
      await writeAudit(supabase, { staff_id: staff.id, garden_id: payload.garden_id, actor_profile_id: profile.id, event_type: "auto_shift_closed", entity_type: "staff_shift", entity_id: data.id, details: { detected_at: iso, end_time: oldestOutside.captured_at, confidence: confidence.status, total_minutes: totalMinutes } });
      return ok({ mode: "automatic", attendance_event: "closed", shift: data, sample: sampleInsert.data, inside_geofence: inside, distance_meters: distance, confidence });
    }

    if (confidence.status === "requires_review") {
      await supabase.from("staff_workforce_anomalies" as any).insert({
        staff_id: staff.id,
        garden_id: payload.garden_id,
        shift_id: openShift?.id ?? null,
        anomaly_type: inside ? "gps_failure" : "outside_garden",
        severity: inside ? "medium" : "low",
        details: confidence.reason,
        evidence: { distance_meters: distance, accuracy_meters: payload.gps_accuracy_meters ?? null, inside_geofence: inside }
      });
      await writeAudit(supabase, { staff_id: staff.id, garden_id: payload.garden_id, actor_profile_id: profile.id, event_type: "attendance_requires_review", entity_type: "staff_location_sample", entity_id: sampleInsert.data?.id, details: { reason: confidence.reason } });
    }

    return ok({
      mode: "automatic",
      attendance_event: openShift ? "monitoring_exit" : "monitoring_entry",
      sample: sampleInsert.data,
      shift: openShift ?? null,
      inside_geofence: inside,
      distance_meters: distance,
      threshold_minutes: THRESHOLD_MINUTES,
      confidence
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
