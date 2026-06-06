import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";
import { insertInvitationDeliveryLogs } from "@/lib/onboarding/invitation-delivery";

const schema = provisionedUserSchema.extend({
  role_title: z.string().min(2),
  identity_number: z.string().min(5),
  address: z.string().optional(),
  class_group: z.string().optional(),
  start_date: z.string().optional(),
  notes: z.string().optional()
});

async function cleanupProvisionedStaff(userId: string) {
  const admin = createAdminClient();
  try {
    await admin.from("staff" as any).delete().eq("profile_id", userId);
    await admin.from("generated_credentials" as any).delete().eq("user_id", userId);
    await admin.from("profiles").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId);
  } catch (error) {
    console.error("[create-staff] cleanup failed", { user_id: userId, error });
  }
}

export async function POST(request: Request) {
  let createdUserId: string | null = null;
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const identityNumber = payload.identity_number.replace(/\D/g, "");
    if (identityNumber.length < 5) return fail("יש להזין תעודת זהות איש צוות תקינה.", 422, { field: "identity_number" });
    const admin = createAdminClient();
    const existingStaff = await admin.from("staff" as any).select("id, garden_id, full_name, profile_id", { count: "exact" }).eq("identity_number", identityNumber).limit(5);
    if ((existingStaff.count ?? 0) > 0) {
      const existing = existingStaff.data?.[0] as any;
      if (existing?.garden_id !== profile.garden_id) {
        const employment = await admin.from("staff_kindergarten_employments" as any).insert({
          staff_id: existing.id,
          profile_id: existing.profile_id,
          garden_id: profile.garden_id,
          status: "pending_transfer",
          role_title: payload.role_title,
          class_group: payload.class_group,
          start_date: payload.start_date || null,
          notes: payload.notes || "בקשת שיוך/מעבר צוות לפי תעודת זהות קיימת"
        });
        if (employment.error) {
          console.error("[create-staff] existing staff transfer request failed", { staff_id: existing.id, garden_id: profile.garden_id, error: employment.error.message });
          return fail("איש צוות זה כבר קיים, אך לא ניתן לפתוח בקשת שיוך/מעבר כרגע.", 400);
        }
      }
      return fail("איש צוות זה כבר קיים במערכת. נפתחה בדיקת שיוך/מעבר במקום יצירת כפילות.", 409, { field: "identity_number", existing_staff_id: existing?.id ?? null });
    }
    const { supabase, user, oneTimeCredentials } = await provisionAuthUser({
      role: "staff",
      gardenId: profile.garden_id,
      fullName: payload.full_name,
      email: payload.email,
      phone: payload.phone,
      temporaryPassword: payload.temporary_password
    });
    createdUserId = user.id;
    const now = new Date().toISOString();
    await supabase.from("profiles" as any).update({ identity_number: identityNumber }).eq("id", user.id);

    const { data: staff, error } = await supabase
      .from("staff")
      .insert({
        profile_id: user.id,
        garden_id: profile.garden_id,
        full_name: payload.full_name,
        role_title: payload.role_title,
        identity_number: identityNumber,
        phone: payload.phone,
        email: payload.email,
        address: payload.address,
        class_group: payload.class_group,
        start_date: payload.start_date || null,
        notes: payload.notes,
        approved_to_work: false,
        background_check_status: "missing",
        police_clearance_status: "missing",
        onboarding_status: "account_created",
        invited_by: profile.id,
        invited_at: now,
        account_created_at: now,
        policy_acknowledged: false,
        role_assignment_confirmed: false
      })
      .select("*")
      .single();

    if (error) {
      await cleanupProvisionedStaff(user.id);
      return fail(error.message, 400);
    }
    const file = await supabase.from("staff_permanent_files" as any).insert({
      profile_id: user.id,
      full_name: payload.full_name,
      identity_number: identityNumber,
      phone: payload.phone,
      email: payload.email,
      notes: payload.notes
    }).select("id").single();
    if (file.error || !file.data?.id) {
      console.error("[create-staff] permanent file failed", { staff_id: staff.id, staff_user_id: user.id, error: file.error?.message });
      return fail("משתמש הצוות נוצר, אך תיק הצוות הקבוע לא נוצר. יש להשלים תיק צוות לפני הצגת הצלחה מלאה.", 409, { staff_id: staff.id, staff_user_id: user.id });
    }

    const employment = await supabase.from("staff_kindergarten_employments" as any).insert({
        staff_file_id: file.data.id,
        staff_id: staff.id,
        profile_id: user.id,
        garden_id: profile.garden_id,
        status: "pending_approval",
        role_title: payload.role_title,
        class_group: payload.class_group,
        start_date: payload.start_date || null,
        notes: payload.notes
      });
    if (employment.error) {
      console.error("[create-staff] employment failed", { staff_id: staff.id, staff_file_id: file.data.id, garden_id: profile.garden_id, error: employment.error.message });
      return fail("משתמש הצוות נוצר, אך השיוך לגן לא נשמר. יש להשלים שיוך לפני הצגת הצלחה מלאה.", 409, { staff_id: staff.id, staff_file_id: file.data.id });
    }

    const timeline = await supabase.from("staff_timeline_events" as any).insert({
        staff_file_id: file.data.id,
        staff_id: staff.id,
        profile_id: user.id,
        garden_id: profile.garden_id,
        actor_id: profile.id,
        actor_role: profile.role,
        event_type: "staff_added_to_kindergarten",
        title: "איש צוות נוסף לגן",
        description: "נוצר תיק צוות קבוע ושיוך תעסוקה לגן.",
        metadata: { role_title: payload.role_title }
      });
    if (timeline.error) console.error("[create-staff] timeline failed", { staff_id: staff.id, staff_file_id: file.data.id, error: timeline.error.message });

    await Promise.all([
      supabase.from("staff_onboarding_records" as any).upsert({
        staff_id: staff.id,
        profile_id: user.id,
        garden_id: profile.garden_id,
        status: "account_created",
        progress_percent: 0,
        invited_by: profile.id,
        invited_at: now,
        account_created_at: now
      }, { onConflict: "staff_id" }),
      insertInvitationDeliveryLogs(supabase, {
        profileId: user.id,
        gardenId: profile.garden_id,
        role: "staff",
        username: oneTimeCredentials.username,
        temporaryPassword: oneTimeCredentials.temporary_password,
        recipientName: payload.full_name,
        phone: payload.phone
      })
    ]);

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "staff",
      entityId: staff.id as string,
      action: "create_staff_user",
      afterData: { staff_id: staff.id, staff_user_id: user.id, approval_status: "pending_documents", onboarding_status: "account_created" }
    });

    return ok({ staff, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    if (createdUserId) await cleanupProvisionedStaff(createdUserId);
    return handleRouteError(error);
  }
}
