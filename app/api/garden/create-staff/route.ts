import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { provisionAuthUser, provisionedUserSchema, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = provisionedUserSchema.extend({
  role_title: z.string().min(2),
  identity_number: z.string().min(5),
  address: z.string().optional(),
  class_group: z.string().optional(),
  start_date: z.string().optional(),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["manager", "owner"]);
    if (!profile.garden_id) return fail("Manager is not assigned to a garden", 422);
    const payload = schema.parse(await request.json());
    const identityNumber = payload.identity_number.replace(/\D/g, "");
    const admin = createAdminClient();
    const existingStaff = await admin.from("staff" as any).select("id, garden_id, full_name, profile_id", { count: "exact" }).eq("identity_number", identityNumber).limit(5);
    if ((existingStaff.count ?? 0) > 0) {
      const existing = existingStaff.data?.[0] as any;
      if (existing?.garden_id !== profile.garden_id) {
        await admin.from("staff_kindergarten_employments" as any).insert({
          staff_id: existing.id,
          profile_id: existing.profile_id,
          garden_id: profile.garden_id,
          status: "pending_transfer",
          role_title: payload.role_title,
          class_group: payload.class_group,
          start_date: payload.start_date || null,
          notes: payload.notes || "בקשת שיוך/מעבר צוות לפי תעודת זהות קיימת"
        });
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
        police_clearance_status: "missing"
      })
      .select("*")
      .single();

    if (error) return fail(error.message, 400);
    const file = await supabase.from("staff_permanent_files" as any).insert({
      profile_id: user.id,
      full_name: payload.full_name,
      identity_number: identityNumber,
      phone: payload.phone,
      email: payload.email,
      notes: payload.notes
    }).select("id").single();
    if (!file.error && file.data?.id) {
      await supabase.from("staff_kindergarten_employments" as any).insert({
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
      await supabase.from("staff_timeline_events" as any).insert({
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
    }

    await writeUserCreationAudit({
      actorId: profile.id,
      actorRole: profile.role,
      gardenId: profile.garden_id,
      entityType: "staff",
      entityId: staff.id as string,
      action: "create_staff_user",
      afterData: { staff_id: staff.id, staff_user_id: user.id, approval_status: "pending_documents" }
    });

    return ok({ staff, credentials: oneTimeCredentials }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
