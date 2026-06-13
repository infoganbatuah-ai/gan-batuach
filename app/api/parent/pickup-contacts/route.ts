import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const contactSchema = z.object({
  child_id: z.string().uuid(),
  full_name: z.string().min(2),
  relation: z.enum(["mother", "father", "parent", "second_parent", "grandparent", "sibling", "babysitter", "nanny", "guardian", "approved_pickup_contact", "emergency_contact", "temporary", "other"]),
  phone: z.string().optional().nullable(),
  identity_number: z.string().optional().nullable(),
  face_reference_image: z.string().url().optional().nullable(),
  photo_required: z.boolean().optional().default(false),
  valid_from: z.string().optional().nullable(),
  valid_until: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  temporary: z.boolean().optional().default(false)
});

const revokeSchema = z.object({
  id: z.string().uuid(),
  active: z.boolean().default(false)
});

async function getParentChildIds(supabase: Awaited<ReturnType<typeof createClient>>, profileId: string) {
  const parents = await supabase.from("parents" as any).select("id").or(`profile_id.eq.${profileId},user_id.eq.${profileId}`);
  const parentIds = ((parents.data ?? []) as any[]).map((parent) => parent.id).filter(Boolean);
  if (!parentIds.length) return [];
  const children = await supabase.from("children" as any).select("id").in("primary_parent_id", parentIds);
  return ((children.data ?? []) as any[]).map((child) => child.id).filter(Boolean);
}

export async function GET() {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const childIds = await getParentChildIds(supabase, profile.id);
  if (!childIds.length) return NextResponse.json({ ok: true, data: { contacts: [], events: [] } });
  const [contacts, events] = await Promise.all([
    supabase.from("authorized_pickup_contacts" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("created_at", { ascending: false }),
    supabase.from("child_pickup_events" as any).select("*, children(full_name, photo_url)").in("child_id", childIds).order("pickup_time", { ascending: false }).limit(80)
  ]);
  if (contacts.error) return NextResponse.json({ ok: false, error: "לא ניתן לטעון מורשי איסוף כרגע" }, { status: 500 });
  return NextResponse.json({ ok: true, data: { contacts: contacts.data ?? [], events: events.data ?? [] } });
}

export async function POST(request: Request) {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const payload = contactSchema.parse(await request.json());
  const childIds = await getParentChildIds(supabase, profile.id);
  if (!childIds.includes(payload.child_id)) return NextResponse.json({ ok: false, error: "אין הרשאה לעדכן איסוף עבור הילד הזה" }, { status: 403 });

  const child = await supabase.from("children" as any).select("id, full_name, garden_id").eq("id", payload.child_id).single();
  if (child.error || !child.data) return NextResponse.json({ ok: false, error: "לא נמצא כרטיס ילד" }, { status: 404 });
  const authorizationType = payload.temporary ? "temporary" : "permanent";
  if (payload.temporary && (!payload.valid_from || !payload.valid_until)) {
    return NextResponse.json({ ok: false, error: "להרשאה זמנית יש לבחור חלון זמן ברור" }, { status: 422 });
  }

  const insert = await supabase
    .from("authorized_pickup_contacts" as any)
    .insert({
      child_id: payload.child_id,
      kindergarten_id: child.data.garden_id,
      created_by: profile.id,
      full_name: payload.full_name,
      relation: payload.temporary ? "temporary" : payload.relation,
      phone: payload.phone || null,
      identity_number: payload.identity_number || null,
      face_reference_image: payload.face_reference_image || null,
      photo_required: payload.photo_required,
      authorization_type: authorizationType,
      valid_from: payload.valid_from || null,
      valid_until: payload.valid_until || null,
      notes: payload.notes || null,
      identity_verification_status: "pending",
      authorization_status: "approved",
      legal_identity_method: "parent_declared",
      biometric_identification_used: false,
      camera_based_authorization_used: false,
      metadata: { source: "parent_pickup_center", human_review_required: true, face_verification_enabled: false, no_child_face_recognition: true }
    })
    .select("*")
    .single();
  if (insert.error) return NextResponse.json({ ok: false, error: "שמירת מורשה האיסוף נכשלה" }, { status: 500 });

  const adult = await supabase.from("authorized_adults" as any).insert({
    garden_id: child.data.garden_id,
    child_id: payload.child_id,
    parent_profile_id: profile.id,
    source_pickup_contact_id: insert.data.id,
    full_name: payload.full_name,
    identity_number: payload.identity_number || null,
    phone: payload.phone || null,
    relationship: payload.temporary ? "temporary" : payload.relation === "nanny" ? "babysitter" : ["mother", "father", "parent", "grandparent", "babysitter", "guardian", "approved_pickup_contact", "emergency_contact", "temporary", "other"].includes(payload.relation) ? payload.relation : "other",
    identity_verification_status: "pending",
    authorization_status: "approved",
    authorization_scope: "pickup",
    created_by: profile.id,
    expires_at: payload.valid_until || null,
    biometric_identification_allowed: false,
    camera_based_identification_allowed: false,
    notes: payload.notes || null,
    metadata: { source: "parent_pickup_center", no_face_recognition: true }
  }).select("id").maybeSingle();

  const adultId = adult.data?.id ?? null;
  if (adultId) {
    await supabase.from("authorized_pickup_contacts" as any).update({ authorized_adult_id: adultId }).eq("id", insert.data.id);
    await supabase.from("pickup_authorizations" as any).insert({
      child_id: payload.child_id,
      garden_id: child.data.garden_id,
      authorized_adult_id: adultId,
      pickup_contact_id: insert.data.id,
      authorization_type: payload.temporary ? "temporary" : "permanent",
      status: "approved",
      created_by: profile.id,
      valid_from: payload.valid_from || null,
      valid_until: payload.valid_until || null,
      approval_method: "parent_request",
      notes: payload.notes || null,
      metadata: { source: "parent_pickup_center" }
    });
  }

  await supabase.from("attendance_compliance_audit_trail" as any).insert({
    child_id: payload.child_id,
    garden_id: child.data.garden_id,
    authorized_adult_id: adultId,
    actor_profile_id: profile.id,
    action: authorizationType === "temporary" ? "temporary_authorization_created" : "pickup_authorization_created",
    status: "success",
    metadata: {
      pickup_contact_id: insert.data.id,
      authorization_type: authorizationType,
      no_biometric_identification: true
    }
  });

  await notifyGardenManagers(supabase, child.data.garden_id, {
    title: authorizationType === "temporary" ? "נוצרה הרשאת איסוף זמנית" : "עודכן מורשה איסוף",
    message: `${payload.full_name} נוסף/ה עבור ${child.data.full_name}`,
    entityId: insert.data.id
  });

  return NextResponse.json({ ok: true, data: insert.data });
}

export async function PATCH(request: Request) {
  const { profile } = await requireRole(["parent"]);
  const supabase = await createClient();
  const payload = revokeSchema.parse(await request.json());
  const childIds = await getParentChildIds(supabase, profile.id);
  if (!childIds.length) return NextResponse.json({ ok: false, error: "לא נמצאו ילדים משויכים" }, { status: 403 });
  const existing = await supabase.from("authorized_pickup_contacts" as any).select("id, child_id, kindergarten_id, full_name").eq("id", payload.id).single();
  if (existing.error || !existing.data || !childIds.includes(existing.data.child_id)) {
    return NextResponse.json({ ok: false, error: "אין הרשאה לבטל מורשה איסוף זה" }, { status: 403 });
  }
  const update = await supabase.from("authorized_pickup_contacts" as any).update({ active: payload.active, updated_at: new Date().toISOString() }).eq("id", payload.id).select("*").single();
  if (update.error) return NextResponse.json({ ok: false, error: "ביטול ההרשאה נכשל" }, { status: 500 });
  if (!payload.active) {
    await notifyGardenManagers(supabase, existing.data.kindergarten_id, {
      title: "הרשאת איסוף בוטלה",
      message: `${existing.data.full_name} כבר לא פעיל/ה כמורשה איסוף`,
      entityId: existing.data.id
    });
  }
  return NextResponse.json({ ok: true, data: update.data });
}

async function notifyGardenManagers(supabase: Awaited<ReturnType<typeof createClient>>, gardenId: string, payload: { title: string; message: string; entityId: string }) {
  const recipients = await supabase.from("profiles" as any).select("id, role").eq("garden_id", gardenId).in("role", ["manager", "owner"]);
  const rows = ((recipients.data ?? []) as any[]).map((recipient) => ({
    garden_id: gardenId,
    kindergarten_id: gardenId,
    recipient_id: recipient.id,
    recipient_profile_id: recipient.id,
    recipient_role: recipient.role,
    title: payload.title,
    body: payload.message,
    message: payload.message,
    entity_type: "authorized_pickup_contact",
    entity_id: payload.entityId,
    action_url: "/dashboard/garden/pickup",
    metadata: { pickup_authorization: true }
  }));
  if (rows.length) await supabase.from("notifications" as any).insert(rows);
}
