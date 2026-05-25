import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionSubmitSchema, submitInspection } from "@/lib/domain/inspection-engine";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function uploadSignatureIfPossible(inspectionId: string, signatureImage: string) {
  if (!signatureImage.startsWith("data:") || !isAdminClientConfigured()) return signatureImage;
  const match = signatureImage.match(/^data:(.+);base64,(.+)$/);
  if (!match) return signatureImage;
  const [, mimeType, base64] = match;
  const extension = mimeType.includes("png") ? "png" : "jpg";
  const path = `signatures/${inspectionId}/${Date.now()}.${extension}`;
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from("inspection-reports").upload(path, Buffer.from(base64, "base64"), { contentType: mimeType, upsert: true });
  if (error) return signatureImage;
  const signed = await supabase.storage.from("inspection-reports").createSignedUrl(path, 60 * 60 * 24 * 365);
  return signed.data?.signedUrl ?? signatureImage;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["admin", "inspector"]);
    const { id } = await params;
    const payload = inspectionSubmitSchema.parse(await request.json());
    const result = await submitInspection(id, payload);
    const signatureUrl = await uploadSignatureIfPossible(id, payload.signature_image);
    const supabase = await createClient();
    const { data: inspection } = await supabase.from("inspections" as any).select("id, garden_id, weighted_score, critical_failures, violation_count, gardens:garden_id(id,name,city,address)").eq("id", id).single();
    await supabase.from("inspection_signatures" as any).insert({
      inspection_id: id,
      signature_image: signatureUrl,
      signed_by: profile.id,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      inspector_details: { id: profile.id, full_name: profile.full_name, role: profile.role },
      kindergarten_details: inspection?.gardens ?? {},
      result_snapshot: { weighted_score: inspection?.weighted_score, critical_failures: inspection?.critical_failures, violation_count: inspection?.violation_count }
    });
    await supabase.from("inspections" as any).update({ signature_image: signatureUrl, signed_at: new Date().toISOString(), signed_by: profile.id, performed_by_user: profile.id, performed_by_role: profile.role }).eq("id", id);
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection submit failed";
    if (message.includes("GPS verification failed") || message.includes("Garden GPS is missing")) {
      return fail(message, 422);
    }
    return handleRouteError(error);
  }
}
