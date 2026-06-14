import "server-only";

import crypto from "node:crypto";
import { writeSecurityEvent } from "@/lib/security/audit-log-service";

type SensitiveAction =
  | "camera_view"
  | "medical_view"
  | "document_download"
  | "payment_change"
  | "role_change"
  | "kindergarten_activation"
  | "camera_permission_change"
  | "data_export"
  | "data_deletion"
  | "security_settings"
  | "inspection_submit"
  | "inspection_signature"
  | "attendance_override";

type MfaRoleDefault = { status: "optional" | "required" | "grace_period"; sensitiveOnly?: boolean; graceDays: number };

const roleDefaults: Record<string, MfaRoleDefault> = {
  admin: { status: "required", graceDays: 0 },
  owner: { status: "required", graceDays: 14 },
  manager: { status: "required", graceDays: 14 },
  inspector: { status: "required", graceDays: 7 },
  staff: { status: "required", graceDays: 21 },
  parent: { status: "grace_period", sensitiveOnly: true, graceDays: 30 },
  observer_site_owner: { status: "required", graceDays: 14 },
  network_manager: { status: "required", graceDays: 14 }
};

export function safeDeviceFingerprint(input: { userAgent?: string | null; ip?: string | null; acceptLanguage?: string | null }) {
  return crypto.createHash("sha256").update([input.userAgent ?? "", input.acceptLanguage ?? "", input.ip ?? ""].join("|")).digest("hex");
}

export function roleMfaDefault(role?: string | null) {
  return roleDefaults[String(role ?? "")] ?? ({ status: "optional", graceDays: 30 } satisfies MfaRoleDefault);
}

export async function ensureMfaReadinessRecord(supabase: any, profile: { id: string; role?: string | null }) {
  const rolePolicy = roleMfaDefault(profile.role);
  const requiredAt = new Date();
  const graceUntil = new Date(Date.now() + rolePolicy.graceDays * 24 * 60 * 60 * 1000);
  await supabase.from("mfa_enrollment_status" as any).upsert({
    profile_id: profile.id,
    role: profile.role ?? "parent",
    mfa_required: rolePolicy.status !== "optional",
    enforcement_status: rolePolicy.status,
    mfa_required_at: requiredAt.toISOString(),
    mfa_grace_until: rolePolicy.status === "required" && rolePolicy.graceDays === 0 ? requiredAt.toISOString() : graceUntil.toISOString(),
    sensitive_actions_blocked: false,
    metadata: { source: "phase155_identity_security", sensitive_only: Boolean(rolePolicy.sensitiveOnly) }
  }, { onConflict: "profile_id" });
}

export async function getMfaGateStatus(supabase: any, profile: { id: string; role?: string | null }, action: SensitiveAction) {
  await ensureMfaReadinessRecord(supabase, profile);
  const result = await supabase
    .from("mfa_enrollment_status" as any)
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  const row = result.data as any;
  const enrolled = row?.enrollment_status === "enrolled" && (row?.authenticator_app_enabled || row?.sms_otp_enabled || row?.backup_codes_generated || row?.supabase_totp_enrolled);
  const lastVerifiedAt = row?.mfa_last_verified_at ?? row?.last_verified_at ?? null;
  const fresh = lastVerifiedAt ? Date.now() - new Date(lastVerifiedAt).getTime() <= 30 * 60 * 1000 : false;
  const graceUntil = row?.mfa_grace_until ?? row?.enforcement_deadline ?? null;
  const inGrace = graceUntil ? new Date(graceUntil).getTime() > Date.now() : false;
  const required = row?.mfa_required === true || roleMfaDefault(profile.role).status !== "optional";
  const sensitiveBlock = required && !enrolled && !inGrace;
  const freshChallengeRequired = required && enrolled && !fresh && [
    "camera_view",
    "medical_view",
    "document_download",
    "payment_change",
    "role_change",
    "kindergarten_activation",
    "camera_permission_change",
    "data_export",
    "data_deletion",
    "security_settings",
    "inspection_submit",
    "inspection_signature"
  ].includes(action);
  return {
    allowed: !sensitiveBlock && !freshChallengeRequired,
    enrolled,
    fresh,
    required,
    inGrace,
    reason: sensitiveBlock ? "mfa_not_enrolled" : freshChallengeRequired ? "fresh_mfa_required" : null,
    message: sensitiveBlock || freshChallengeRequired ? "נדרש אימות נוסף כדי להגן על המידע." : null,
    row
  };
}

export async function recordTrustedDevice(supabase: any, input: { profileId: string; role?: string | null; ip?: string | null; userAgent?: string | null; acceptLanguage?: string | null; platform?: string | null; deviceName?: string | null }) {
  const fingerprint = safeDeviceFingerprint({ userAgent: input.userAgent, ip: input.ip, acceptLanguage: input.acceptLanguage });
  const existing = await supabase.from("trusted_devices" as any).select("*").eq("profile_id", input.profileId).eq("device_fingerprint_hash", fingerprint).maybeSingle();
  const now = new Date().toISOString();
  const payload = {
    profile_id: input.profileId,
    user_id: input.profileId,
    device_fingerprint_hash: fingerprint,
    device_fingerprint: fingerprint,
    device_label: input.deviceName ?? "מכשיר חדש",
    device_name: input.deviceName ?? "מכשיר חדש",
    user_agent: input.userAgent ?? null,
    ip_address: input.ip ?? null,
    platform: input.platform ?? null,
    last_seen_at: now,
    risk_status: existing.data?.risk_status ?? existing.data?.trust_status ?? "new",
    trust_status: existing.data?.trust_status ?? "new",
    metadata: { source: "phase155_identity_security" }
  };
  const write = existing.data?.id
    ? await supabase.from("trusted_devices" as any).update(payload).eq("id", existing.data.id).select("*").single()
    : await supabase.from("trusted_devices" as any).insert(payload).select("*").single();
  if (write.error) throw new Error(write.error.message);
  if (!existing.data) {
    await supabase.from("security_events" as any).insert({
      event_type: "new_device_login",
      severity: "medium",
      status: "open",
      profile_id: input.profileId,
      role: input.role ?? null,
      ip: input.ip ?? null,
      user_agent: input.userAgent ?? null,
      device_id: write.data?.id ?? null,
      source: "trusted_device_registry",
      description: "New device login detected",
      metadata: { platform: input.platform ?? null }
    });
    await writeSecurityEvent({
      eventType: "new_device_login",
      actorProfileId: input.profileId,
      actorRole: input.role ?? null,
      targetType: "trusted_device",
      targetId: write.data?.id ?? null,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      deviceFingerprint: fingerprint,
      metadata: { platform: input.platform ?? null },
      riskLevel: "medium"
    });
  }
  return write.data;
}

export function sensitiveActionLabel(action: SensitiveAction) {
  return {
    camera_view: "צפייה במצלמות",
    medical_view: "צפייה במידע רפואי",
    document_download: "הורדת מסמך רגיש",
    payment_change: "שינוי פרטי תשלום",
    role_change: "שינוי תפקיד",
    kindergarten_activation: "הפעלת גן",
    camera_permission_change: "שינוי הרשאות מצלמה",
    data_export: "ייצוא מידע",
    data_deletion: "מחיקת/אנונימיזציית מידע",
    security_settings: "הגדרות אבטחה",
    inspection_submit: "הגשת פיקוח",
    inspection_signature: "חתימת פיקוח",
    attendance_override: "תיקון נוכחות"
  }[action];
}
