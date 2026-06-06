import { z } from "zod";
import { revalidatePath } from "next/cache";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  submit: z.boolean().optional(),
  full_name: z.string().trim().min(2),
  phone: z.string().trim().min(6),
  address: z.string().trim().optional(),
  emergency_contact: z.string().trim().min(2),
  role_title: z.string().trim().min(2),
  class_group: z.string().trim().optional(),
  profile_photo_url: z.string().trim().optional(),
  documents_summary: z.string().trim().optional(),
  policy_acknowledged: z.boolean().default(false)
});

function progressFor(input: z.infer<typeof schema>) {
  const checks = {
    personal_details: Boolean(input.full_name && input.phone && input.profile_photo_url),
    role_assignment: Boolean(input.role_title),
    emergency_contact: Boolean(input.emergency_contact),
    documents: Boolean(input.documents_summary),
    policy_acknowledged: Boolean(input.policy_acknowledged)
  };
  const completed = Object.entries(checks).filter(([, done]) => done).map(([key]) => key);
  const missing = Object.entries(checks).filter(([, done]) => !done).map(([key]) => key);
  return { completed, missing, percent: Math.round((completed.length / 5) * 100) };
}

export async function PATCH(request: Request) {
  try {
    const { profile } = await requireRole(["staff"]);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: staff, error: staffError } = await admin
      .from("staff" as any)
      .select("id, garden_id, profile_id, onboarding_status, correction_note")
      .eq("profile_id", profile.id)
      .maybeSingle();
    if (staffError || !staff) return fail("לא נמצא כרטיס צוות", 404);
    if (["pending_verification", "active", "suspended"].includes(String(staff.onboarding_status))) {
      return fail("הפרטים כבר נשלחו ואי אפשר לערוך אותם כרגע", 409);
    }
    const progress = progressFor(payload);
    if (payload.submit && progress.missing.length) return fail("חסרים פרטים לפני שליחה", 422, { missing: progress.missing });
    const nextStatus = payload.submit ? "pending_verification" : "profile_incomplete";

    const { data, error } = await admin.from("staff" as any).update({
      full_name: payload.full_name,
      phone: payload.phone,
      address: payload.address || null,
      emergency_contact: payload.emergency_contact,
      role_title: payload.role_title,
      class_group: payload.class_group || null,
      profile_photo_url: payload.profile_photo_url || null,
      onboarding_status: nextStatus,
      policy_acknowledged: payload.policy_acknowledged,
      role_assignment_confirmed: true,
      onboarding_completed_at: payload.submit ? now : null,
      correction_note: payload.submit ? null : staff.correction_note,
      updated_at: now
    }).eq("id", staff.id).select("*").single();
    if (error) return fail("לא ניתן לשמור פרטי צוות", 400);

    await Promise.all([
      admin.from("profiles" as any).update({
        full_name: payload.full_name,
        phone: payload.phone,
        address: payload.address || null,
        emergency_contact: payload.emergency_contact,
        profile_image_url: payload.profile_photo_url || null
      }).eq("id", profile.id),
      admin.from("staff_onboarding_records" as any).upsert({
        staff_id: staff.id,
        profile_id: profile.id,
        garden_id: staff.garden_id,
        status: nextStatus,
        progress_percent: progress.percent,
        completed_steps: progress.completed,
        missing_items: progress.missing,
        submitted_at: payload.submit ? now : null,
        correction_note: payload.submit ? null : staff.correction_note,
        metadata: { documents_summary: payload.documents_summary ?? null },
        updated_at: now
      }, { onConflict: "staff_id" })
    ]);

    if (payload.submit) {
      await admin.from("notifications" as any).insert({
        garden_id: staff.garden_id,
        recipient_role: "manager",
        title: "איש צוות ממתין לאישור",
        body: `${payload.full_name} השלים/ה פרטים וממתין/ה לבדיקה.`,
        entity_type: "staff",
        entity_id: staff.id,
        severity: "medium",
        metadata: { href: "/dashboard/garden/onboarding", staff_id: staff.id }
      });
    }
    revalidatePath("/onboarding/staff");
    revalidatePath("/dashboard/garden/onboarding");
    revalidatePath("/dashboard/staff");
    return ok({ staff: data, progress });
  } catch (error) {
    return handleRouteError(error);
  }
}
