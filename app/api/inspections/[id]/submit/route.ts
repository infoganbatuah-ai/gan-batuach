import { getOperationalRoleContext } from "@/lib/management/operational-role";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionSubmitSchema } from "@/lib/domain/inspection-engine";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const access = await getOperationalRoleContext(["inspector"]);
    if (!access.allowed) return access.response;
    const { id } = await params;
    const payload = inspectionSubmitSchema.parse(await request.json());
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("complete_monthly_inspection" as never, {
      p_inspection_id: id,
      p_answers: payload.answers,
      p_gps_lat: payload.gps_lat,
      p_gps_lng: payload.gps_lng,
      p_gps_radius_meters: payload.gps_radius_meters,
      p_signature_image: payload.signature_image
    } as never);
    if (error) return fail(error.message, error.code === "42501" ? 403 : 422);
    return ok(data);
  } catch (error) { return handleRouteError(error); }
}
