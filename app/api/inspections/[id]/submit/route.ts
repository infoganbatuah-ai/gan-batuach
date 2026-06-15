import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { inspectionSubmitSchema, submitInspection } from "@/lib/domain/inspection-engine";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const inspectionEvidenceSignedUrlTtlSeconds = 10 * 60;

function distanceMeters(lat1?: number | null, lng1?: number | null, lat2?: number | null, lng2?: number | null) {
  if ([lat1, lng1, lat2, lng2].some((value) => typeof value !== "number" || !Number.isFinite(value))) return null;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad((lat2 as number) - (lat1 as number));
  const dLng = toRad((lng2 as number) - (lng1 as number));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1 as number)) * Math.cos(toRad(lat2 as number)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function numericOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

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
  const signed = await supabase.storage.from("inspection-reports").createSignedUrl(path, inspectionEvidenceSignedUrlTtlSeconds);
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
    const { data: inspection } = await supabase.from("inspections" as any).select("id, garden_id, weighted_score, critical_failures, violation_count, created_at, completed_at, gardens:garden_id(id,name,city,address,latitude,longitude)").eq("id", id).single();
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
    const documentNumber = `GB-INS-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    const signedAt = new Date().toISOString();
    const signatureUpdate = await supabase.from("inspections" as any).update({
      signature_image: signatureUrl,
      signed_at: signedAt,
      signed_by: profile.id,
      performed_by_user: profile.id,
      performed_by_role: profile.role,
      regulatory_document_number: documentNumber,
      regulatory_locked_at: signedAt,
      regulatory_locked_by: profile.id,
      regulatory_validation: { gps_required: true, human_review_required: true, automatic_decision: false }
    }).eq("id", id).select("id").single();
    if (signatureUpdate.error) {
      console.error("[inspection-submit] inspection signature update failed", { inspection_id: id, inspector_id: profile.id, error: signatureUpdate.error.message });
      return fail("הביקורת נשמרה, אך עדכון החתימה בכרטיס הביקורת נכשל.", 409);
    }
    const garden = (inspection as any)?.gardens;
    const gardenLat = numericOrNull(garden?.latitude);
    const gardenLng = numericOrNull(garden?.longitude);
    const distance = distanceMeters(gardenLat, gardenLng, payload.gps_lat, payload.gps_lng);
    await supabase.from("inspection_gps_validations" as any).insert({
      inspection_id: id,
      garden_id: (inspection as any)?.garden_id,
      inspector_id: profile.id,
      arrived_at: (inspection as any)?.created_at ?? signedAt,
      departed_at: signedAt,
      gps_lat: payload.gps_lat,
      gps_lng: payload.gps_lng,
      garden_lat: gardenLat,
      garden_lng: gardenLng,
      distance_meters: distance,
      validation_result: distance === null ? "pending" : distance <= payload.gps_radius_meters ? "valid" : "suspicious",
      consistency_status: distance === null ? "requires_review" : distance <= payload.gps_radius_meters ? "consistent" : "inconsistent",
      metadata: { radius_meters: payload.gps_radius_meters, document_number: documentNumber }
    });
    await supabase.from("monthly_inspection_cycles" as any).update({
      completion_status: "completed",
      completed_inspection_id: id,
      completed_at: signedAt,
      updated_at: signedAt
    }).eq("garden_id", (inspection as any)?.garden_id).eq("cycle_month", signedAt.slice(0, 7) + "-01");
    const monthStart = signedAt.slice(0, 7) + "-01";
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    await supabase.from("required_inspections" as any).update({
      status: "done",
      inspection_id: id,
      readiness_status: "ready",
      updated_at: signedAt
    }).eq("garden_id", (inspection as any)?.garden_id).gte("due_at", monthStart).lt("due_at", nextMonth.toISOString()).neq("status", "done");
    await supabase.from("regulatory_audit_events" as any).insert({
      actor_profile_id: profile.id,
      actor_role: profile.role,
      garden_id: (inspection as any)?.garden_id,
      inspection_id: id,
      event_type: "inspection_submitted_and_locked",
      event_title: "דוח ביקורת נחתם וננעל",
      event_details: { document_number: documentNumber, gps_distance_meters: distance, human_review_required: true }
    });
    return ok(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inspection submit failed";
    if (message.includes("GPS verification failed") || message.includes("Garden GPS is missing")) {
      return fail(message, 422);
    }
    return handleRouteError(error);
  }
}
