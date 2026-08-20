import { encryptField, getCurrentKeyVersion, hashForLookup } from "@/lib/security/field-encryption";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function activateKindergartenEnrollment(admin: AdminClient, request: any, actor: { id: string }, options: { assigned_age_group?: string | null; assigned_class_id?: string | null; source?: string; invitation_status?: string } = {}) {
  const [childFileRes, parentProfileRes] = await Promise.all([
    admin.from("permanent_child_files" as any).select("*").eq("id", request.child_profile_id).maybeSingle(),
    admin.from("profiles" as any).select("id, full_name, phone, email").eq("id", request.parent_id).maybeSingle()
  ]);
  if (!childFileRes.data || !parentProfileRes.data) throw new Error("לא נמצאו פרטי ילד/הורה להפעלה.");

  const childFile = childFileRes.data as any;
  const parentProfile = parentProfileRes.data as any;
  const now = new Date().toISOString();
  const existingParent = await admin.from("parents" as any)
    .select("id")
    .eq("profile_id", request.parent_id)
    .eq("garden_id", request.garden_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const parentPayload = {
    profile_id: request.parent_id,
    user_id: request.parent_id,
    garden_id: request.garden_id,
    full_name: parentProfile.full_name,
    phone: parentProfile.phone ?? "",
    email: parentProfile.email ?? null,
    address: childFile.address ?? null,
    completed_profile: true,
    status: "active",
    onboarding_status: "active",
    invitation_status: options.invitation_status ?? "self_service_approved",
    activated_at: now
  };
  const parentWrite = existingParent.data?.id
    ? await admin.from("parents" as any).update(parentPayload).eq("id", existingParent.data.id).select("*").single()
    : await admin.from("parents" as any).insert(parentPayload).select("*").single();
  if (parentWrite.error) throw new Error(parentWrite.error.message);

  const existingChild = await admin.from("children" as any)
    .select("id")
    .eq("garden_id", request.garden_id)
    .eq("permanent_child_file_id", childFile.id)
    .maybeSingle();
  let childId = existingChild.data?.id as string | undefined;
  if (!childId) {
    const childWrite = await admin.from("children" as any).insert({
      garden_id: request.garden_id,
      primary_parent_id: parentWrite.data.id,
      permanent_child_file_id: childFile.id,
      full_name: childFile.full_name,
      birth_date: childFile.birth_date ?? null,
      identity_number: childFile.identity_number ?? null,
      identity_number_encrypted: childFile.identity_number ? encryptField(childFile.identity_number) : childFile.identity_number_encrypted ?? null,
      identity_number_hash: childFile.identity_number ? hashForLookup(childFile.identity_number) : childFile.identity_number_hash ?? null,
      photo_url: childFile.photo_url ?? null,
      face_image_url: childFile.face_image_url ?? childFile.photo_url ?? null,
      age_group: options.assigned_age_group ?? request.requested_age_group ?? null,
      classroom: options.assigned_age_group ?? request.requested_age_group ?? null,
      payment_group_id: options.assigned_class_id ?? request.requested_class_id ?? null,
      monthly_fee: request.published_price_snapshot ?? null,
      allergies: childFile.allergies ?? null,
      allergies_encrypted: childFile.allergies ? encryptField(childFile.allergies) : childFile.allergies_encrypted ?? null,
      medical_notes: childFile.medical_notes ?? null,
      medical_notes_encrypted: childFile.medical_notes ? encryptField(childFile.medical_notes) : childFile.medical_notes_encrypted ?? null,
      important_notes: childFile.important_notes ?? null,
      address: childFile.address ?? null,
      mother_name: childFile.mother_details?.name ?? null,
      mother_phone: childFile.mother_details?.phone ?? null,
      father_name: childFile.father_details?.name ?? null,
      father_phone: childFile.father_details?.phone ?? null,
      emergency_phone: childFile.emergency_contacts?.[0]?.phone ?? null,
      pickup_authorized: childFile.pickup_authorized ?? [],
      pickup_authorized_encrypted: encryptField(childFile.pickup_authorized ?? []),
      status: "active",
      parent_completed: true,
      manager_approved_at: now,
      encryption_version: getCurrentKeyVersion()
    }).select("id").single();
    if (childWrite.error) throw new Error(childWrite.error.message);
    childId = childWrite.data.id as string;
  }

  const activationWrites = await Promise.all([
    admin.from("parent_kindergarten_links" as any).upsert({
      parent_id: parentWrite.data.id,
      parent_profile_id: request.parent_id,
      garden_id: request.garden_id,
      status: "active",
      source: options.source ?? "self_service_enrollment",
      approved_at: now,
      approved_by: actor.id
    }, { onConflict: "parent_profile_id,garden_id" }),
    admin.from("profiles" as any).update({ active: true, self_service_status: "active", self_service_approved_at: now, self_service_approved_by: actor.id }).eq("id", request.parent_id),
    admin.from("permanent_child_files" as any).update({ owner_status: "submitted" }).eq("id", childFile.id),
    admin.from("child_kindergarten_enrollments" as any).upsert({
      child_id: childId,
      permanent_child_file_id: childFile.id,
      garden_id: request.garden_id,
      status: "active",
      start_date: now.slice(0, 10),
      age_group_id: options.assigned_class_id ?? request.requested_class_id ?? null,
      classroom_name: options.assigned_age_group ?? request.requested_age_group ?? null,
      manager_approved_at: now,
      manager_approved_by: actor.id,
      updated_at: now
    }, { onConflict: "child_id,garden_id" }),
    admin.from("child_timeline_events" as any).insert({
      child_id: childId,
      permanent_child_file_id: childFile.id,
      garden_id: request.garden_id,
      actor_id: actor.id,
      actor_role: options.source === "kindergarten_invitation_parent_accepted" ? "parent" : "manager",
      event_type: "kindergarten_enrollment_activated",
      title: "הילד/ה שויך/ה לגן",
      description: options.source === "kindergarten_invitation_parent_accepted"
        ? "ההורה אישר הזמנה שנשלחה מהגן."
        : "מנהלת הגן אישרה בקשת הצטרפות של ההורה.",
      metadata: { source: options.source ?? "self_service_enrollment", enrollment_request_id: request.id ?? null }
    })
  ]);

  const failedWrite = activationWrites.find((result: any) => result?.error);
  if (failedWrite?.error) {
    throw new Error(`Kindergarten enrollment activation failed: ${failedWrite.error.message}`);
  }

  return childId;
}
