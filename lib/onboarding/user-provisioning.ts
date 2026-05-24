import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { UserRole } from "@/lib/roles";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export class DuplicateContactError extends Error {
  field: string;
  source: string;

  constructor(field: string, source: string, message = "המייל כבר קיים במערכת") {
    super(message);
    this.name = "DuplicateContactError";
    this.field = field;
    this.source = source;
  }
}

export function normalizeOptionalEmail(email?: string | null) {
  const normalized = String(email ?? "").trim().toLowerCase();
  return normalized || undefined;
}

export function normalizeOptionalPhone(phone?: string | null) {
  const normalized = String(phone ?? "").trim();
  return normalized || undefined;
}

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
  email: z.preprocess((value) => normalizeOptionalEmail(value as string | null), z.string().email().optional()),
  phone: z.preprocess((value) => normalizeOptionalPhone(value as string | null), z.string().optional()),
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
  conflictField?: string;
};

export async function checkEmailConflict({
  supabase,
  email,
  field
}: {
  supabase: ReturnType<typeof createAdminClient>;
  email?: string | null;
  field: string;
}) {
  const normalized = normalizeOptionalEmail(email);
  console.info("[email-duplicate-check]", { field, attemptedEmail: email ?? null, normalizedEmail: normalized ?? null });
  if (!normalized) return null;

  const [profileEmail, profileUsername, generatedCredential] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("email", normalized),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("username", normalized),
    supabase.from("generated_credentials").select("id", { count: "exact", head: true }).eq("username", normalized)
  ]);

  if ((profileEmail.count ?? 0) > 0) {
    console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "profiles.email" });
    return new DuplicateContactError(field, "profiles.email");
  }
  if ((profileUsername.count ?? 0) > 0) {
    console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "profiles.username" });
    return new DuplicateContactError(field, "profiles.username");
  }
  if ((generatedCredential.count ?? 0) > 0) {
    console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "generated_credentials.username" });
    return new DuplicateContactError(field, "generated_credentials.username");
  }
  return null;
}

export async function provisionAuthUser(input: ProvisionUserInput) {
  const supabase = createAdminClient();
  const requestedEmail = normalizeOptionalEmail(input.email);
  const email = requestedEmail || generateSystemEmail(input.role);
  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();
  const conflict = await checkEmailConflict({ supabase, email: requestedEmail, field: input.conflictField ?? `${input.role}_email` });
  if (conflict) throw conflict;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: input.fullName, phone: input.phone ?? null }
  });

  if (error || !data.user) {
    const authMessage = error?.message ?? "";
    console.warn("[email-duplicate-check-conflict]", { field: input.conflictField ?? `${input.role}_email`, normalizedEmail: email, source: "supabase_auth", authMessage });
    if (authMessage.toLowerCase().includes("already") || authMessage.toLowerCase().includes("registered")) {
      throw new DuplicateContactError(input.conflictField ?? `${input.role}_email`, "supabase_auth");
    }
    throw new Error(authMessage || "Could not create Supabase Auth user");
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
