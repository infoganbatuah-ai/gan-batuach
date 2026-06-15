import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { encryptField, getCurrentKeyVersion, hashForLookup } from "@/lib/security/field-encryption";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  child_first_name: z.string().min(2),
  child_last_name: z.string().min(2),
  identity_number: z.string().min(5),
  birth_date: z.string().optional(),
  gender: z.string().optional(),
  allergies: z.string().optional(),
  medical_notes: z.string().optional(),
  important_notes: z.string().optional(),
  photo_url: z.string().optional(),
  address: z.string().optional(),
  mother_name: z.string().optional(),
  mother_phone: z.string().optional(),
  father_name: z.string().optional(),
  father_phone: z.string().optional(),
  emergency_contacts: z.array(z.object({ name: z.string(), phone: z.string().optional(), relation: z.string().optional() })).default([]),
  pickup_authorized: z.array(z.object({ name: z.string(), phone: z.string().optional(), relation: z.string().optional(), identity_number: z.string().optional() })).default([])
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!isAdminClientConfigured()) return fail("יצירת כרטיס ילד עצמאי דורשת Service Role בצד השרת.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const identityNumber = payload.identity_number.replace(/\D/g, "");
    const duplicateFlags: string[] = [];
    if (identityNumber) {
      const existing = await admin.from("permanent_child_files" as any).select("id", { count: "exact", head: true }).eq("identity_number", identityNumber);
      if ((existing.count ?? 0) > 0) duplicateFlags.push("child_identity_number_match");
    }

    const fullName = `${payload.child_first_name} ${payload.child_last_name}`.trim();
    const write = await admin.from("permanent_child_files" as any).insert({
      primary_parent_profile_id: profile.id,
      full_name: fullName,
      child_first_name: payload.child_first_name,
      child_last_name: payload.child_last_name,
      identity_number: identityNumber,
      identity_number_encrypted: encryptField(identityNumber),
      identity_number_hash: hashForLookup(identityNumber),
      birth_date: payload.birth_date || null,
      gender: payload.gender || null,
      allergies: payload.allergies || null,
      allergies_encrypted: encryptField(payload.allergies || null),
      medical_notes: payload.medical_notes || null,
      medical_notes_encrypted: encryptField(payload.medical_notes || null),
      important_notes: payload.important_notes || null,
      photo_url: payload.photo_url || null,
      address: payload.address || null,
      father_details: { name: payload.father_name ?? null, phone: payload.father_phone ?? null },
      mother_details: { name: payload.mother_name ?? null, phone: payload.mother_phone ?? null },
      emergency_contacts: payload.emergency_contacts,
      pickup_authorized: payload.pickup_authorized,
      pickup_authorized_encrypted: encryptField(payload.pickup_authorized),
      source: "self_service_parent",
      owner_status: "active",
      duplicate_flags: duplicateFlags,
      encryption_version: getCurrentKeyVersion()
    }).select("id, full_name, duplicate_flags").single();
    if (write.error) return fail(write.error.message, 400);

    await admin.from("self_service_user_profiles" as any).upsert({
      profile_id: profile.id,
      requested_role: "parent",
      status: "pending_affiliation",
      full_name: profile.full_name,
      phone: profile.phone,
      email: (profile as any).email ?? null
    }, { onConflict: "profile_id" });
    await admin.from("audit_logs" as any).insert({
      actor_id: profile.id,
      actor_role: "parent",
      entity_type: "permanent_child_files",
      entity_id: write.data.id,
      action: "self_service_child_profile_created",
      after_data: { duplicate_flags: duplicateFlags }
    });

    return ok({ child_profile: write.data }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
