import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createCrudHandlers } from "@/lib/crud-route";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { attendanceSchema } from "@/lib/validation";
import { encryptField, getCurrentKeyVersion } from "@/lib/security/field-encryption";
import { deviceFingerprint, requestId, writeAuditEvent } from "@/lib/security/audit-log-service";

export const { GET } = createCrudHandlers({
  table: "attendance",
  read: "attendance:write",
  write: "attendance:write",
  schema: attendanceSchema,
  defaultOrder: "attendance_date"
});

const parentAttendanceSchema = z.object({
  child_id: z.string().uuid(),
  action: z.enum(["check_in", "check_out"]),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  signature_base64: z.string().min(20),
  device_label: z.string().max(120).optional(),
  authorized_adult_id: z.string().uuid().optional().nullable()
});

function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const toRad = (value: number) => value * Math.PI / 180;
  const radius = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(radius * 2 * Math.asin(Math.sqrt(h)));
}

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function signatureHash(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function storeSignature(supabase: Awaited<ReturnType<typeof createClient>>, payload: { gardenId: string; childId: string; profileId: string; signatureBase64: string }) {
  const base64 = payload.signatureBase64.replace(/^data:image\/\w+;base64,/, "");
  const bytes = Buffer.from(base64, "base64");
  const path = `${payload.gardenId}/${payload.childId}/${payload.profileId}/${Date.now()}-${crypto.randomBytes(6).toString("hex")}.png`;
  const uploaded = await supabase.storage.from("restricted-signatures").upload(path, bytes, {
    contentType: "image/png",
    upsert: false
  });
  if (!uploaded.error) return { storage_path: path, encrypted_fallback: null };
  return { storage_path: null, encrypted_fallback: encryptField(payload.signatureBase64) };
}

export async function POST(request: Request) {
  const { user, profile } = await requireRole(["parent"]);
  const payload = parentAttendanceSchema.parse(await request.json());
  const supabase = await createClient();
  const childRes = await supabase
    .from("children" as any)
    .select("id, full_name, garden_id, kindergarten_id, primary_parent_id, parents!children_primary_parent_id_fkey(id,profile_id,user_id)")
    .eq("id", payload.child_id)
    .maybeSingle();
  if (childRes.error || !childRes.data) return NextResponse.json({ error: "Child not found" }, { status: 404 });
  const child = childRes.data as any;
  const parent = Array.isArray(child.parents) ? child.parents[0] : child.parents;
  if (parent && parent.profile_id !== user.id && parent.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const gardenId = child.garden_id ?? child.kindergarten_id;
  const gardenRes = await supabase.from("gardens" as any).select("id,name,gps_lat,gps_lng").eq("id", gardenId).maybeSingle();
  if (gardenRes.error || !gardenRes.data?.gps_lat || !gardenRes.data?.gps_lng) {
    return NextResponse.json({ error: "Kindergarten location is not configured" }, { status: 400 });
  }
  const distance = distanceMeters(
    { latitude: payload.latitude, longitude: payload.longitude },
    { latitude: Number(gardenRes.data.gps_lat), longitude: Number(gardenRes.data.gps_lng) }
  );
  if (distance > 30) {
    await supabase.from("gps_attendance_validations" as any).insert({
      child_id: payload.child_id,
      garden_id: gardenId,
      actor_profile_id: profile.id,
      authorized_adult_id: payload.authorized_adult_id ?? null,
      action: payload.action,
      actor_lat: payload.latitude,
      actor_lng: payload.longitude,
      garden_lat: gardenRes.data.gps_lat,
      garden_lng: gardenRes.data.gps_lng,
      radius_meters: 30,
      distance_meters: distance,
      validation_result: "failed",
      device_label: payload.device_label ?? null,
      ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
      metadata: { source: "parent_attendance", blocked: true }
    });
    return NextResponse.json({ error: "נדרש להיות בטווח של 30 מטר מהגן כדי לבצע כניסה או יציאה.", distance_meters: distance }, { status: 400 });
  }

  const attendanceDate = new Date().toISOString().slice(0, 10);
  const existing = await supabase
    .from("attendance" as any)
    .select("id")
    .eq("garden_id", gardenId)
    .eq("child_id", payload.child_id)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();
  const now = new Date().toISOString();
  const attendancePayload: Record<string, unknown> = {
    garden_id: gardenId,
    child_id: payload.child_id,
    attendance_date: attendanceDate,
    status: payload.action === "check_in" ? "present" : "left_early",
    gps_lat: payload.latitude,
    gps_lng: payload.longitude,
    gps_validation_status: "passed",
    gps_distance_meters: distance,
    legal_attendance_method: "adult_initiated",
    parent_identity_verified: true,
    biometric_identification_used: false,
    camera_based_attendance_used: false
  };
  if (payload.action === "check_in") attendancePayload.check_in_at = now;
  if (payload.action === "check_out") attendancePayload.check_out_at = now;

  const attendanceWrite = existing.data?.id
    ? await supabase.from("attendance" as any).update(attendancePayload).eq("id", existing.data.id).select("*").single()
    : await supabase.from("attendance" as any).insert(attendancePayload).select("*").single();
  if (attendanceWrite.error) return NextResponse.json({ error: attendanceWrite.error.message }, { status: 400 });

  const gps = await supabase.from("gps_attendance_validations" as any).insert({
    attendance_id: attendanceWrite.data.id,
    child_id: payload.child_id,
    garden_id: gardenId,
    actor_profile_id: profile.id,
    authorized_adult_id: payload.authorized_adult_id ?? null,
    action: payload.action,
    actor_lat: payload.latitude,
    actor_lng: payload.longitude,
    garden_lat: gardenRes.data.gps_lat,
    garden_lng: gardenRes.data.gps_lng,
    radius_meters: 30,
    distance_meters: distance,
    validation_result: "passed",
    device_label: payload.device_label ?? null,
    ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
    metadata: { source: "parent_attendance" }
  }).select("id").maybeSingle();

  const signatureStorage = await storeSignature(supabase, { gardenId, childId: payload.child_id, profileId: profile.id, signatureBase64: payload.signature_base64 });
  const signature = await supabase.from("attendance_digital_signatures" as any).insert({
    attendance_id: attendanceWrite.data.id,
    child_id: payload.child_id,
    garden_id: gardenId,
    signed_by_profile_id: profile.id,
    authorized_adult_id: payload.authorized_adult_id ?? null,
    action: payload.action,
    signature_image: signatureStorage.storage_path ?? signatureStorage.encrypted_fallback,
    signature_hash: signatureHash(payload.signature_base64),
    signature_metadata_encrypted: encryptField({
      storage_path: signatureStorage.storage_path,
      encrypted_fallback_used: Boolean(signatureStorage.encrypted_fallback),
      device_label: payload.device_label ?? null,
      ip: firstForwardedIp(request.headers.get("x-forwarded-for"))
    }),
    encryption_version: getCurrentKeyVersion(),
    gps_lat: payload.latitude,
    gps_lng: payload.longitude,
    gps_validation_id: gps.data?.id ?? null,
    ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
    user_agent: request.headers.get("user-agent"),
    device_label: payload.device_label ?? null,
    metadata: { source: "parent_attendance", storage_path: signatureStorage.storage_path, encrypted_fallback_used: Boolean(signatureStorage.encrypted_fallback) }
  }).select("id").maybeSingle();

  await supabase.from("attendance_compliance_audit_trail" as any).insert({
    attendance_id: attendanceWrite.data.id,
    child_id: payload.child_id,
    garden_id: gardenId,
    authorized_adult_id: payload.authorized_adult_id ?? null,
    actor_profile_id: profile.id,
    action: payload.action === "check_in" ? "check_in_completed" : "check_out_completed",
    status: "success",
    gps_validation_result: "passed",
    signature_id: signature.data?.id ?? null,
    ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
    user_agent: request.headers.get("user-agent"),
    metadata: { distance_meters: distance, realtime_dashboard_update: true }
  });

  await writeAuditEvent({
    eventType: payload.action === "check_in" ? "child_check_in_completed" : "child_check_out_completed",
    eventCategory: "child",
    actorProfileId: profile.id,
    actorRole: profile.role,
    targetType: "attendance",
    targetId: attendanceWrite.data.id,
    gardenId,
    childId: payload.child_id,
    ipAddress: firstForwardedIp(request.headers.get("x-forwarded-for")),
    userAgent: request.headers.get("user-agent"),
    deviceFingerprint: deviceFingerprint(request.headers),
    requestId: requestId(request.headers),
    metadata: {
      gps_validation_result: "passed",
      distance_meters: distance,
      signature_recorded: Boolean(signature.data?.id),
      biometric_identification_used: false,
      camera_based_attendance_used: false
    },
    riskLevel: "medium"
  });

  await supabase.from("notifications" as any).insert({
    garden_id: gardenId,
    recipient_role: "staff",
    title: payload.action === "check_in" ? "ילד נכנס לגן" : "ילד יצא מהגן",
    body: `${child.full_name} · ${distance} מטר`,
    entity_type: "attendance",
    entity_id: attendanceWrite.data.id,
    severity: "medium",
    metadata: { realtime: true, source: "parent_attendance" }
  });

  return NextResponse.json({ data: { attendance: attendanceWrite.data, distance_meters: distance, signature_id: signature.data?.id ?? null } }, { status: 201 });
}
