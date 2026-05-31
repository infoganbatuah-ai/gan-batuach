import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  mode: z.enum(["existing_child", "new_child"]),
  target_garden_id: z.string().uuid(),
  existing_child_ref: z.string().min(8).optional(),
  child_name: z.string().optional(),
  child_age: z.string().optional(),
  requested_start_date: z.string().optional(),
  notes: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.mode === "existing_child" && !value.existing_child_ref) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["existing_child_ref"], message: "יש לבחור ילד קיים" });
  }
  if (value.mode === "new_child" && !value.child_name?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["child_name"], message: "יש למלא שם ילד" });
  }
});

function uniq(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

function pickChildCopyFields(child: any, parentId: string, targetGardenId: string) {
  return {
    garden_id: targetGardenId,
    primary_parent_id: parentId,
    permanent_child_file_id: child.permanent_child_file_id,
    full_name: child.full_name,
    birth_date: child.birth_date ?? null,
    identity_number: child.identity_number ?? null,
    photo_url: child.photo_url ?? child.face_image_url ?? null,
    face_image_url: child.face_image_url ?? child.photo_url ?? null,
    hmo: child.hmo ?? null,
    allergies: child.allergies ?? null,
    sensitivities: child.sensitivities ?? null,
    regular_medications: child.regular_medications ?? null,
    medical_notes: child.medical_notes ?? null,
    emergency_phone: child.emergency_phone ?? null,
    pickup_authorized: child.pickup_authorized ?? [],
    mother_name: child.mother_name ?? null,
    mother_phone: child.mother_phone ?? null,
    father_name: child.father_name ?? null,
    father_phone: child.father_phone ?? null,
    status: "pending_manager_approval",
    parent_completed: true
  };
}

async function notifyGarden(admin: ReturnType<typeof createAdminClient>, gardenId: string | null | undefined, notification: Record<string, any>) {
  if (!gardenId) return;
  const { data: garden } = await admin.from("gardens" as any).select("manager_id, owner_profile_id, name").eq("id", gardenId).maybeSingle();
  const recipients = uniq([garden?.manager_id, garden?.owner_profile_id]);
  if (!recipients.length) return;
  await admin.from("notifications" as any).insert(recipients.map((recipientId) => ({
    garden_id: gardenId,
    recipient_id: recipientId,
    recipient_role: "manager",
    severity: "medium",
    ...notification
  })));
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["parent"]);
    if (!isAdminClientConfigured()) return fail("פעולת מעבר ילד דורשת הגדרת שירות שרת מאובטח.", 503);
    const payload = schema.parse(await request.json());
    const admin = createAdminClient();

    const byProfile = await admin.from("parents" as any).select("*").eq("profile_id", profile.id).maybeSingle();
    const byUser = byProfile.data ? { data: null, error: null } : await admin.from("parents" as any).select("*").eq("user_id", profile.id).maybeSingle();
    const parent = (byProfile.data as any) ?? (byUser.data as any);
    if (byProfile.error || byUser.error) return fail("לא ניתן לטעון את פרטי ההורה כרגע", 400);
    if (!parent) return fail("לא נמצא כרטיס הורה למשתמש הזה", 404);

    const { data: targetGarden } = await admin.from("gardens" as any).select("id, name").eq("id", payload.target_garden_id).maybeSingle();
    if (!targetGarden) return fail("הגן שנבחר לא נמצא", 404);

    if (payload.mode === "new_child") {
      const { data: lead, error } = await admin.from("leads" as any).insert({
        garden_id: payload.target_garden_id,
        lead_type: "parent",
        parent_name: parent.full_name ?? profile.full_name ?? "הורה",
        phone: parent.phone ?? (profile as any).phone ?? "לא צוין",
        email: parent.email ?? (profile as any).email ?? null,
        child_name: payload.child_name?.trim(),
        child_age: payload.child_age ?? null,
        notes: payload.notes ?? null,
        status: "new",
        source: "parent_dashboard_new_child",
        assigned_to: profile.id,
        missing_details: ["manager_approval_required", "parent_child_profile_required"]
      }).select("id").single();
      if (error) return fail("שמירת בקשת הרישום נכשלה: " + error.message, 400);

      await admin.from("parent_kindergarten_links" as any).upsert({
        parent_id: parent.id,
        parent_profile_id: profile.id,
        garden_id: payload.target_garden_id,
        status: "pending",
        source: "parent_new_child_request",
        notes: payload.notes ?? null
      }, { onConflict: "parent_profile_id,garden_id" });

      await notifyGarden(admin, payload.target_garden_id, {
        title: "בקשת רישום לילד חדש",
        body: `${parent.full_name ?? "הורה"} ביקש/ה לרשום את ${payload.child_name}.`,
        entity_type: "leads",
        entity_id: lead.id,
        metadata: { href: "/dashboard/garden/leads", lead_id: lead.id, source: "parent_dashboard_new_child" }
      });

      await writeUserCreationAudit({
        actorId: profile.id,
        actorRole: "parent",
        gardenId: payload.target_garden_id,
        entityType: "leads",
        entityId: lead.id as string,
        action: "request_new_child_enrollment",
        afterData: { child_name: payload.child_name, target_garden_id: payload.target_garden_id }
      });

      return ok({ lead_id: lead.id, status: "new_child_request_sent" }, 201);
    }

    const childMatch = await admin
      .from("children" as any)
      .select("*")
      .or(`id.eq.${payload.existing_child_ref},permanent_child_file_id.eq.${payload.existing_child_ref}`)
      .eq("primary_parent_id", parent.id)
      .limit(1)
      .maybeSingle();
    if (childMatch.error) return fail("לא ניתן לטעון את כרטיס הילד: " + childMatch.error.message, 400);
    if (!childMatch.data) return fail("הילד שנבחר לא נמצא בחשבון ההורה", 404);

    let sourceChild = childMatch.data as any;
    let permanentFileId = sourceChild.permanent_child_file_id as string | null;
    if (!permanentFileId) {
      const file = await admin.from("permanent_child_files" as any).insert({
        primary_parent_profile_id: profile.id,
        primary_parent_id: parent.id,
        full_name: sourceChild.full_name,
        birth_date: sourceChild.birth_date ?? null,
        identity_number: sourceChild.identity_number ?? null,
        photo_url: sourceChild.photo_url ?? sourceChild.face_image_url ?? null,
        face_image_url: sourceChild.face_image_url ?? sourceChild.photo_url ?? null,
        hmo: sourceChild.hmo ?? null,
        allergies: sourceChild.allergies ?? null,
        sensitivities: sourceChild.sensitivities ?? null,
        regular_medications: sourceChild.regular_medications ?? null,
        medical_notes: sourceChild.medical_notes ?? null,
        emergency_phone: sourceChild.emergency_phone ?? null,
        pickup_authorized: sourceChild.pickup_authorized ?? []
      }).select("id").single();
      if (file.error || !file.data?.id) return fail("לא ניתן ליצור תיק ילד קבוע", 400);
      permanentFileId = file.data.id as string;
      await admin.from("children" as any).update({ permanent_child_file_id: permanentFileId }).eq("id", sourceChild.id);
      sourceChild = { ...sourceChild, permanent_child_file_id: permanentFileId };
    }

    const activeEnrollments = await admin
      .from("child_kindergarten_enrollments" as any)
      .select("id, child_id, permanent_child_file_id, garden_id, status, start_date, end_date")
      .eq("permanent_child_file_id", permanentFileId)
      .in("status", ["active", "pending_manager_approval", "pending_parent_completion"])
      .order("created_at", { ascending: false });
    if (activeEnrollments.error) return fail("לא ניתן לטעון שיוכי גנים קיימים", 400);

    const currentEnrollment = ((activeEnrollments.data ?? []) as any[]).find((enrollment) => enrollment.garden_id !== payload.target_garden_id && enrollment.status === "active") ??
      ((activeEnrollments.data ?? []) as any[]).find((enrollment) => enrollment.garden_id !== payload.target_garden_id);
    const currentGardenId = currentEnrollment?.garden_id ?? sourceChild.garden_id ?? null;

    const existingRequest = await admin
      .from("child_transfer_requests" as any)
      .select("id, status, target_child_id, target_enrollment_id")
      .eq("permanent_child_file_id", permanentFileId)
      .eq("target_garden_id", payload.target_garden_id)
      .in("status", ["pending_new_kindergarten_review", "pending_current_kindergarten_response", "current_kindergarten_acknowledged", "current_kindergarten_requested_call", "current_kindergarten_flagged", "missing_details"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingRequest.error) return fail("לא ניתן לבדוק בקשות קיימות", 400);
    if (existingRequest.data) return ok({ transfer_request_id: existingRequest.data.id, status: existingRequest.data.status, already_exists: true }, 200);

    const targetChildExisting = await admin
      .from("children" as any)
      .select("*")
      .eq("permanent_child_file_id", permanentFileId)
      .eq("garden_id", payload.target_garden_id)
      .maybeSingle();
    if (targetChildExisting.error) return fail("לא ניתן לבדוק כרטיס ילד בגן החדש", 400);
    const targetChildWrite = targetChildExisting.data
      ? { data: targetChildExisting.data, error: null }
      : await admin.from("children" as any).insert(pickChildCopyFields(sourceChild, parent.id, payload.target_garden_id)).select("*").single();
    if (targetChildWrite.error || !targetChildWrite.data) return fail("יצירת כרטיס קליטה לגן החדש נכשלה", 400);

    const targetChild = targetChildWrite.data as any;
    const enrollment = await admin.from("child_kindergarten_enrollments" as any).upsert({
      child_id: targetChild.id,
      permanent_child_file_id: permanentFileId,
      garden_id: payload.target_garden_id,
      status: "pending_manager_approval",
      start_date: payload.requested_start_date || null,
      classroom_name: targetChild.classroom ?? targetChild.age_group ?? null,
      notes: payload.notes ?? null
    }, { onConflict: "child_id,garden_id" }).select("id").single();
    if (enrollment.error || !enrollment.data?.id) return fail("יצירת בקשת קליטה לגן החדש נכשלה", 400);

    await admin.from("parent_kindergarten_links" as any).upsert({
      parent_id: parent.id,
      parent_profile_id: profile.id,
      garden_id: payload.target_garden_id,
      status: "pending",
      source: "child_transfer",
      notes: payload.notes ?? null
    }, { onConflict: "parent_profile_id,garden_id" });

    const transfer = await admin.from("child_transfer_requests" as any).insert({
      parent_profile_id: profile.id,
      parent_id: parent.id,
      child_id: sourceChild.id,
      target_child_id: targetChild.id,
      permanent_child_file_id: permanentFileId,
      current_garden_id: currentGardenId,
      target_garden_id: payload.target_garden_id,
      target_enrollment_id: enrollment.data.id,
      status: "pending_new_kindergarten_review",
      requested_start_date: payload.requested_start_date || null,
      parent_notes: payload.notes ?? null
    }).select("id, status").single();
    if (transfer.error || !transfer.data?.id) return fail("שמירת בקשת המעבר נכשלה", 400);

    await admin.from("child_timeline_events" as any).insert({
      child_id: sourceChild.id,
      permanent_child_file_id: permanentFileId,
      garden_id: payload.target_garden_id,
      actor_id: profile.id,
      actor_role: "parent",
      event_type: "parent_requested_child_transfer",
      title: "הורה ביקש לרשום ילד לגן חדש",
      description: `נפתחה בקשת קליטה ל${targetGarden.name ?? "גן חדש"}.`,
      metadata: { transfer_request_id: transfer.data.id, current_garden_id: currentGardenId, target_garden_id: payload.target_garden_id }
    });

    await notifyGarden(admin, payload.target_garden_id, {
      title: "בקשת קליטת ילד קיים",
      body: `${parent.full_name ?? "הורה"} ביקש/ה לקלוט את ${sourceChild.full_name} לגן.`,
      entity_type: "child_transfer_requests",
      entity_id: transfer.data.id,
      metadata: { href: "/dashboard/garden/leads", transfer_request_id: transfer.data.id, child_id: targetChild.id }
    });
    if (currentGardenId && currentGardenId !== payload.target_garden_id) {
      await notifyGarden(admin, currentGardenId, {
        title: "הורה ביקש לרשום את הילד לגן חדש",
        body: `${parent.full_name ?? "הורה"} ביקש/ה לרשום את ${sourceChild.full_name} ל${targetGarden.name ?? "גן חדש"}.`,
        entity_type: "child_transfer_requests",
        entity_id: transfer.data.id,
        metadata: { href: "/dashboard/garden/leads", transfer_request_id: transfer.data.id, child_id: sourceChild.id }
      });
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: "parent",
      gardenId: payload.target_garden_id,
      entityType: "child_transfer_requests",
      entityId: transfer.data.id as string,
      action: "request_existing_child_transfer",
      afterData: { permanent_child_file_id: permanentFileId, current_garden_id: currentGardenId, target_garden_id: payload.target_garden_id }
    });

    return ok({ transfer_request_id: transfer.data.id, status: "pending_new_kindergarten_review", target_child_id: targetChild.id }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
