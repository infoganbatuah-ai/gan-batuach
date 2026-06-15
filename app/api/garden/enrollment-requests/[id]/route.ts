import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { encryptField, getCurrentKeyVersion, hashForLookup } from "@/lib/security/field-encryption";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";

const schema = z.object({
  action: z.enum(["under_review", "request_more_information", "approve_pending_payment", "approve_without_payment", "mark_payment_paid", "reject"]),
  decision_reason: z.string().optional(),
  assigned_age_group: z.string().optional(),
  assigned_class_id: z.string().uuid().optional()
});

async function activateEnrollment(admin: ReturnType<typeof createAdminClient>, request: any, manager: any, payload: z.infer<typeof schema>) {
  const [childFileRes, parentProfileRes] = await Promise.all([
    admin.from("permanent_child_files" as any).select("*").eq("id", request.child_profile_id).maybeSingle(),
    admin.from("profiles" as any).select("id, full_name, phone, email").eq("id", request.parent_id).maybeSingle()
  ]);
  if (!childFileRes.data || !parentProfileRes.data) {
    throw new Error("לא נמצאו פרטי ילד/הורה להפעלה.");
  }
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
    invitation_status: "self_service_approved",
    activated_at: now
  };
  const parentWrite = existingParent.data?.id
    ? await admin.from("parents" as any).update(parentPayload).eq("id", existingParent.data.id).select("*").single()
    : await admin.from("parents" as any).insert(parentPayload).select("*").single();
  if (parentWrite.error) throw new Error(parentWrite.error.message);

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
    age_group: payload.assigned_age_group ?? request.requested_age_group ?? null,
    classroom: payload.assigned_age_group ?? request.requested_age_group ?? null,
    payment_group_id: payload.assigned_class_id ?? request.requested_class_id ?? null,
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

  await Promise.all([
    admin.from("parent_kindergarten_links" as any).upsert({
      parent_id: parentWrite.data.id,
      parent_profile_id: request.parent_id,
      garden_id: request.garden_id,
      status: "active",
      source: "self_service_enrollment",
      approved_at: now,
      approved_by: manager.id
    }, { onConflict: "parent_profile_id,garden_id" }),
    admin.from("profiles" as any).update({
      garden_id: request.garden_id,
      active: true,
      self_service_status: "active",
      self_service_approved_at: now,
      self_service_approved_by: manager.id
    }).eq("id", request.parent_id),
    admin.from("permanent_child_files" as any).update({ owner_status: "submitted" }).eq("id", childFile.id)
  ]);

  return childWrite.data.id as string;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("המנהל/ת לא משויך/ת לגן.", 422);
    if (!isAdminClientConfigured()) return fail("אישור בקשות דורש Service Role בצד השרת.", 503);
    const { id } = await params;
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const requestRes = await admin.from("kindergarten_enrollment_requests" as any)
      .select("*")
      .eq("id", id)
      .eq("garden_id", profile.garden_id)
      .maybeSingle();
    if (requestRes.error || !requestRes.data) return fail("בקשת ההצטרפות לא נמצאה בגן שלך.", 404);

    const now = new Date().toISOString();
    let status = requestRes.data.status as string;
    let paymentStatus = requestRes.data.payment_status as string;
    let activatedChildId: string | null = null;
    if (payload.action === "under_review") status = "under_review";
    if (payload.action === "request_more_information") status = "more_information_requested";
    if (payload.action === "reject") status = "rejected";
    if (payload.action === "approve_pending_payment") {
      status = "approved_pending_payment";
      paymentStatus = "pending";
    }
    if (payload.action === "approve_without_payment" || payload.action === "mark_payment_paid") {
      status = "approved";
      paymentStatus = payload.action === "mark_payment_paid" ? "paid" : "waived";
      activatedChildId = await activateEnrollment(admin, requestRes.data, profile, payload);
    }

    const update = await admin.from("kindergarten_enrollment_requests" as any).update({
      status,
      manager_decision: payload.action,
      decision_reason: payload.decision_reason ?? null,
      decided_at: ["reject", "approve_pending_payment", "approve_without_payment", "mark_payment_paid"].includes(payload.action) ? now : requestRes.data.decided_at,
      payment_status: paymentStatus,
      activated_at: activatedChildId ? now : requestRes.data.activated_at,
      activated_child_id: activatedChildId ?? requestRes.data.activated_child_id,
      metadata: {
        ...(requestRes.data.metadata ?? {}),
        assigned_age_group: payload.assigned_age_group ?? requestRes.data.requested_age_group,
        assigned_class_id: payload.assigned_class_id ?? requestRes.data.requested_class_id
      }
    }).eq("id", id).select("*").single();
    if (update.error) return fail(update.error.message, 400);

    await Promise.all([
      admin.from("notifications" as any).insert({
        garden_id: profile.garden_id,
        recipient_id: requestRes.data.parent_id,
        recipient_role: "parent",
        title: status === "rejected" ? "בקשת ההצטרפות נדחתה" : status === "approved_pending_payment" ? "הבקשה אושרה וממתינה לתשלום" : status === "approved" ? "הילד/ה הופעל/ה בגן" : "בקשת ההצטרפות עודכנה",
        body: payload.decision_reason ?? "סטטוס בקשת ההצטרפות עודכן.",
        message: payload.decision_reason ?? "סטטוס בקשת ההצטרפות עודכן.",
        entity_type: "kindergarten_enrollment_requests",
        entity_id: id,
        severity: status === "rejected" ? "medium" : "low",
        action_url: "/dashboard/parent",
        recipient_profile_id: requestRes.data.parent_id,
        kindergarten_id: profile.garden_id,
        created_by: profile.id
      }),
      admin.from("audit_logs" as any).insert({
        actor_id: profile.id,
        actor_role: profile.role,
        garden_id: profile.garden_id,
        entity_type: "kindergarten_enrollment_requests",
        entity_id: id,
        action: `enrollment_request_${payload.action}`,
        before_data: { status: requestRes.data.status, payment_status: requestRes.data.payment_status },
        after_data: { status, payment_status: paymentStatus, activated_child_id: activatedChildId }
      })
    ]);

    return ok({ enrollment_request: update.data });
  } catch (error) {
    return handleRouteError(error);
  }
}
