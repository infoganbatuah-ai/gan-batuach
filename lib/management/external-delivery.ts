import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider } from "@/lib/domain/email-provider";
import { getPushProviderForPlatform } from "@/lib/domain/push-provider";
import type { PushPlatform } from "@/lib/domain/push-service";

type DeliveryIntent = {
  id: string;
  notification_id: string;
  recipient_profile_id: string;
  channel: string;
  lease_token: string;
  attempts: number;
  dedupe_key: string | null;
};

type Decision = { status: "accepted_by_provider" | "unavailable" | "unverified_contact" | "skipped_preferences" | "suppressed_quiet_hours" | "failed_transient" | "failed_permanent"; provider: string; messageId?: string | null; code?: string | null; retryAt?: string | null };

const SAFE_TITLE = "עדכון חדש בגן בטוח";
const SAFE_BODY = "יש לך עדכון חדש במערכת. יש להיכנס לחשבון לצפייה בפרטים.";

export function managementDeliveryCapability() {
  const enabled = process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED === "true";
  return {
    in_app: "available",
    push: enabled && (["web", "android", "ios"] as PushPlatform[]).some((platform) => getPushProviderForPlatform(platform).getReadiness().canSendRealMessages) ? "provider_submission_available" : "not_configured",
    email: enabled && getEmailProvider("resend").checkReadiness().canSendRealMessages ? "provider_submission_available" : "not_configured",
    whatsapp: "not_configured",
    sms: "not_configured"
  } as const;
}

function inQuietHours(start: string | null, end: string | null, timeZone: string | null, now: Date) {
  if (!start || !end || start === end) return false;
  let hour: number; let minute: number;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timeZone || "Asia/Jerusalem", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    hour = Number(parts.find((part) => part.type === "hour")?.value);
    minute = Number(parts.find((part) => part.type === "minute")?.value);
  } catch { return true; } // Invalid timezone fails closed.
  const current = hour * 60 + minute;
  const toMinutes = (value: string) => { const [h, m] = value.split(":").map(Number); return h * 60 + m; };
  const from = toMinutes(start); const until = toMinutes(end);
  return from < until ? current >= from && current < until : current >= from || current < until;
}

async function decideDelivery(db: ReturnType<typeof createAdminClient>, intent: DeliveryIntent): Promise<Decision> {
  const admin = db;
  const [auth, notificationResult, profileResult, preferenceResult] = await Promise.all([
    admin.rpc("management_delivery_recipient_authorized", { p_notification_id: intent.notification_id }),
    admin.from("notifications").select("id,recipient_id,preference_category,source_domain,garden_id").eq("id", intent.notification_id).maybeSingle(),
    admin.from("profiles").select("id,email,phone,email_verified_at,phone_verified_at,active").eq("id", intent.recipient_profile_id).maybeSingle(),
    admin.from("communication_preferences").select("receive_email,receive_push,receive_sms,receive_whatsapp,quiet_hours_start,quiet_hours_end,quiet_hours_timezone,notification_category_channels,parent_category_channels").eq("profile_id", intent.recipient_profile_id).maybeSingle()
  ]);
  if (auth.error || auth.data !== true || notificationResult.error || profileResult.error || preferenceResult.error) return { status: "unavailable", provider: "authorization", code: "recipient_authority_unavailable" };
  const notification = notificationResult.data; const recipient = profileResult.data; const preference = preferenceResult.data;
  if (!notification || !recipient || notification.recipient_id !== recipient.id || !recipient.active) return { status: "unavailable", provider: "authorization", code: "recipient_no_longer_eligible" };
  const channelPreference = ({ email: "receive_email", push: "receive_push", sms: "receive_sms", whatsapp: "receive_whatsapp" } as const)[intent.channel as "email" | "push" | "sms" | "whatsapp"];
  if (!preference || !channelPreference || preference[channelPreference] !== true) return { status: "skipped_preferences", provider: "preferences" };
  const categoryChannels = (preference.notification_category_channels?.[notification.preference_category]
    ?? preference.parent_category_channels?.[notification.preference_category]) as string[] | undefined;
  if (!Array.isArray(categoryChannels) || !categoryChannels.includes(intent.channel)) return { status: "skipped_preferences", provider: "preferences" };
  if (inQuietHours(preference.quiet_hours_start, preference.quiet_hours_end, preference.quiet_hours_timezone, new Date())) {
    return { status: "suppressed_quiet_hours", provider: "quiet_hours", retryAt: new Date(Date.now() + 60 * 60_000).toISOString() };
  }
  if (intent.channel === "email") {
    if (!recipient.email || !recipient.email_verified_at) return { status: "unverified_contact", provider: "verification" };
    const provider = getEmailProvider("resend");
    if (!provider.checkReadiness().canSendRealMessages) return { status: "unavailable", provider: "resend", code: "provider_not_enabled" };
    const result = await provider.send({ to: recipient.email, subject: SAFE_TITLE, text: SAFE_BODY, category: notification.preference_category || "system", idempotencyKey: intent.dedupe_key || intent.id });
    if (result.status === "sent" && result.providerMessageId) return { status: "accepted_by_provider", provider: "resend", messageId: result.providerMessageId };
    if (result.retryable && intent.attempts < 3) return { status: "failed_transient", provider: "resend", code: result.failureReason ?? "provider_transient_error", retryAt: new Date(Date.now() + 15 * 60_000 * intent.attempts).toISOString() };
    return { status: "failed_permanent", provider: "resend", code: result.failureReason ?? "provider_rejected_or_unknown" };
  }
  if (intent.channel === "push") {
    const tokenResult = await admin.from("push_device_tokens").select("id,platform,device_token").eq("profile_id", recipient.id).eq("is_active", true).order("last_seen_at", { ascending: false }).limit(20);
    if (tokenResult.error || !tokenResult.data?.length) return { status: "unavailable", provider: "fcm", code: "no_active_device" };
    let accepted = 0; let firstMessageId: string | null = null;
    for (const token of tokenResult.data as Array<{ id: string; platform: PushPlatform; device_token: string }>) {
      const provider = getPushProviderForPlatform(token.platform);
      if (!provider.getReadiness().canSendRealMessages) continue;
      try {
        const result = await provider.send({ profileId: recipient.id, deviceTokenId: token.id, deviceToken: token.device_token, platform: token.platform, title: SAFE_TITLE, body: SAFE_BODY });
        if (result.ok && result.status === "sent" && result.providerMessageId) { accepted++; firstMessageId ??= result.providerMessageId; }
      } catch (error) {
        const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
        if (code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token") {
          await admin.from("push_device_tokens").update({ is_active: false, disabled_reason: "provider_invalid_token", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", token.id).eq("profile_id", recipient.id);
        }
      }
    }
    return accepted ? { status: "accepted_by_provider", provider: "fcm", messageId: firstMessageId } : { status: "unavailable", provider: "fcm", code: "no_provider_acceptance" };
  }
  // WhatsApp and SMS adapters are readiness-only until owner-controlled activation.
  return { status: "unavailable", provider: intent.channel, code: "paid_channel_not_activated" };
}

export async function processManagementDeliveryBatch(limit = 20) {
  if (process.env.GB_M31_EXTERNAL_DELIVERY_ENABLED !== "true") return { enabled: false, claimed: 0, completed: 0 };
  const db = createAdminClient();
  const admin = db;
  const claimed = await admin.rpc("claim_management_delivery_intents", { p_limit: Math.min(Math.max(limit, 1), 50) });
  if (claimed.error) throw new Error("delivery_claim_failed");
  let completed = 0;
  for (const intent of (claimed.data ?? []) as DeliveryIntent[]) {
    let decision: Decision;
    try { decision = await decideDelivery(db, intent); }
    catch { decision = { status: "failed_permanent", provider: "unknown", code: "submission_outcome_unknown_reconciliation_required" }; }
    const finished = await admin.rpc("finish_management_delivery_intent", {
      p_id: intent.id, p_lease_token: intent.lease_token, p_status: decision.status,
      p_provider: decision.provider, p_provider_message_id: decision.messageId ?? null,
      p_failure_code: decision.code ?? null, p_retry_at: decision.retryAt ?? null,
      p_estimated_cost_ils: null
    });
    if (finished.error || finished.data !== true) throw new Error("delivery_finalize_failed");
    completed++;
  }
  return { enabled: true, claimed: (claimed.data ?? []).length, completed };
}
