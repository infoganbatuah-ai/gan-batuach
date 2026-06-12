import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { getParentFamilyContext } from "@/lib/domain/parent-family";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["feedback", "request", "survey_response", "participation"]),
  feedback_type: z.enum(["suggestion", "compliment", "concern", "complaint"]).optional(),
  request_type: z.enum(["document_request", "information_request", "meeting_request"]).optional(),
  participation_type: z.enum(["event_participation", "volunteering", "activity_involvement"]).optional(),
  title: z.string().trim().min(2).optional(),
  body: z.string().trim().optional(),
  survey_id: z.string().uuid().optional(),
  calendar_event_id: z.string().uuid().optional(),
  response_data: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const family = await getParentFamilyContext(supabase as any, profile);
    const gardenId = family.gardenIds[0] ?? profile.garden_id;
    if (!gardenId) return fail("לא נמצא גן משויך", 422);

    if (payload.action === "feedback") {
      const { data, error } = await supabase.from("parent_feedback_items" as any).insert({
        garden_id: gardenId,
        parent_profile_id: profile.id,
        feedback_type: payload.feedback_type ?? "suggestion",
        title: payload.title ?? "משוב הורה",
        body: payload.body ?? null,
        priority: payload.feedback_type === "concern" || payload.feedback_type === "complaint" ? "important" : "normal"
      }).select("*").single();
      if (error) return fail("לא ניתן לשלוח משוב כרגע", 400);
      revalidatePath("/dashboard/parent/trust-center");
      return ok(data, 201);
    }

    if (payload.action === "request") {
      const { data, error } = await supabase.from("parent_request_center_items" as any).insert({
        garden_id: gardenId,
        parent_profile_id: profile.id,
        request_type: payload.request_type ?? "information_request",
        title: payload.title ?? "בקשת הורה",
        body: payload.body ?? null
      }).select("*").single();
      if (error) return fail("לא ניתן לשלוח בקשה כרגע", 400);
      revalidatePath("/dashboard/parent/trust-center");
      return ok(data, 201);
    }

    if (payload.action === "survey_response") {
      if (!payload.survey_id) return fail("חסר סקר", 422);
      const { data, error } = await supabase.from("parent_survey_responses" as any).insert({
        survey_id: payload.survey_id,
        garden_id: gardenId,
        parent_profile_id: profile.id,
        response_data: payload.response_data ?? {}
      }).select("*").single();
      if (error) return fail("לא ניתן לשמור מענה לסקר", 400);
      revalidatePath("/dashboard/parent/trust-center");
      return ok(data, 201);
    }

    if (payload.action === "participation") {
      const { data, error } = await supabase.from("parent_participation_items" as any).insert({
        garden_id: gardenId,
        parent_profile_id: profile.id,
        calendar_event_id: payload.calendar_event_id ?? null,
        participation_type: payload.participation_type ?? "event_participation",
        notes: payload.body ?? null
      }).select("*").single();
      if (error) return fail("לא ניתן לשמור השתתפות", 400);
      revalidatePath("/dashboard/parent/trust-center");
      return ok(data, 201);
    }

    return fail("פעולה לא נתמכת", 422);
  } catch (error) {
    return handleRouteError(error);
  }
}
