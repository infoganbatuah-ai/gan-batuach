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
  const links = await supabase.from("child_guardian_links" as any)
    .select("permanent_child_file_id").eq("guardian_profile_id", profileId)
    .eq("status", "active").eq("legal_authority", true);
  const fileIds = ((links.data ?? []) as any[]).map((link) => link.permanent_child_file_id).filter(Boolean);
  if (!fileIds.length) return [];
  const children = await supabase.from("children" as any).select("id").in("permanent_child_file_id", fileIds);
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
  await requireRole(["parent"]);
  const supabase = await createClient();
  const payload = contactSchema.parse(await request.json());
  if (payload.face_reference_image || payload.identity_number || payload.photo_required) {
    return NextResponse.json({ ok: false, error: "תמונות ומזהים רגישים דורשים העלאה פרטית נפרדת." }, { status: 422 });
  }
  if (payload.temporary && (!payload.valid_from || !payload.valid_until)) {
    return NextResponse.json({ ok: false, error: "להרשאה זמנית יש לבחור חלון זמן ברור" }, { status: 422 });
  }
  const result = await supabase.rpc("management_add_pickup_contact", {
    p_child_id: payload.child_id,
    p_full_name: payload.full_name,
    p_relation: payload.relation === "temporary" ? "other" : payload.relation,
    p_phone: payload.phone ?? null,
    p_valid_from: payload.valid_from ?? null,
    p_valid_until: payload.temporary ? payload.valid_until : null,
    p_notes: payload.notes ?? null
  });
  if (result.error) return NextResponse.json({ ok: false, error: "שמירת מורשה האיסוף נכשלה או שאין סמכות לילד זה" }, {
    status: result.error.code === "42501" ? 403 : 422
  });
  return NextResponse.json({ ok: true, data: result.data });
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
  if (payload.active) return NextResponse.json({ ok: false, error: "הפעלה מחדש דורשת הרשאה חדשה" }, { status: 422 });
  const update = await supabase.rpc("management_revoke_pickup_contact", { p_contact_id: payload.id });
  if (update.error) return NextResponse.json({ ok: false, error: "ביטול ההרשאה נכשל" }, { status: update.error.code === "42501" ? 403 : 409 });
  return NextResponse.json({ ok: true, data: update.data });
}
