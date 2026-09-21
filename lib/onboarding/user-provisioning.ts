import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { UserRole } from "@/lib/roles";
import { writeAdminActionEvent } from "@/lib/security/audit-log-service";
import { authCallbackUrl } from "@/lib/domain/auth-flow";


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

function provisioningDebugLogsEnabled() {
  return process.env.NODE_ENV !== "production";
}

export const provisionedUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.preprocess((value) => normalizeOptionalEmail(value as string | null), z.string().email().optional()),
  phone: z.preprocess((value) => normalizeOptionalPhone(value as string | null), z.string().optional())
});

type ProvisionUserInput = {
  role: UserRole;
  gardenId?: string | null;
  fullName: string;
  email?: string | null;
  phone?: string | null;
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
  if (provisioningDebugLogsEnabled()) console.info("[email-duplicate-check]", { field, attemptedEmail: email ?? null, normalizedEmail: normalized ?? null });
  if (!normalized) return null;

  const [profileEmail, profileUsername, generatedCredential] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("email", normalized),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("username", normalized),
    supabase.from("generated_credentials").select("id", { count: "exact", head: true }).eq("username", normalized)
  ]);

  if ((profileEmail.count ?? 0) > 0) {
    if (provisioningDebugLogsEnabled()) console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "profiles.email" });
    return new DuplicateContactError(field, "profiles.email");
  }
  if ((profileUsername.count ?? 0) > 0) {
    if (provisioningDebugLogsEnabled()) console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "profiles.username" });
    return new DuplicateContactError(field, "profiles.username");
  }
  if ((generatedCredential.count ?? 0) > 0) {
    if (provisioningDebugLogsEnabled()) console.warn("[email-duplicate-check-conflict]", { field, normalizedEmail: normalized, source: "generated_credentials.username" });
    return new DuplicateContactError(field, "generated_credentials.username");
  }
  return null;
}

export async function provisionAuthUser(input: ProvisionUserInput) {
  const supabase = createAdminClient();
  const requestedEmail = normalizeOptionalEmail(input.email);
  if (!requestedEmail) throw new Error("נדרש מייל לקבלת הזמנה מאובטחת.");
  const email = requestedEmail;
  const conflict = await checkEmailConflict({ supabase, email: requestedEmail, field: input.conflictField ?? `${input.role}_email` });
  if (conflict) throw conflict;

  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
    redirectTo: authCallbackUrl("gan_batuach", "/dashboard", "verify"),
    data: { full_name: input.fullName, phone: input.phone ?? null, role: input.role }
  });

  if (error || !data.user) {
    const authMessage = error?.message ?? "";
    console.warn("[email-duplicate-check-conflict]", { field: input.conflictField ?? `${input.role}_email`, normalizedEmail: email, source: "supabase_auth", authMessage });
    if (authMessage.toLowerCase().includes("already") || authMessage.toLowerCase().includes("registered")) {
      throw new DuplicateContactError(input.conflictField ?? `${input.role}_email`, "supabase_auth");
    }
    throw new Error(authMessage || "Could not create Supabase Auth user");
  }

  const roleUpdate = await supabase.auth.admin.updateUserById(data.user.id, {
    app_metadata: { role: input.role }
  });
  if (roleUpdate.error) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new Error("לא ניתן להגדיר את תפקיד החשבון המוזמן.");
  }

  const profile: Record<string, unknown> = {
    id: data.user.id,
    role: input.role,
    garden_id: input.gardenId ?? null,
    full_name: input.fullName,
    phone: input.phone ?? null,
    active: true,
    must_change_password: false,
    username: email,
    email,
    created_by: input.createdBy ?? null
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });

  if (profileError) {
    await supabase.auth.admin.deleteUser(data.user.id);
    throw new Error("המשתמש נוצר ב-Auth אך יצירת הפרופיל נכשלה: " + profileError.message);
  }

  return {
    supabase,
    user: data.user,
    oneTimeCredentials: {
      username: email,
      email
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
  await writeAdminActionEvent({
    eventType: action,
    actorProfileId: actorId,
    actorRole,
    targetType: entityType,
    targetId: entityId ?? null,
    gardenId: gardenId ?? null,
    metadata: afterData,
    riskLevel: "medium"
  });
}
