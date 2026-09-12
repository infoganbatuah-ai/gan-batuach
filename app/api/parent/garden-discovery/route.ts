import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { findEligibleGardensForChild } from "@/lib/domain/child-garden-discovery";
import { createClient } from "@/lib/supabase/server";

const querySchema = z.object({
  child_id: z.string().uuid(),
  city: z.string().trim().max(120).optional(),
  q: z.string().trim().max(160).optional()
});

export async function GET(request: Request) {
  try {
    const session = await getSessionProfile();
    if (!session.user || !session.profile) return fail("נדרשת התחברות מחדש.", 401);
    if (session.profile.role !== "parent") return fail("המסלול מיועד להורה מורשה בלבד.", 403);
    const url = new URL(request.url);
    const query = querySchema.parse({ child_id: url.searchParams.get("child_id"), city: url.searchParams.get("city") ?? undefined, q: url.searchParams.get("q") ?? undefined });
    const result = await findEligibleGardensForChild(await createClient(), session.profile.id, query.child_id, { city: query.city, query: query.q });
    if (result.kind === "denied") return fail("כרטיס הילד אינו שייך לחשבון שלך.", 403);
    if (result.kind === "error") return fail("לא ניתן לטעון התאמות לגנים כרגע.", 503);
    return ok({ child_id: query.child_id, matches: result.matches, capacity_note: "הזמינות היא מידע בלבד ואינה משריינת מקום." });
  } catch (error) { return handleSafeRouteError(error); }
}
