import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({ name: z.string().trim().min(2), city: z.string().trim().min(2), address: z.string().trim().optional() });

async function approvedInspector() {
  const { user, profile } = await getSessionProfile();
  if (!user || !profile) return { response: fail("נדרשת התחברות.", 401), profile: null };
  if (profile.role !== "inspector") return { response: fail("אין הרשאת מפקח.", 403), profile: null };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("current_inspector_approved" as never);
  if (error) return { response: fail("בדיקת הרשאת המפקח אינה זמינה.", 503), profile: null };
  if (data !== true) return { response: fail("אישור המפקח אינו פעיל.", 403), profile: null };
  return { response: null, profile };
}

export async function GET() {
  try {
    const access = await approvedInspector();
    if (access.response) return access.response;
    if (!isAdminClientConfigured()) return fail("שירות הגנים אינו זמין.", 503);
    const admin = createAdminClient();
    const { data: gardens, error } = await admin.from("gardens" as never)
      .select("id,name,city,address,status,bootstrap_assignment_status,bootstrap_cancelled_at,created_at,onboarding_status")
      .eq("bootstrap_inspector_id", access.profile!.id).order("created_at", { ascending: false }).limit(100);
    if (error) throw error;
    const gardenRows = (gardens ?? []) as { id: string }[];
    const ids = gardenRows.map(garden => garden.id);
    const invitations = ids.length ? await admin.from("management_invitations" as never)
      .select("garden_id,status,expires_at,created_at").in("garden_id", ids).eq("invitation_type", "garden_management")
      .order("created_at", { ascending: false }) : { data: [], error: null };
    if (invitations.error) throw invitations.error;
    const inviteRows = (invitations.data ?? []) as { garden_id: string; status: string }[];
    return ok({ gardens: gardenRows.map(garden => ({
      ...garden,
      invitation_status: inviteRows.find(invitation => invitation.garden_id === garden.id)?.status ?? null
    })) });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await approvedInspector();
    if (access.response) return access.response;
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_inspector_preliminary_garden" as never, {
      p_name: payload.name, p_city: payload.city, p_address: payload.address ?? null
    } as never);
    if (error) return fail(error.code === "42501" ? "אין הרשאה לפתוח טיוטה." : "לא ניתן לפתוח טיוטת גן.", error.code === "42501" ? 403 : 409);
    const result = data as { status: string; garden_id?: string; already_exists?: boolean };
    return result.status === "duplicate_review_required"
      ? fail("נמצא גן דומה; נדרשת בדיקה לפני פתיחת טיוטה נוספת.", 409, { reason: "duplicate_review_required" })
      : ok(result, result.already_exists ? 200 : 201);
  } catch (error) { return handleSafeRouteError(error); }
}
