import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { assertCapabilityEnabled, CapabilityPolicyError } from "@/lib/domain/capability-policy-engine";
import { createClient } from "@/lib/supabase/server";

const createMockSchema = z.object({
  action: z.literal("create_mock"),
  pickup_contact_id: z.string().uuid(),
  child_id: z.string().uuid().optional().nullable(),
  camera_event_id: z.string().uuid().optional().nullable()
});

const reviewSchema = z.object({
  action: z.literal("review"),
  id: z.string().uuid(),
  review_status: z.enum(["approved_by_manager", "rejected_by_manager", "inconclusive"]),
  notes: z.string().trim().optional().nullable()
});

const schema = z.discriminatedUnion("action", [createMockSchema, reviewSchema]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner", "admin"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();

    if (payload.action === "create_mock") {
      const contactRes = await supabase
        .from("authorized_pickup_contacts" as any)
        .select("*, children(id, full_name)")
        .eq("id", payload.pickup_contact_id)
        .single();
      if (contactRes.error || !contactRes.data) return fail("מורשה האיסוף לא נמצא.", 404);
      const contact = contactRes.data as any;
      if (profile.role !== "admin" && contact.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לגן הזה.", 403);
      try {
        await assertCapabilityEnabled(supabase, "gan_batuach", "face_matching", {
          actorId: profile.id,
          reason: "face_match_result_creation",
          metadata: { kindergarten_id: contact.kindergarten_id, pickup_contact_id: contact.id }
        });
      } catch (error) {
        if (error instanceof CapabilityPolicyError) return fail(error.message, error.status);
        throw error;
      }

      const reference = await supabase
        .from("face_reference_images" as any)
        .select("*")
        .eq("authorized_pickup_contact_id", contact.id)
        .eq("active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const row = {
        kindergarten_id: contact.kindergarten_id,
        child_id: payload.child_id ?? contact.child_id,
        camera_event_id: payload.camera_event_id ?? null,
        reference_image_id: reference.data?.id ?? null,
        authorized_pickup_contact_id: contact.id,
        detected_person_label: "mock_possible_pickup_person",
        match_score: 0.72,
        provider: "mock_face_matching",
        confidence: 0.64,
        review_status: "possible_match",
        notes: "תוצאת mock בלבד. אין החלטה ביומטרית ואין שחרור ילד אוטומטי.",
        metadata: { mock: true, human_review_required: true, no_biometric_decision: true, parent_visible: false }
      };
      const result = await supabase.from("face_match_results" as any).insert(row).select("*").single();
      if (result.error || !result.data) {
        console.error("[face-match-create-mock]", result.error);
        return fail("לא ניתן ליצור תוצאת התאמה mock כרגע.", 500);
      }
      return ok({ result: result.data });
    }

    const existing = await supabase.from("face_match_results" as any).select("*").eq("id", payload.id).single();
    if (existing.error || !existing.data) return fail("תוצאת ההתאמה לא נמצאה.", 404);
    if (profile.role !== "admin" && existing.data.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לתוצאת ההתאמה הזו.", 403);
    const update = await supabase
      .from("face_match_results" as any)
      .update({
        review_status: payload.review_status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        notes: payload.notes ?? existing.data.notes,
        updated_at: new Date().toISOString(),
        metadata: { ...(existing.data.metadata ?? {}), reviewed_by_manager: true, no_automatic_release: true }
      })
      .eq("id", payload.id)
      .select("*")
      .single();
    if (update.error || !update.data) return fail("לא ניתן לשמור review כרגע.", 500);
    return ok({ result: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
