import type { User } from "@supabase/supabase-js";
import type { createAdminClient } from "@/lib/supabase/admin";

export type ContactProfile = {
  id?: string | null;
  contact_verification_required?: boolean | null;
  email_verified_at?: string | null;
  phone_verified_at?: string | null;
};

export type ManagementContactVerification = {
  required: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  complete: boolean;
};

export function managementContactVerification(user: User, profile?: ContactProfile | null): ManagementContactVerification {
  const required = profile?.contact_verification_required === true
    || user.app_metadata?.contact_verification_required === true;
  const emailVerified = Boolean(user.email_confirmed_at || profile?.email_verified_at);
  const phoneVerified = Boolean(user.phone_confirmed_at || profile?.phone_verified_at);
  return {
    required,
    emailVerified,
    phoneVerified,
    complete: !required || (emailVerified && phoneVerified)
  };
}

export function normalizeIsraeliMobile(value: string) {
  const compact = value.trim().replace(/[\s().-]/g, "");
  let digits = compact.replace(/^\+/, "").replace(/\D/g, "");
  if (digits.startsWith("00972")) digits = digits.slice(2);
  if (digits.startsWith("9720")) digits = `972${digits.slice(4)}`;
  if (digits.startsWith("05")) digits = `972${digits.slice(1)}`;
  const normalized = digits.startsWith("972") ? `+${digits}` : "";
  return /^\+9725\d{8}$/.test(normalized) ? normalized : null;
}

export function maskContact(value: string | null | undefined) {
  if (!value) return null;
  const at = value.indexOf("@");
  if (at > 0) return `${value.slice(0, 1)}***${value.slice(at)}`;
  return value.length > 4 ? `${value.slice(0, 4)}***${value.slice(-2)}` : "***";
}

export async function adminManagementContactVerification(admin: ReturnType<typeof createAdminClient>, profileId: string) {
  const [authResult, profileResult] = await Promise.all([
    admin.auth.admin.getUserById(profileId),
    admin.from("profiles").select("contact_verification_required,email_verified_at,phone_verified_at").eq("id", profileId).maybeSingle()
  ]);
  if (authResult.error || profileResult.error || !authResult.data.user || !profileResult.data) {
    return { available: false as const, state: null };
  }
  return {
    available: true as const,
    state: managementContactVerification(authResult.data.user, profileResult.data)
  };
}
