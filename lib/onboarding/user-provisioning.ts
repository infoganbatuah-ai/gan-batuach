import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";
import type { UserRole } from "@/lib/roles";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generateTemporaryPassword() {
  const values = crypto.getRandomValues(new Uint32Array(14));
  const body = Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  return `${body}1!`;
}

export const provisionedUserSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  temporary_password: z.string().min(8).optional()
});

type ProvisionUserInput = {
  role: UserRole;
  gardenId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  temporaryPassword?: string;
};

export async function provisionAuthUser(input: ProvisionUserInput) {
  const supabase = createAdminClient();
  const temporaryPassword = input.temporaryPassword ?? generateTemporaryPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email: input.email,
    password: temporaryPassword,
    email_confirm: true,
    app_metadata: { role: input.role },
    user_metadata: { full_name: input.fullName, phone: input.phone ?? null }
  });

  if (error || !data.user) {
    throw new Error(error?.message ?? "Could not create Supabase Auth user");
  }

  const profile: Database["public"]["Tables"]["profiles"]["Insert"] = {
    id: data.user.id,
    role: input.role,
    garden_id: input.gardenId ?? null,
    full_name: input.fullName,
    phone: input.phone ?? null,
    active: true,
    must_change_password: true
  };

  const { error: profileError } = await supabase.from("profiles").upsert(profile, { onConflict: "id" });

  if (profileError) {
    throw new Error(profileError.message);
  }

  return {
    supabase,
    user: data.user,
    oneTimeCredentials: {
      username: input.email,
      email: input.email,
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
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    actor_role: actorRole,
    garden_id: gardenId ?? null,
    entity_type: entityType,
    entity_id: entityId ?? null,
    action,
    after_data: afterData
  });
}
