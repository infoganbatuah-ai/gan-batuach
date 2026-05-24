import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionSubmitSchema, submitInspection } from "@/lib/domain/inspection-engine";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "inspector"]);
    const { id } = await params;
    const payload = inspectionSubmitSchema.parse(await request.json());
    const result = await submitInspection(id, payload);
    const supabase = await createClient();
    const { data: inspection } = await supabase.from("inspections" as any).select("id, garden_id, weighted_score, critical_failures, violation_count, gardens:garden_id(id,name,city,address)").eq("id", id).single();
    await supabase.from("inspection_signatures" as any).insert({
      inspection_id: id,
      signature_image: payload.signature_image,
      signed_by: profile.id,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      inspector_details: { id: profile.id, full_name: profile.full_name, role: profile.role },
      kindergarten_details: inspection?.gardens ?? {},
      result_snapshot: { weighted_score: inspection?.weighted_score, critical_failures: inspection?.critical_failures, violation_count: inspection?.violation_count }
    });
    await supabase.from("inspections" as any).update({ signature_image: payload.signature_image, signed_at: new Date().toISOString(), signed_by: profile.id, performed_by_user: profile.id, performed_by_role: profile.role }).eq("id", id);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection submit failed";
    if (message.includes("GPS verification failed") || message.includes("Garden GPS is missing")) {
      return fail(message, 422);
    }
    return handleRouteError(error);
  }
}
