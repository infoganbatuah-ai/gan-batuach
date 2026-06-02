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
    const supabase = await createClient();
    const inspectionLookup = await supabase.from("inspections" as any).select("id, inspector_id, garden_id").eq("id", id).maybeSingle();
    if (inspectionLookup.error || !inspectionLookup.data) return fail("ביקורת לא נמצאה.", 404);
    if (profile.role === "inspector" && (inspectionLookup.data as any).inspector_id !== profile.id) return fail("אין הרשאה להגיש ביקורת שאינה משויכת אליך.", 403);
    const result = await submitInspection(id, payload);
    const signatureUrl = await uploadSignatureIfPossible(id, payload.signature_image);
    const { data: inspection } = await supabase.from("inspections" as any).select("id, garden_id, weighted_score, critical_failures, violation_count, gardens:garden_id(id,name,city,address)").eq("id", id).single();
    const signatureInsert = await supabase.from("inspection_signatures" as any).insert({
      inspection_id: id,
      signature_image: signatureUrl,
      signed_by: profile.id,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      inspector_details: { id: profile.id, full_name: profile.full_name, role: profile.role },
      kindergarten_details: inspection?.gardens ?? {},
      result_snapshot: { weighted_score: inspection?.weighted_score, critical_failures: inspection?.critical_failures, violation_count: inspection?.violation_count }
    });
    if (signatureInsert.error) {
      console.error("[inspection-submit] signature insert failed", { inspection_id: id, inspector_id: profile.id, error: signatureInsert.error.message });
      return fail("הביקורת נשמרה, אך חתימת הפקח לא נשמרה. יש לפתוח את הדוח ולבדוק חתימה לפני סגירה מלאה.", 409);
    }
    const signatureUpdate = await supabase.from("inspections" as any).update({ signature_image: signatureUrl, signed_at: new Date().toISOString(), signed_by: profile.id, performed_by_user: profile.id, performed_by_role: profile.role }).eq("id", id).select("id").single();
    if (signatureUpdate.error) {
      console.error("[inspection-submit] inspection signature update failed", { inspection_id: id, inspector_id: profile.id, error: signatureUpdate.error.message });
      return fail("הביקורת נשמרה, אך עדכון החתימה בכרטיס הביקורת נכשל.", 409);
    }
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection submit failed";
    if (message.includes("GPS verification failed") || message.includes("Garden GPS is missing")) {
      return fail(message, 422);
    }
    return handleRouteError(error);
  }
}
