import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const feedbackSchema = z.object({
  category: z.enum([
    "onboarding",
    "dashboard",
    "cameras",
    "observer",
    "finance",
    "staff",
    "children",
    "parent_experience",
    "inspections",
    "performance",
    "ux",
    "reliability",
    "confusion",
    "missing_feature",
    "bug_report",
    "feature_request"
  ]).default("dashboard"),
  sentiment: z.enum(["easy", "confusing", "neutral"]).default("neutral"),
  rating: z.number().int().min(-1).max(5).default(0),
  comment: z.string().trim().max(1200).optional().nullable(),
  page_path: z.string().trim().max(500).optional().nullable(),
  severity: z.enum(["critical", "major", "minor"]).default("minor")
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireUser();
    const payload = feedbackSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.from("pilot_feedback" as any).insert({
      profile_id: profile.id,
      user_role: profile.role,
      garden_id: profile.garden_id ?? null,
      category: payload.category,
      sentiment: payload.sentiment,
      rating: payload.rating,
      comment: payload.comment || null,
      page_path: payload.page_path || null,
      severity: payload.severity,
      status: "open",
      metadata: {
        source: "dashboard_widget",
        submitted_at: new Date().toISOString()
      }
    }).select("id, status").single();
    if (error || !data) {
      console.error("[pilot-feedback-submit]", { profile_id: profile.id, role: profile.role, message: error?.message });
      return fail("לא ניתן לשמור את המשוב כרגע. נסו שוב בעוד רגע.", 500);
    }
    return ok({ feedback: data });
  } catch (error) {
    return handleRouteError(error);
  }
}
