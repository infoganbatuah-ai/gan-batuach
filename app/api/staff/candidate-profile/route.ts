import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  city: z.string().trim().min(2).max(100),
  professional_role: z.string().trim().min(2).max(100),
  qualification_keys: z.array(z.string().trim().min(2).max(100)).max(12),
  availability: z.object({ days: z.array(z.string().trim().min(2).max(30)).max(7), notes: z.string().trim().max(500).optional() }),
  preferred_age_groups: z.array(z.string().trim().min(1).max(100)).max(12),
  employment_preference: z.string().trim().max(100).optional(),
  professional_summary: z.string().trim().max(1500).optional(),
  matching_paused: z.boolean().optional()
});

export async function GET() {
  try {
    const { profile } = await requireRole(["staff"]);
    const supabase = await createClient();
    const [candidate, evaluation] = await Promise.all([
      supabase.from("staff_candidate_profiles" as never).select("profile_id,city,professional_role,qualification_keys,availability,preferred_age_groups,employment_preference,professional_summary,matching_paused,profile_completeness,status" as never).eq("profile_id", profile.id).maybeSingle(),
      supabase.rpc("evaluate_staff_candidate_profile", { target_profile_id: profile.id })
    ]);
    if (evaluation.error) return fail("לא ניתן להעריך את פרופיל המועמד/ת כעת.", 503);
    return ok({ profile: candidate.data, completeness: evaluation.data });
  } catch (error) { return handleRouteError(error); }
}

export async function PATCH(request: Request) {
  try {
    await requireRole(["staff"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const result = await supabase.rpc("save_staff_candidate_profile", {
      target_full_name: "", target_city: payload.city, target_professional_role: payload.professional_role,
      target_qualification_keys: payload.qualification_keys, target_availability: payload.availability,
      target_preferred_age_groups: payload.preferred_age_groups, target_employment_preference: payload.employment_preference ?? null,
      target_professional_summary: payload.professional_summary ?? null, target_matching_paused: payload.matching_paused ?? false
    });
    if (result.error) return fail("שמירת פרופיל המועמד/ת נכשלה.", 400);
    return ok(result.data);
  } catch (error) { return handleRouteError(error); }
}
