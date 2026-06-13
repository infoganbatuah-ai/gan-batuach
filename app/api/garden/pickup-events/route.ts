import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const pickupEventSchema = z.object({
  child_id: z.string().uuid(),
  pickup_contact_id: z.string().uuid().optional().nullable(),
  pickup_person: z.string().min(2),
  authorization_type: z.enum(["permanent", "temporary", "emergency", "manual_review", "unauthorized"]).default("manual_review"),
  pickup_time: z.string().optional().nullable(),
  status: z.enum(["recorded", "verified_by_staff", "unusual", "parent_confirmation_requested", "cancelled"]).default("recorded"),
  notes: z.string().optional().nullable(),
  unusual_reason: z.string().optional().nullable(),
  request_parent_confirmation: z.boolean().optional().default(false),
  camera_event_id: z.string().uuid().optional().nullable(),
  gps_lat: z.number().optional().nullable(),
  gps_lng: z.number().optional().nullable(),
  gps_distance_meters: z.number().optional().nullable(),
  gps_validation_status: z.enum(["passed", "failed", "not_available", "manual_override", "requires_review"]).optional().default("not_available"),
  signature_image: z.string().optional().nullable(),
  device_label: z.string().optional().nullable()
});

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function hashSignature(value?: string | null) {
  if (!value) return null;
  return Buffer.from(value).toString("base64").slice(0, 64);
}

export async function POST(request: Request) {
  const { profile } = await requireRole(["manager", "owner"]);
  const supabase = await createClient();
  const gardenId = profile.garden_id;
  if (!gardenId) return NextResponse.json({ ok: false, error: "לא נמצא גן משויך למשתמש" }, { status: 403 });
  const payload = pickupEventSchema.parse(await request.json());

  const child = await supabase.from("children" as any).select("id, full_name, garden_id, primary_parent_id").eq("id", payload.child_id).single();
  if (child.error || !child.data || child.data.garden_id !== gardenId) {
    return NextResponse.json({ ok: false, error: "אין הרשאה לרשום איסוף עבור הילד הזה" }, { status: 403 });
  }

  let contact: any = null;
  let authorization: any = null;
  if (payload.pickup_contact_id) {
    const contactRes = await supabase
      .from("authorized_pickup_contacts" as any)
      .select("*, pickup_authorizations(id,status,authorization_type,valid_from,valid_until)")
      .eq("id", payload.pickup_contact_id)
      .eq("child_id", payload.child_id)
      .eq("kindergarten_id", gardenId)
      .maybeSingle();
    if (contactRes.error) return NextResponse.json({ ok: false, error: "בדיקת מורשה האיסוף נכשלה" }, { status: 500 });
    contact = contactRes.data;
    authorization = (contact?.pickup_authorizations ?? []).find((item: any) => item.status === "approved") ?? null;
    const expired = contact?.valid_until && new Date(contact.valid_until).getTime() < Date.now();
    const inactive = contact && contact.active === false;
    const blockedStatus = contact && ["rejected", "revoked", "expired", "blocked"].includes(String(contact.authorization_status));
    if (!contact || inactive || expired || blockedStatus) {
      await supabase.from("attendance_exceptions" as any).insert({
        garden_id: gardenId,
        child_id: payload.child_id,
        authorized_adult_id: contact?.authorized_adult_id ?? null,
        exception_type: expired ? "expired_authorization" : "unauthorized_pickup",
        severity: "critical",
        status: "open",
        title: "ניסיון איסוף לא מורשה",
        details: `${payload.pickup_person} אינו מורשה לאיסוף פעיל`,
        metadata: { source: "garden_pickup_events", pickup_contact_id: payload.pickup_contact_id ?? null }
      });
      return NextResponse.json({ ok: false, error: "האדם שנבחר אינו מורשה לאיסוף פעיל. נוצר חריג לבדיקה." }, { status: 403 });
    }
  }

  const status = payload.request_parent_confirmation ? "parent_confirmation_requested" : payload.status;
  const legalReleaseStatus = payload.authorization_type === "unauthorized"
    ? "blocked"
    : payload.authorization_type === "emergency"
      ? "emergency_approved"
      : contact
        ? "completed"
        : "manual_override";
  const event = await supabase
    .from("child_pickup_events" as any)
    .insert({
      child_id: payload.child_id,
      kindergarten_id: gardenId,
      pickup_contact_id: contact?.id ?? null,
      authorized_adult_id: contact?.authorized_adult_id ?? null,
      pickup_authorization_id: authorization?.id ?? null,
      pickup_person: payload.pickup_person,
      authorization_type: contact?.authorization_type ?? payload.authorization_type,
      pickup_time: payload.pickup_time || new Date().toISOString(),
      status,
      verified_by: profile.id,
      notes: payload.notes || null,
      unusual_reason: payload.unusual_reason || null,
      camera_event_id: payload.camera_event_id || null,
      parent_confirmation_requested: payload.request_parent_confirmation,
      parent_confirmation_status: payload.request_parent_confirmation ? "pending" : "not_requested",
      face_match_status: "not_run",
      gps_validation_status: payload.gps_validation_status ?? "not_available",
      gps_distance_meters: payload.gps_distance_meters ?? null,
      identity_verification_status: contact ? "manager_verified" : "pending",
      legal_release_status: legalReleaseStatus,
      biometric_identification_used: false,
      camera_based_release_used: false,
      metadata: {
        source: "garden_pickup_center",
        human_review_required: true,
        face_verification_enabled: false,
        automatic_release: false,
        no_child_face_recognition: true
      }
    })
    .select("*")
    .single();
  if (event.error) return NextResponse.json({ ok: false, error: "רישום האיסוף נכשל" }, { status: 500 });

  let gpsValidationId: string | null = null;
  if (payload.gps_lat != null && payload.gps_lng != null) {
    const gps = await supabase.from("gps_attendance_validations" as any).insert({
      pickup_event_id: event.data.id,
      child_id: payload.child_id,
      garden_id: gardenId,
      actor_profile_id: profile.id,
      authorized_adult_id: contact?.authorized_adult_id ?? null,
      action: "pickup",
      actor_lat: payload.gps_lat,
      actor_lng: payload.gps_lng,
      radius_meters: 30,
      distance_meters: payload.gps_distance_meters ?? null,
      validation_result: payload.gps_validation_status ?? "not_available",
      device_label: payload.device_label ?? null,
      ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
      metadata: { source: "garden_pickup_events" }
    }).select("id").maybeSingle();
    gpsValidationId = gps.data?.id ?? null;
  }

  let signatureId: string | null = null;
  if (payload.signature_image) {
    const signature = await supabase.from("attendance_digital_signatures" as any).insert({
      pickup_event_id: event.data.id,
      child_id: payload.child_id,
      garden_id: gardenId,
      signed_by_profile_id: profile.id,
      authorized_adult_id: contact?.authorized_adult_id ?? null,
      action: "pickup",
      signature_image: payload.signature_image,
      signature_hash: hashSignature(payload.signature_image),
      gps_lat: payload.gps_lat ?? null,
      gps_lng: payload.gps_lng ?? null,
      gps_validation_id: gpsValidationId,
      ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
      user_agent: request.headers.get("user-agent"),
      device_label: payload.device_label ?? null,
      metadata: { source: "garden_pickup_events" }
    }).select("id").maybeSingle();
    signatureId = signature.data?.id ?? null;
  }

  if (gpsValidationId || signatureId) {
    await supabase.from("child_pickup_events" as any).update({
      gps_validation_id: gpsValidationId,
      signature_id: signatureId
    }).eq("id", event.data.id);
  }

  await supabase.from("attendance_compliance_audit_trail" as any).insert({
    pickup_event_id: event.data.id,
    child_id: payload.child_id,
    garden_id: gardenId,
    authorized_adult_id: contact?.authorized_adult_id ?? null,
    actor_profile_id: profile.id,
    action: "check_out_completed",
    status: "success",
    gps_validation_result: payload.gps_validation_status ?? "not_available",
    signature_id: signatureId,
    ip: firstForwardedIp(request.headers.get("x-forwarded-for")),
    user_agent: request.headers.get("user-agent"),
    metadata: { legal_release_status: legalReleaseStatus, no_biometric_identification: true }
  });

  if (status === "unusual" || payload.request_parent_confirmation) {
    await notifyParents(supabase, child.data.primary_parent_id, gardenId, {
      title: payload.request_parent_confirmation ? "נדרש אישור הורה לאיסוף" : "איסוף חריג נרשם",
      message: `${child.data.full_name}: ${payload.pickup_person}`,
      eventId: event.data.id
    });
  }

  return NextResponse.json({ ok: true, data: event.data });
}

async function notifyParents(supabase: Awaited<ReturnType<typeof createClient>>, parentId: string | null, gardenId: string, payload: { title: string; message: string; eventId: string }) {
  if (!parentId) return;
  const parent = await supabase.from("parents" as any).select("profile_id, user_id").eq("id", parentId).maybeSingle();
  const profileId = parent.data?.profile_id ?? parent.data?.user_id;
  if (!profileId) return;
  await supabase.from("notifications" as any).insert({
    garden_id: gardenId,
    kindergarten_id: gardenId,
    recipient_id: profileId,
    recipient_profile_id: profileId,
    recipient_role: "parent",
    title: payload.title,
    body: payload.message,
    message: payload.message,
    entity_type: "child_pickup_event",
    entity_id: payload.eventId,
    action_url: "/dashboard/parent/pickup",
    metadata: { pickup_event: true, human_review_required: true }
  });
}
