import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { fail, handleRouteError, ok } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { encryptField, getCurrentKeyVersion } from "@/lib/security/field-encryption";
import { deviceFingerprint, firstForwardedIp, requestId, writeMedicalAccessEvent } from "@/lib/security/audit-log-service";

const healthSchema = z.object({
  garden_id: z.string().uuid(),
  child_id: z.string().uuid(),
  hmo: z.string().optional(),
  allergies: z.string().optional(),
  sensitivities: z.string().optional(),
  medications: z.string().optional(),
  emergency_contacts: z.array(z.object({ name: z.string(), phone: z.string().optional(), relation: z.string().optional() })).default([]),
  medication_approval_url: z.string().optional(),
  medication_approval_expires_at: z.string().optional(),
  medical_notes: z.string().optional(),
  missing_info: z.boolean().optional(),
  allergy_warning: z.boolean().optional(),
  medication_due_at: z.string().optional()
});

export async function GET(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff", "parent", "inspector"]);
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const gardenId = searchParams.get("garden_id");
    const childId = searchParams.get("child_id");
    let query = supabase.from("child_health_records" as any).select("*, children(full_name, photo_url, allergies, regular_medications)").limit(100);
    if (gardenId) query = query.eq("garden_id", gardenId);
    if (childId) query = query.eq("child_id", childId);
    const { data, error } = await query;
    if (error) {
      console.error("[child-health-records:get]", error);
      return fail("לא ניתן לטעון מידע רפואי כרגע", 400);
    }
    await writeMedicalAccessEvent({
      actorProfileId: profile.id,
      actorRole: profile.role,
      childId,
      gardenId: gardenId ?? profile.garden_id ?? null,
      fieldAccessed: "child_health_records",
      action: "view",
      ipAddress: firstForwardedIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      deviceFingerprint: deviceFingerprint(request.headers),
      requestId: requestId(request.headers),
      reason: "api_read"
    });
    return ok(data ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin", "manager", "owner", "staff", "parent"]);
    const payload = healthSchema.parse(await request.json());
    if (profile.role !== "admin" && profile.garden_id !== payload.garden_id) return fail("אין הרשאה לעדכן מידע רפואי של גן אחר", 403);
    const supabase = await createClient();
    const missingInfo = payload.missing_info ?? !(payload.hmo && payload.emergency_contacts.length);
    const allergyWarning = payload.allergy_warning ?? Boolean(payload.allergies?.trim());
    const encryptedPayload = {
      ...payload,
      allergies_encrypted: encryptField(payload.allergies),
      sensitivities_encrypted: encryptField(payload.sensitivities),
      medications_encrypted: encryptField(payload.medications),
      medical_notes_encrypted: encryptField(payload.medical_notes),
      emergency_contacts_encrypted: encryptField(payload.emergency_contacts),
      medication_approval_url_encrypted: encryptField(payload.medication_approval_url),
      encryption_status: "encrypted",
      encrypted_at: new Date().toISOString(),
      encryption_version: getCurrentKeyVersion(),
      missing_info: missingInfo,
      allergy_warning: allergyWarning,
      updated_by: profile.id
    };
    const { data, error } = await supabase.from("child_health_records" as any).upsert(encryptedPayload, { onConflict: "child_id" }).select("*").single();
    if (error) {
      console.error("[child-health-records:post]", error);
      return fail("לא ניתן לשמור מידע רפואי כרגע", 400);
    }
    await writeMedicalAccessEvent({
      actorProfileId: profile.id,
      actorRole: profile.role,
      childId: payload.child_id,
      gardenId: payload.garden_id,
      fieldAccessed: "child_health_records",
      action: "update",
      ipAddress: firstForwardedIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      deviceFingerprint: deviceFingerprint(request.headers),
      requestId: requestId(request.headers),
      reason: "api_write"
    });
    return ok(data, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
