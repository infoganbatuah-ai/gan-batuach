import { z } from "zod";
import { fail, handleSafeRouteError, ok } from "@/lib/api";
import { getSessionProfile } from "@/lib/auth";
import { managementContactVerification } from "@/lib/management/contact-verification";
import { guardianChildIds } from "@/lib/management/family-link";
import { createClient } from "@/lib/supabase/server";

const submitSchema = z.object({
  child_profile_id: z.string().uuid(), garden_id: z.string().uuid(),
  requested_age_group: z.string().trim().max(120).optional(),
  requested_classroom_id: z.string().uuid().optional(),
  requested_class_id: z.string().uuid().optional(),
  parent_message: z.string().trim().max(2000).optional()
});
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("respond_information"), request_id: z.string().uuid(), response: z.string().trim().min(1).max(4000) }),
  z.object({ action: z.literal("cancel"), request_id: z.string().uuid() })
]);

async function requireParent() {
  const session = await getSessionProfile();
  if (!session.user || !session.profile) return { response: fail("נדרשת התחברות מחדש.", 401) } as const;
  if (session.profile.role !== "parent") return { response: fail("המסלול מיועד להורה מורשה בלבד.", 403) } as const;
  return { session } as const;
}

export async function GET() {
  try {
    const access = await requireParent(); if ("response" in access) return access.response;
    const supabase = await createClient();
    const childIds = await guardianChildIds(supabase, access.session.profile.id);
    if (!childIds.length) return ok({ requests: [] });
    const result = await supabase.from("kindergarten_enrollment_requests" as never)
      .select("id,child_profile_id,garden_id,requested_classroom_id,status,requested_at,reviewed_at,decision_reason,information_request,information_response,information_requested_at,information_responded_at,reservation_id,payment_status,cancelled_at,gardens(name,city),classrooms:requested_classroom_id(name,age_group_label)" as never)
      .eq("parent_id", access.session.profile.id).in("child_profile_id", childIds).order("created_at", { ascending: false });
    if (result.error) return fail("לא ניתן לטעון בקשות הצטרפות.", 503);
    return ok({ requests: result.data ?? [] });
  } catch (error) { return handleSafeRouteError(error); }
}

export async function POST(request: Request) {
  try {
    const access = await requireParent(); if ("response" in access) return access.response;
    const { user, profile } = access.session;
    if (!managementContactVerification(user, profile).complete) return fail("יש להשלים אימות דוא״ל וטלפון לפני שליחת בקשה.", 403);
    const payload = submitSchema.parse(await request.json());
    const result = await (await createClient()).rpc("submit_enrollment_request" as never, {
      target_child_file_id: payload.child_profile_id,target_garden_id: payload.garden_id,
      target_classroom_id: payload.requested_classroom_id ?? null,target_age_group: payload.requested_age_group ?? null,
      target_parent_message: payload.parent_message ?? null
    } as never);
    if (result.error) return fail("לא ניתן להגיש את בקשת ההצטרפות במצב הנוכחי.", result.error.code === "42501" ? 403 : 409);
    return ok({ enrollment_request: result.data }, 201);
  } catch (error) { return handleSafeRouteError(error); }
}

export async function PATCH(request: Request) {
  try {
    const access = await requireParent(); if ("response" in access) return access.response;
    const payload = actionSchema.parse(await request.json());
    const supabase = await createClient();
    const result = payload.action === "respond_information"
      ? await supabase.rpc("respond_enrollment_information" as never, { target_request_id: payload.request_id, target_response: payload.response } as never)
      : await supabase.rpc("cancel_parent_enrollment_request" as never, { target_request_id: payload.request_id } as never);
    if (result.error) return fail("לא ניתן לעדכן את בקשת ההצטרפות.", result.error.code === "42501" ? 403 : 409);
    return ok({ enrollment_request: result.data });
  } catch (error) { return handleSafeRouteError(error); }
}
