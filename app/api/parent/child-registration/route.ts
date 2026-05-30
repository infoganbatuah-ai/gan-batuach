import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  child_id: z.string().uuid().optional(),
  full_name: z.string().min(2),
  birth_date: z.string().optional(),
  identity_number: z.string().optional(),
  photo_url: z.string().optional(),
  age_group: z.string().optional(),
  hmo: z.string().optional(),
  allergies: z.string().optional(),
  sensitivities: z.string().optional(),
  regular_medications: z.string().optional(),
  medical_notes: z.string().optional(),
  address: z.string().optional(),
  mother_name: z.string().optional(),
  mother_identity_number: z.string().optional(),
  mother_phone: z.string().optional(),
  father_name: z.string().optional(),
  father_identity_number: z.string().optional(),
  father_phone: z.string().optional(),
  emergency_phone: z.string().optional(),
  pickup_authorized: z.array(z.object({ name: z.string().min(2), phone: z.string().optional(), relation: z.string().optional() })).default([]),
  special_food_notes: z.string().optional(),
  sleep_notes: z.string().optional(),
  behavior_notes: z.string().optional(),
  parent_notes: z.string().optional(),
  photo_consent: z.boolean().default(false),
  system_consent: z.literal(true),
  camera_consent: z.boolean().default(false),
  privacy_consent: z.literal(true),
  health_declaration: z.literal(true),
  parent_policy_consent: z.boolean().default(false)
}).refine((value) => Boolean(value.mother_identity_number || value.father_identity_number || value.identity_number), {
  message: "יש למלא תעודת זהות ילד או לפחות תעודת זהות אחת של הורה",
  path: ["mother_identity_number"]
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();

    const byProfile = await supabase
      .from("parents")
      .select("*")
      .eq("profile_id", profile.id)
      .maybeSingle();
    const byUser = byProfile.data ? { data: null, error: null } : await supabase
      .from("parents")
      .select("*")
      .eq("user_id", profile.id)
      .maybeSingle();

    const parent = (byProfile.data as any) ?? (byUser.data as any);
    const parentError = byProfile.error ?? byUser.error;
    if (parentError || !parent) return fail(parentError?.message ?? "לא נמצא כרטיס הורה למשתמש הזה", 404);

    const gardenId = profile.garden_id ?? parent.garden_id;
    if (!gardenId) return fail("לא נמצא שיוך לגן עבור ההורה", 422);

    let existingChild: any = null;
    if (payload.child_id) {
      const childRes = await supabase
        .from("children" as any)
        .select("*")
        .eq("id", payload.child_id)
        .eq("primary_parent_id", parent.id as string)
        .maybeSingle();
      if (childRes.error) return fail("לא ניתן לטעון את כרטיס הילד: " + childRes.error.message, 400);
      if (!childRes.data) return fail("כרטיס הילד לא נמצא או אינו משויך להורה", 404);
      existingChild = childRes.data;
    }

    const nextStatus = existingChild?.status === "active" || existingChild?.status === "approved"
      ? existingChild.status
      : "pending_manager_approval";

    const childPayload = {
        garden_id: gardenId,
        primary_parent_id: parent.id as string,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: payload.identity_number,
        photo_url: payload.photo_url || existingChild?.photo_url || null,
        face_image_url: payload.photo_url || existingChild?.face_image_url || null,
        age_group: payload.age_group || existingChild?.age_group || null,
        hmo: payload.hmo,
        allergies: payload.allergies,
        sensitivities: payload.sensitivities,
        regular_medications: payload.regular_medications,
        medical_notes: payload.medical_notes,
        address: payload.address,
        mother_name: payload.mother_name,
        mother_identity_number: payload.mother_identity_number,
        mother_phone: payload.mother_phone,
        father_name: payload.father_name,
        father_identity_number: payload.father_identity_number,
        father_phone: payload.father_phone,
        emergency_phone: payload.emergency_phone,
        pickup_authorized: payload.pickup_authorized,
        photo_consent: payload.photo_consent,
        system_consent: payload.system_consent,
        additional_consents: {
          ...(existingChild?.additional_consents ?? {}),
          camera_viewing: payload.camera_consent,
          privacy: payload.privacy_consent,
          health_declaration: payload.health_declaration,
          parent_policy: payload.parent_policy_consent,
          special_notes: {
            food: payload.special_food_notes || "",
            sleep: payload.sleep_notes || "",
            behavior: payload.behavior_notes || "",
            parent_notes: payload.parent_notes || ""
          }
        },
        status: nextStatus,
        parent_completed: true
      };

    const { data: pendingChild } = payload.child_id ? { data: null } as any : await supabase
      .from("children")
      .select("id")
      .eq("garden_id", gardenId)
      .eq("primary_parent_id", parent.id as string)
      .eq("status", "pending_parent_completion")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const childWrite = existingChild?.id
      ? await supabase.from("children").update(childPayload).eq("id", existingChild.id).select("*").single()
      : pendingChild?.id
      ? await supabase.from("children").update(childPayload).eq("id", pendingChild.id).select("*").single()
      : await supabase.from("children").insert(childPayload).select("*").single();

    const { data: child, error } = childWrite;

    if (error) return fail(error.message, 400);
    await supabase.from("parents").update({ completed_profile: true, status: "child_registration_submitted" }).eq("id", parent.id as string);

    let permanentFileId = (child as any).permanent_child_file_id ?? existingChild?.permanent_child_file_id ?? null;
    if (permanentFileId) {
      await supabase.from("permanent_child_files" as any).update({
        primary_parent_profile_id: profile.id,
        primary_parent_id: parent.id,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: payload.identity_number || null,
        photo_url: payload.photo_url || null,
        face_image_url: payload.photo_url || null,
        hmo: payload.hmo || null,
        allergies: payload.allergies || null,
        sensitivities: payload.sensitivities || null,
        regular_medications: payload.regular_medications || null,
        medical_notes: payload.medical_notes || null,
        emergency_phone: payload.emergency_phone || null,
        pickup_authorized: payload.pickup_authorized,
        updated_at: new Date().toISOString()
      }).eq("id", permanentFileId);
    } else {
      const file = await supabase.from("permanent_child_files" as any).insert({
        primary_parent_profile_id: profile.id,
        primary_parent_id: parent.id,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: payload.identity_number || null,
        photo_url: payload.photo_url || null,
        face_image_url: payload.photo_url || null,
        hmo: payload.hmo || null,
        allergies: payload.allergies || null,
        sensitivities: payload.sensitivities || null,
        regular_medications: payload.regular_medications || null,
        medical_notes: payload.medical_notes || null,
        emergency_phone: payload.emergency_phone || null,
        pickup_authorized: payload.pickup_authorized
      }).select("id").single();
      permanentFileId = file.data?.id ?? null;
      if (permanentFileId) await supabase.from("children" as any).update({ permanent_child_file_id: permanentFileId }).eq("id", (child as any).id);
    }
    if (permanentFileId) {
      await supabase.from("child_kindergarten_enrollments" as any).upsert({
        child_id: (child as any).id,
        permanent_child_file_id: permanentFileId,
        garden_id: gardenId,
        status: nextStatus,
        classroom_name: payload.age_group || null,
        notes: payload.parent_notes || null
      }, { onConflict: "child_id,garden_id" });
      await supabase.from("child_timeline_events" as any).insert({
        child_id: (child as any).id,
        permanent_child_file_id: permanentFileId,
        garden_id: gardenId,
        actor_id: profile.id,
        actor_role: "parent",
        event_type: "parent_completed_child_profile",
        title: "הורה השלים פרטי ילד",
        description: "הפרטים נשמרו בתיק הילד הקבוע ונשלחו לאישור הגן.",
        metadata: { status: nextStatus }
      });
    }

    const { data: garden } = await supabase.from("gardens" as any).select("manager_id, owner_profile_id").eq("id", gardenId).maybeSingle();
    const recipients = Array.from(new Set([garden?.manager_id, garden?.owner_profile_id].filter(Boolean)));
    if (recipients.length && nextStatus === "pending_manager_approval") {
      await supabase.from("notifications" as any).insert(recipients.map((recipientId) => ({
        garden_id: gardenId,
        recipient_id: recipientId,
        recipient_role: "manager",
        title: "ילד ממתין לאישור",
        body: `${payload.full_name} השלים/ה כרטיס וממתין/ה לאישור הגן.`,
        entity_type: "children",
        entity_id: child.id,
        severity: "medium",
        metadata: { href: "/dashboard/garden/children", child_id: child.id }
      })));
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "parent",
      gardenId,
      entityType: "children",
      entityId: child.id as string,
      action: existingChild?.id ? "update_child_registration" : "submit_child_registration",
      afterData: { child_id: child.id, parent_id: parent.id as string, status: nextStatus }
    });

    return ok({ child }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
