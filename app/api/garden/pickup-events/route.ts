import { NextResponse } from "next/server";
import { z } from "zod";
import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { requireStaffTeachingScope } from "@/lib/management/teaching-access";
import { createClient } from "@/lib/supabase/server";

// Names, authorization status, event time, face/GPS result and final status
// are derived by the database transaction, never by a browser assertion.
const releaseSchema = z.object({
  child_id: z.string().uuid(),
  pickup_contact_id: z.string().uuid().optional().nullable(),
  guardian_profile_id: z.string().uuid().optional().nullable()
}).strict().refine((value) => Boolean(value.pickup_contact_id) !== Boolean(value.guardian_profile_id), {
  message: "בחרו מורשה איסוף או אפוטרופוס אחד"
});

export async function POST(request: Request) {
  const access = await getOperationalRoleContext(["manager", "owner", "staff"]);
  if (!access.allowed) return access.response;
  const teaching = await requireStaffTeachingScope(access.session.profile, "attendance");
  if (!teaching.allowed) return teaching.response;
  const gardenId = access.session.profile.garden_id;
  if (!gardenId) return NextResponse.json({ ok: false, error: "לא נמצא הקשר גן מורשה" }, { status: 403 });
  const parsed = releaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "נדרש מורשה איסוף תקף" }, { status: 422 });
  const supabase = await createClient();
  const result = await supabase.rpc("management_child_release", {
    p_garden_id: gardenId,
    p_child_id: parsed.data.child_id,
    p_pickup_contact_id: parsed.data.pickup_contact_id ?? null,
    p_guardian_profile_id: parsed.data.guardian_profile_id ?? null
  });
  if (result.error) return NextResponse.json({ ok: false, error: "שחרור הילד נדחה: נוכחות, סמכות צוות והרשאת איסוף נבדקות מחדש." }, {
    status: result.error.code === "42501" ? 403 : 409
  });
  const eventId = (result.data as { pickup_event_id?: string } | null)?.pickup_event_id;
  const event = eventId ? await supabase.from("child_pickup_events" as any)
    .select("id,child_id,kindergarten_id,pickup_person,authorization_type,pickup_time,status,release_confirmed")
    .eq("id", eventId).maybeSingle() : null;
  return NextResponse.json({ ok: true, data: event?.data ?? result.data });
}
