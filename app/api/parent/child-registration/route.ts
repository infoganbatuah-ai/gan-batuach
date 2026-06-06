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
  child_age: z.string().optional(),
  requested_age_group: z.string().optional(),
  requested_start_date: z.string().optional(),
  parent_photo_url: z.string().optional(),
  mother_photo_url: z.string().optional(),
  father_photo_url: z.string().optional(),
  important_notes: z.string().optional(),
  likes_notes: z.string().optional(),
  dislikes_notes: z.string().optional(),
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
  pickup_authorized: z.array(z.object({ name: z.string().min(2), identity_number: z.string().optional(), phone: z.string().optional(), photo_url: z.string().optional(), relation: z.string().optional() })).max(3).default([]),
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
}).refine((value) => Boolean(value.mother_identity_number || value.father_identity_number), {
  message: "יש למלא לפחות תעודת זהות אחת של הורה",
  path: ["mother_identity_number"]
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();
    if (!payload.birth_date) return fail("יש למלא תאריך לידה של הילד.", 422, { field: "birth_date" });
    if (!payload.photo_url) return fail("יש להעלות תמונת ילד.", 422, { field: "photo_url" });
    if (!payload.parent_photo_url && !payload.mother_photo_url && !payload.father_photo_url) return fail("יש להעלות תמונת הורה אחת לפחות.", 422, { field: "parent_photo_url" });
    if (!payload.mother_phone && !payload.father_phone) return fail("יש למלא לפחות טלפון אחד של הורה.", 422, { field: "mother_phone" });
    if (!payload.address) return fail("יש למלא כתובת מלאה.", 422, { field: "address" });
    if (!payload.pickup_authorized.length) return fail("יש להוסיף לפחות מורשה איסוף אחד.", 422, { field: "pickup_authorized" });
    if (!payload.parent_policy_consent) return fail("יש לאשר את תקנון ההורים.", 422, { field: "parent_policy_consent" });

    const byProfile = await supabase
      .from("parents")
      .select("*")
      .eq("profile_id", profile.id)
      .limit(20);
    const byUser = await supabase
      .from("parents")
      .select("*")
      .eq("user_id", profile.id)
      .limit(20);

    const parents = [...((byProfile.data ?? []) as any[]), ...((byUser.data ?? []) as any[])]
      .filter((item, index, all) => item?.id && all.findIndex((candidate) => candidate.id === item.id) === index);
    const parentError = byProfile.error ?? byUser.error;
    if (parentError || !parents.length) return fail(parentError?.message ?? "לא נמצא כרטיס הורה למשתמש הזה", 404);
    let parent = parents[0];

    let existingChild: any = null;
    if (payload.child_id) {
      const childRes = await supabase
        .from("children" as any)
        .select("*")
        .eq("id", payload.child_id)
        .in("primary_parent_id", parents.map((item) => item.id))
        .maybeSingle();
      if (childRes.error) return fail("לא ניתן לטעון את כרטיס הילד: " + childRes.error.message, 400);
      if (!childRes.data) return fail("כרטיס הילד לא נמצא או אינו משויך להורה", 404);
      existingChild = childRes.data;
      parent = parents.find((item) => item.id === existingChild.primary_parent_id) ?? parent;
    }

    const gardenId = existingChild?.garden_id ?? profile.garden_id ?? parent.garden_id;
    if (!gardenId) return fail("לא נמצא שיוך לגן עבור ההורה", 422);
    const childIdentityNumber = String(payload.identity_number ?? "").replace(/\D/g, "");
    if (childIdentityNumber) {
      const [existingById, existingFileById] = await Promise.all([
        supabase.from("children" as any).select("id, primary_parent_id").eq("identity_number", childIdentityNumber).neq("id", existingChild?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle(),
        supabase.from("permanent_child_files" as any).select("id, primary_parent_id").eq("identity_number", childIdentityNumber).maybeSingle()
      ]);
      const fileIsCurrent = existingFileById.data?.id && existingFileById.data.id === existingChild?.permanent_child_file_id;
      if (existingById.data || (existingFileById.data && !fileIsCurrent)) return fail("ילד עם תעודת זהות זו כבר קיים במערכת. כדי להוסיף אותו לגן נוסף יש להשתמש בתהליך מעבר/שיוך ילד קיים.", 409, { field: "identity_number" });
    }

    const nextStatus = existingChild?.status === "active" || existingChild?.status === "approved"
      ? existingChild.status
      : "pending_manager_approval";

    const childPayload = {
        garden_id: gardenId,
        primary_parent_id: parent.id as string,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: childIdentityNumber || null,
        photo_url: payload.photo_url || existingChild?.photo_url || null,
        face_image_url: payload.photo_url || existingChild?.face_image_url || null,
        child_age: payload.child_age || existingChild?.child_age || null,
        age_group: payload.requested_age_group || payload.age_group || existingChild?.age_group || null,
        classroom: payload.requested_age_group || payload.age_group || existingChild?.classroom || null,
        requested_age_group: payload.requested_age_group || existingChild?.requested_age_group || null,
        requested_start_date: payload.requested_start_date || existingChild?.requested_start_date || null,
        hmo: payload.hmo,
        allergies: payload.allergies,
        sensitivities: payload.sensitivities,
        regular_medications: payload.regular_medications,
        medical_notes: payload.medical_notes,
        important_notes: payload.important_notes,
        likes_notes: payload.likes_notes,
        dislikes_notes: payload.dislikes_notes,
        address: payload.address,
        mother_name: payload.mother_name,
        mother_identity_number: payload.mother_identity_number,
        mother_phone: payload.mother_phone,
        father_name: payload.father_name,
        father_identity_number: payload.father_identity_number,
        father_phone: payload.father_phone,
        parent_photo_url: payload.parent_photo_url || payload.mother_photo_url || payload.father_photo_url || null,
        mother_photo_url: payload.mother_photo_url || null,
        father_photo_url: payload.father_photo_url || null,
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
            important: payload.important_notes || "",
            likes: payload.likes_notes || "",
            dislikes: payload.dislikes_notes || "",
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
    const primaryParentPhoto = payload.parent_photo_url || payload.mother_photo_url || payload.father_photo_url || "";
    const now = new Date().toISOString();
    const parentUpdate = await supabase.from("parents").update({
      completed_profile: true,
      status: "active",
      onboarding_status: "active",
      invitation_status: "active",
      onboarding_completed_at: now,
      activated_at: now,
      photo_url: primaryParentPhoto || parent.photo_url || null
    }).eq("id", parent.id as string);
    if (parentUpdate.error) {
      console.error("[parent-child-registration] parent update failed", { parent_id: parent.id, child_id: (child as any).id, error: parentUpdate.error.message });
      return fail("פרטי הילד נשמרו, אך עדכון כרטיס ההורה נכשל.", 500);
    }
    if (primaryParentPhoto) {
      const profilePhotoUpdate = await supabase.from("profiles" as any).update({ profile_image_url: primaryParentPhoto }).eq("id", profile.id).is("profile_image_url", null);
      if (profilePhotoUpdate.error) console.error("[parent-child-registration] profile photo update failed", { profile_id: profile.id, error: profilePhotoUpdate.error.message });
    }
    await supabase.from("parent_onboarding_records" as any).upsert({
      parent_id: parent.id,
      profile_id: profile.id,
      garden_id: gardenId,
      status: "active",
      progress_percent: 100,
      completed_steps: ["profile_completed", "child_linked", "documents_completed", "permissions_reviewed"],
      missing_items: [],
      completed_at: now,
      activated_at: now,
      metadata: { child_id: (child as any).id }
    }, { onConflict: "parent_id" });

    let permanentFileId = (child as any).permanent_child_file_id ?? existingChild?.permanent_child_file_id ?? null;
    if (permanentFileId) {
      const fileUpdate = await supabase.from("permanent_child_files" as any).update({
        primary_parent_profile_id: profile.id,
        primary_parent_id: parent.id,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: childIdentityNumber || null,
        photo_url: payload.photo_url || null,
        face_image_url: payload.photo_url || null,
        important_notes: payload.important_notes || null,
        likes_notes: payload.likes_notes || null,
        dislikes_notes: payload.dislikes_notes || null,
        hmo: payload.hmo || null,
        allergies: payload.allergies || null,
        sensitivities: payload.sensitivities || null,
        regular_medications: payload.regular_medications || null,
        medical_notes: payload.medical_notes || null,
        emergency_phone: payload.emergency_phone || null,
        pickup_authorized: payload.pickup_authorized,
        updated_at: new Date().toISOString()
      }).eq("id", permanentFileId);
      if (fileUpdate.error) console.error("[parent-child-registration] permanent child file update failed", { child_id: (child as any).id, permanent_child_file_id: permanentFileId, error: fileUpdate.error.message });
    } else {
      const file = await supabase.from("permanent_child_files" as any).insert({
        primary_parent_profile_id: profile.id,
        primary_parent_id: parent.id,
        full_name: payload.full_name,
        birth_date: payload.birth_date || null,
        identity_number: childIdentityNumber || null,
        photo_url: payload.photo_url || null,
        face_image_url: payload.photo_url || null,
        important_notes: payload.important_notes || null,
        likes_notes: payload.likes_notes || null,
        dislikes_notes: payload.dislikes_notes || null,
        hmo: payload.hmo || null,
        allergies: payload.allergies || null,
        sensitivities: payload.sensitivities || null,
        regular_medications: payload.regular_medications || null,
        medical_notes: payload.medical_notes || null,
        emergency_phone: payload.emergency_phone || null,
        pickup_authorized: payload.pickup_authorized
      }).select("id").single();
      permanentFileId = file.data?.id ?? null;
      if (permanentFileId) {
        const childFileLink = await supabase.from("children" as any).update({ permanent_child_file_id: permanentFileId }).eq("id", (child as any).id);
        if (childFileLink.error) console.error("[parent-child-registration] child file link failed", { child_id: (child as any).id, permanent_child_file_id: permanentFileId, error: childFileLink.error.message });
      }
    }
    if (permanentFileId) {
      const enrollmentResult = await supabase.from("child_kindergarten_enrollments" as any).upsert({
        child_id: (child as any).id,
        permanent_child_file_id: permanentFileId,
        garden_id: gardenId,
        status: nextStatus,
        classroom_name: payload.requested_age_group || payload.age_group || null,
        start_date: payload.requested_start_date || null,
        notes: payload.parent_notes || null
      }, { onConflict: "child_id,garden_id" });
      if (enrollmentResult.error) {
        console.error("[parent-child-registration] enrollment upsert failed", { child_id: (child as any).id, permanent_child_file_id: permanentFileId, error: enrollmentResult.error.message });
        return fail("פרטי הילד נשמרו, אך שיוך הילד לגן לא עודכן.", 500);
      }
      const timelineResult = await supabase.from("child_timeline_events" as any).insert({
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
      if (timelineResult.error) console.error("[parent-child-registration] timeline insert failed", { child_id: (child as any).id, error: timelineResult.error.message });
    }

    const { data: garden } = await supabase.from("gardens" as any).select("manager_id, owner_profile_id").eq("id", gardenId).maybeSingle();
    const recipients = Array.from(new Set([garden?.manager_id, garden?.owner_profile_id].filter(Boolean)));
    if (recipients.length && nextStatus === "pending_manager_approval") {
      const notificationResult = await supabase.from("notifications" as any).insert(recipients.map((recipientId) => ({
        garden_id: gardenId,
        recipient_id: recipientId,
        recipient_role: "manager",
        title: "ילד ממתין לאישור",
        body: `${payload.full_name} השלים/ה כרטיס וממתין/ה לאישור הגן.`,
        message: `${payload.full_name} השלים/ה כרטיס וממתין/ה לאישור הגן.`,
        entity_type: "children",
        entity_id: child.id,
        severity: "medium",
        action_url: "/dashboard/garden/children?status=pending",
        recipient_profile_id: recipientId,
        kindergarten_id: gardenId,
        child_id: child.id,
        created_by: profile.id,
        metadata: { href: "/dashboard/garden/children", child_id: child.id }
      })));
      if (notificationResult.error) console.error("[parent-child-registration] notification failed", { child_id: child.id, garden_id: gardenId, error: notificationResult.error.message });
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
