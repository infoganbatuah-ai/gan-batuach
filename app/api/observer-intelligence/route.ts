import { z } from "zod";
import {
  generateObserverSituationSummaries,
  notifyObserverSummaryReviewers,
  persistObserverSituationSummaries
} from "@/lib/domain/observer-intelligence-engine";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const payloadSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("generate"),
    kindergarten_id: z.string().uuid().optional().nullable(),
    observer_site_id: z.string().uuid().optional().nullable()
  }),
  z.object({
    action: z.literal("review"),
    id: z.string().uuid(),
    status: z.enum(["reviewing", "handled", "dismissed", "escalated", "snoozed"]),
    review_notes: z.string().trim().optional().nullable()
  })
]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner"]);
    const payload = payloadSchema.parse(await request.json());
    const supabase = isAdminClientConfigured() ? createAdminClient() : await createClient();

    if (payload.action === "review") {
      const existing = await supabase.from("observer_situation_summaries" as any).select("*").eq("id", payload.id).single();
      if (existing.error || !existing.data) return fail("סיכום התצפיתן לא נמצא.", 404);
      if (profile.role !== "admin" && existing.data.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לסיכום הזה.", 403);
      const result = await supabase.from("observer_situation_summaries" as any).update({
        status: payload.status,
        reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: { ...(existing.data.metadata ?? {}), reviewed_by_human: true, review_notes: payload.review_notes ?? null }
      }).eq("id", payload.id).select("*").single();
      if (result.error || !result.data) return fail("שמירת review נכשלה.", 500);
      return ok({ summary: result.data });
    }

    const kindergartenId = profile.role === "admin" ? payload.kindergarten_id ?? null : profile.garden_id;
    const observerSiteId = profile.role === "admin" ? payload.observer_site_id ?? null : null;
    if (!kindergartenId && !observerSiteId) return fail("יש לבחור גן או אתר Observer.", 422);
    if (profile.role !== "admin" && payload.kindergarten_id && payload.kindergarten_id !== profile.garden_id) return fail("אין הרשאה לגן הזה.", 403);

    const generated = await generateObserverSituationSummaries(supabase, { kindergartenId, observerSiteId });
    const saved = await persistObserverSituationSummaries(supabase, generated);
    await notifyObserverSummaryReviewers(supabase, saved);
    return ok({ generated: generated.length, saved });
  } catch (error) {
    return handleRouteError(error);
  }
}
