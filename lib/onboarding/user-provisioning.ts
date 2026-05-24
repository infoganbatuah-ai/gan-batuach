import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { UserRole } from "@/lib/roles";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  const values = crypto.getRandomValues(new Uint32Array(14));
  const body = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return body + "1!";
}

export function generateSystemEmail(prefix: string) {
  const values = crypto.getRandomValues(new Uint32Array(6));
  const suffix = Array.from(values, (value) => alphabet[value % alphabet.length]).join("").toLowerCase();
  return prefix + "." + suffix + "@ganbatuach.local";
}

export const provisionedUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  temporary_password: z.string().min(8).optional()
});

type ProvisionUserInput = {
  role: UserRole;
  gardenId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  temporaryPassword?: string;
  createdBy?: string | null;
};

export async function provisionAuthUser(input: ProvisionUserInput) {
  const supabase = createAdminClient();
  const email = String(input.email || generateSystemEmail(input.role)).trim().toLowerCase();
  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: input.fullName, phone: input.phone ?? null }
  });

  if (error || !data.user) {
    const message = error?.message?.toLowerCase().includes("already") ? "כבר קיים משתמש עם האימייל הזה במערכת." : error?.message ?? "Could not create Supabase Auth user";
    throw new Error(message);
  }

  const profile: Record<string, unknown> = {
    id: data.user.id,
    role: input.role,
    garden_id: input.gardenId ?? null,
    full_name: input.fullName,
    phone: input.phone ?? null,
    active: true,
    must_change_password: true,
    username: email,
    email,
    created_by: input.createdBy ?? null
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new Error("המשתמש נוצר ב-Auth אך יצירת הפרופיל נכשלה: " + profileError.message);
  }

  const { error: credentialsError } = await supabase.from("generated_credentials").insert({
    user_id: data.user.id,
    username: email,
    temporary_password: temporaryPassword,
    created_by: input.createdBy ?? null
  });
  if (credentialsError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new Error("המשתמש נוצר אך שמירת פרטי ההתחברות לאדמין נכשלה: " + credentialsError.message);
  }

  return {
    supabase,
    user: data.user,
    oneTimeCredentials: {
      username: email,
      email,
      temporary_password: temporaryPassword
    }
  };
}

export async function writeUserCreationAudit({
  actorId,
  actorRole,
  gardenId,
  entityType,
  entityId,
  action,
  afterData
}: {
  actorId: string | null;
  actorRole: UserRole;
  gardenId?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  afterData: Json;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: actorRole,
    performed_by_user: actorId,
    performed_by_role: actorRole,
    garden_id: gardenId ?? null,
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    after_data: afterData
  });
  if (error) console.error("Audit log write failed", error);
}
