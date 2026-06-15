import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { encryptField, getCurrentKeyVersion, hashForLookup } from "@/lib/security/field-encryption";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  opening_id: z.string().uuid(),
  requested_role: z.string().optional(),
  full_name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  identity_number: z.string().min(5),
  profile_photo_url: z.string().optional(),
  date_of_birth: z.string().optional(),
  previous_kindergarten_experience: z.boolean().optional(),
  previous_kindergarten_name: z.string().optional(),
  work_experience: z.string().optional(),
  document_status: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["staff"]);
    if (!isAdminClientConfigured()) return fail("הגשת מועמדות דורשת Service Role בצד השרת.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const opening = await admin.from("kindergarten_staff_openings" as any)
      .select("id, garden_id, role_needed, active_status")
      .eq("id", payload.opening_id)
      .eq("active_status", "published")
      .maybeSingle();
    if (opening.error || !opening.data) return fail("המשרה לא נמצאה או אינה פתוחה.", 404);
    const identityNumber = payload.identity_number.replace(/\D/g, "");
    const duplicateFlags: string[] = [];
    const existingStaff = await admin.from("staff" as any).select("id", { count: "exact", head: true }).eq("identity_number_hash", hashForLookup(identityNumber));
    if ((existingStaff.count ?? 0) > 0) duplicateFlags.push("staff_identity_number_match");

    await admin.from("staff_candidate_profiles" as any).upsert({
      profile_id: profile.id,
      full_name: payload.full_name,
      phone: payload.phone ?? profile.phone ?? null,
      email: payload.email ?? (profile as any).email ?? null,
      identity_number_hash: hashForLookup(identityNumber),
      profile_photo_url: payload.profile_photo_url ?? null,
      date_of_birth: payload.date_of_birth || null,
      previous_kindergarten_experience: payload.previous_kindergarten_experience ?? false,
      previous_kindergarten_name: payload.previous_kindergarten_name ?? null,
      work_experience: payload.work_experience ?? null,
      document_status: payload.document_status ?? {},
      duplicate_flags: duplicateFlags,
      status: "pending_approval"
    }, { onConflict: "profile_id" });

    const application = await admin.from("staff_job_applications" as any).upsert({
      staff_candidate_id: profile.id,
      garden_id: (opening.data as any).garden_id,
      opening_id: payload.opening_id,
      requested_role: payload.requested_role ?? (opening.data as any).role_needed,
      status: "submitted",
      submitted_at: new Date().toISOString(),
      duplicate_flags: duplicateFlags,
      metadata: {
        identity_number_encrypted: encryptField(identityNumber),
        encryption_version: getCurrentKeyVersion()
      }
    }, { onConflict: "staff_candidate_id,garden_id,opening_id" }).select("*").single();
    if (application.error) return fail(application.error.message, 400);

    await admin.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "staff",
      garden_id: (opening.data as any).garden_id,
      entity_type: "staff_job_applications",
      entity_id: application.data.id,
      action: "staff_application_submitted",
      after_data: { status: "submitted", duplicate_flags: duplicateFlags }
    });

    return ok({ application: application.data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
