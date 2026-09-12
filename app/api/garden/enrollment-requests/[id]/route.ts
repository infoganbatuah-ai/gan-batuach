import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getManagementGardenContext } from "@/lib/management/garden-context";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["review","request_information","approve","reject","waitlist","cancel"]),
  decision_reason: z.string().trim().max(4000).optional(),
  assigned_classroom_id: z.string().uuid().optional(),
  assigned_class_id: z.string().uuid().optional()
});

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext(); if (!access.allowed) return access.response;
    const { id } = await params;
    const result = await (await createClient()).from("kindergarten_enrollment_requests" as never)
      .select("id,parent_id,child_profile_id,garden_id,requested_classroom_id,status,requested_at,reviewed_at,decision_reason,information_request,information_response,reservation_id,payment_status,permanent_child_files:child_profile_id(full_name,birth_date),profiles:parent_id(full_name,phone,email),classrooms:requested_classroom_id(id,name,age_group_label,capacity_limit)" as never)
      .eq("id", id).eq("garden_id", access.gardenId).maybeSingle();
    if (result.error || !result.data) return fail("בקשת ההצטרפות לא נמצאה בגן שלך.", 404);
    return ok({ enrollment_request: result.data });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getManagementGardenContext(); if (!access.allowed) return access.response;
    const { id } = await params; const payload = schema.parse(await request.json());
    const supabase = await createClient();
    const target = await supabase.from("kindergarten_enrollment_requests" as never)
      .select("id" as never).eq("id", id).eq("garden_id", access.gardenId).maybeSingle();
    if (target.error || !target.data) return fail("בקשת ההצטרפות לא נמצאה בגן הפעיל.", 404);
    const result = await supabase.rpc("decide_enrollment_request" as never, {
      target_request_id: id,target_action: payload.action,
      target_classroom_id: payload.assigned_classroom_id ?? payload.assigned_class_id ?? null,
      target_reason: payload.decision_reason ?? null
    } as never);
    if (result.error) {
      const status = result.error.code === "42501" ? 403 : result.error.message.includes("not_found") ? 404 : 409;
      return fail(result.error.message.includes("capacity_unavailable") ? "אין מקום פנוי בכיתה שנבחרה." : "לא ניתן לבצע את מעבר המצב המבוקש.", status);
    }
    return ok(result.data);
  } catch (error) { return handleSafeRouteError(error); }
}
