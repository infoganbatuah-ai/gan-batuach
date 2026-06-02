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
  camera_event_id: z.string().uuid().optional().nullable()
});

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
  if (payload.pickup_contact_id) {
    const contactRes = await supabase
      .from("authorized_pickup_contacts" as any)
      .select("*")
      .eq("id", payload.pickup_contact_id)
      .eq("child_id", payload.child_id)
      .eq("kindergarten_id", gardenId)
      .maybeSingle();
    if (contactRes.error) return NextResponse.json({ ok: false, error: "בדיקת מורשה האיסוף נכשלה" }, { status: 500 });
    contact = contactRes.data;
  }

  const status = payload.request_parent_confirmation ? "parent_confirmation_requested" : payload.status;
  const event = await supabase
    .from("child_pickup_events" as any)
    .insert({
      child_id: payload.child_id,
      kindergarten_id: gardenId,
      pickup_contact_id: contact?.id ?? null,
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
      metadata: {
        source: "garden_pickup_center",
        human_review_required: true,
        face_verification_enabled: false,
        automatic_release: false
      }
    })
    .select("*")
    .single();
  if (event.error) return NextResponse.json({ ok: false, error: "רישום האיסוף נכשל" }, { status: 500 });

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
