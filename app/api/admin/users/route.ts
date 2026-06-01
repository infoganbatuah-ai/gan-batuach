import { z } from "zod";
import { fail, handleRouteError, ok } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTemporaryPassword, writeUserCreationAudit } from "@/lib/onboarding/user-provisioning";

const schema = z.object({
  action: z.enum(["regenerate_credentials", "reset_password", "send_password_reset", "deactivate", "reactivate", "update_profile"]),
  user_id: z.string().uuid(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["admin", "inspector", "manager", "owner", "staff", "parent"]).optional(),
  garden_id: z.string().uuid().nullable().optional(),
  active: z.boolean().optional(),
  notes: z.string().optional(),
  profile_image_url: z.string().optional(),
  reason: z.string().optional()
});

export async function POST(request: Request) {
  try {
    const { profile } = await requireRole(["admin"]);
    const payload = schema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: target, error: targetError } = await supabase.from("profiles").select("id, username, email, role, full_name").eq("id", payload.user_id).single();
    if (targetError || !target) return fail("המשתמש לא נמצא.", 404);

    if (payload.action === "update_profile") {
      const patch = {
        full_name: payload.full_name ?? null,
        phone: payload.phone ?? null,
        role: payload.role,
        garden_id: payload.garden_id ?? null,
        active: payload.active,
        notes: payload.notes ?? null,
        profile_image_url: payload.profile_image_url ?? null
      };
      const cleanPatch = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
      const { data, error } = await supabase.from("profiles").update(cleanPatch).eq("id", payload.user_id).select("*").single();
      if (error) return fail("שמירת פרטי המשתמש נכשלה: " + error.message, 400);
      if (payload.profile_image_url !== undefined) {
        if ((payload.role ?? target.role) === "staff") {
          const staffSync = await supabase.from("staff" as any).update({ profile_photo_url: payload.profile_image_url || null }).eq("profile_id", payload.user_id);
          if (staffSync.error) console.error("[admin-user-staff-photo-sync-failed]", { user_id: payload.user_id, message: staffSync.error.message });
        }
        if ((payload.role ?? target.role) === "inspector") {
          const inspectorSync = await supabase.from("inspectors" as any).update({ profile_photo_url: payload.profile_image_url || null }).eq("id", payload.user_id);
          if (inspectorSync.error) console.error("[admin-user-inspector-photo-sync-failed]", { user_id: payload.user_id, message: inspectorSync.error.message });
        }
        if ((payload.role ?? target.role) === "parent") {
          const parentSync = await supabase.from("parents" as any).update({ photo_url: payload.profile_image_url || null }).eq("profile_id", payload.user_id);
          if (parentSync.error) console.error("[admin-user-parent-photo-sync-failed]", { user_id: payload.user_id, message: parentSync.error.message });
        }
      }
      await writeUserCreationAudit({ actorId: profile.id, actorRole: "admin", entityType: "profiles", entityId: payload.user_id, action: "update_user_profile", afterData: cleanPatch });
      return ok(data);
    }

    if (payload.action === "deactivate" || payload.action === "reactivate") {
      const { error } = await supabase.from("profiles").update({ active: payload.action === "reactivate", deactivated_at: payload.action === "deactivate" ? new Date().toISOString() : null }).eq("id", payload.user_id);
      if (error) return fail("לא ניתן להשבית משתמש.", 400);
      await writeUserCreationAudit({ actorId: profile.id, actorRole: "admin", entityType: "profiles", entityId: payload.user_id, action: payload.action === "deactivate" ? "deactivate_user" : "reactivate_user", afterData: { reason: payload.reason ?? null, role: target.role } });
      return ok({ status: payload.action === "deactivate" ? "deactivated" : "active" });
    }

    if (payload.action === "send_password_reset") {
      const username = String(target.email || target.username || "").trim();
      if (!username) return fail("אין מייל לשליחת איפוס סיסמה.", 422);
      const { error } = await supabase.auth.admin.generateLink({ type: "recovery", email: username });
      if (error) return fail("לא ניתן לשלוח איפוס סיסמה: " + error.message, 400);
      await supabase.from("generated_credentials").update({ reset_sent_at: new Date().toISOString() }).eq("user_id", payload.user_id);
      await writeUserCreationAudit({ actorId: profile.id, actorRole: "admin", entityType: "profiles", entityId: payload.user_id, action: "send_password_reset", afterData: { username } });
      return ok({ status: "reset_sent" });
    }

    const temporaryPassword = generateTemporaryPassword();
    const { error: passwordError } = await supabase.auth.admin.updateUserById(payload.user_id, { password: temporaryPassword });
    if (passwordError) return fail("איפוס הסיסמה נכשל: " + passwordError.message, 400);

    const username = String(target.email || target.username || "").trim();
    const { error: credentialError } = await supabase.from("generated_credentials").insert({
      user_id: payload.user_id,
      username,
      temporary_password: temporaryPassword,
      created_by: profile.id
    });
    if (credentialError) return fail("הסיסמה אופסה אך שמירת פרטי ההתחברות נכשלה.", 400);

    await supabase.from("profiles").update({ must_change_password: true }).eq("id", payload.user_id);
    await writeUserCreationAudit({ actorId: profile.id, actorRole: "admin", entityType: "profiles", entityId: payload.user_id, action: payload.action, afterData: { username } });

    return ok({ username, temporary_password: temporaryPassword });
  } catch (error) {
    return handleRouteError(error);
  }
}
