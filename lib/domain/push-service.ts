type SupabaseLike = {
  from: (table: string) => any;
};

import { createHash } from "crypto";
import { getPushProviderForPlatform } from "./push-provider";
import type { PushProviderResult } from "./push-provider";

export type PushPlatform = "web" | "android" | "ios";
export type PushProvider = "mock" | "mock_push" | "web_push" | "fcm" | "apns" | "capacitor" | "custom";
export type PushLogStatus = "queued_mock" | "sent_mock" | "queued" | "sent" | "delivered" | "opened" | "failed" | "dead_letter" | "skipped_preferences" | "no_active_device" | "deduped";
export type PushCategory = "registration" | "parent_approval" | "child_approval" | "payment_reminder" | "safety_alert" | "observer_alert" | "inspection_alert" | "camera_alert" | "system_notification";

export type RegisterPushDeviceInput = {
  profileId: string;
  role: string;
  platform: PushPlatform;
  deviceToken: string;
  deviceId?: string | null;
  appVersion?: string | null;
  metadata?: Record<string, unknown>;
};

export type PreparePushInput = {
  profileId: string;
  notificationId?: string | null;
  templateKey?: string | null;
  category?: PushCategory | string | null;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  deepLinkType?: "child_profile" | "camera" | "incident" | "payment" | "inspection" | "observer_event" | "system" | string | null;
  critical?: boolean;
  metadata?: Record<string, unknown>;
};

export function maskDeviceToken(token?: string | null) {
  if (!token) return null;
  if (token.length <= 10) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function registerPushDevice(supabase: SupabaseLike, input: RegisterPushDeviceInput) {
  const source = input.metadata?.source;
  // Source is a consistency marker, not product attestation. Require the
  // marker on every write so an unlabelled row cannot be claimed by either
  // product through the shared registration endpoint.
  const validSource = (input.platform === "web" && (source === "fcm_web" || source === "digital_observer_fcm")) ||
    ((input.platform === "ios" || input.platform === "android") && source === "digital_observer_native");
  if (!validSource) return { ok: false, device: null, error: "push_source_required" };
  const now = new Date().toISOString();
  const table = supabase.from("push_device_tokens");
  const existing = await table.select("id, profile_id, device_trust_status, platform, device_id, metadata")
    .eq("device_token", input.deviceToken).maybeSingle();
  if (existing.error) return { ok: false, device: null, error: existing.error.message };
  // A token cannot transfer to another account through registration. A
  // blocked/revoked trust decision cannot be cleared by a client re-registering.
  if (existing.data && (existing.data.profile_id !== input.profileId ||
      existing.data.device_trust_status === "blocked" ||
      existing.data.device_trust_status === "revoked" ||
      existing.data.platform !== input.platform ||
      (existing.data.device_id && existing.data.device_id !== input.deviceId) ||
      existing.data.metadata?.source !== source)) {
    return { ok: false, device: null, error: "push_token_registration_denied" };
  }
  const values = {
    profile_id: input.profileId,
    role: input.role,
    platform: input.platform,
    device_token: input.deviceToken,
    token_hash: hashDeviceToken(input.deviceToken),
    device_id: input.deviceId ?? null,
    app_version: input.appVersion ?? null,
    is_active: true,
    disabled_reason: null,
    revoked_at: null,
    provider: getPushProviderForPlatform(input.platform).name,
    // Device form factor and client metadata do not prove product ownership.
    // Every registration loses any previous positive device_trust_status.
    // A future private product-binding table requires its own atomic
    // invalidation; no such table is deployed by this change.
    app_channel: input.platform === "web" ? "web" : "unknown",
    device_trust_status: "unknown",
    device_model: null,
    os_version: null,
    build_number: null,
    biometric_capable: null,
    last_seen_at: now,
    updated_at: now,
    metadata: input.metadata ?? {}
  };
  const columns = "id, profile_id, role, platform, device_id, app_version, is_active, last_seen_at, created_at, updated_at, metadata";
  let update = existing.data
    ? table.update(values).eq("id", existing.data.id)
      .eq("profile_id", input.profileId).eq("device_token", input.deviceToken)
      .eq("platform", existing.data.platform)
      .eq("device_trust_status", existing.data.device_trust_status)
    : null;
  if (update) {
    update = existing.data.device_id === null ? update.is("device_id", null) : update.eq("device_id", existing.data.device_id);
    update = update.contains("metadata", { source });
  }
  const result = update
    ? await update.select(columns).maybeSingle()
    : await table.insert(values).select(columns).single();

  return {
    // Zero updated rows means the compare-and-update lost a race. Never
    // reinterpret that as a successful registration.
    ok: !result.error && !!result.data,
    device: result.data,
    error: result.error?.message ?? (result.data ? null : "push_token_registration_conflict")
  };
}

export async function unregisterPushDevice(supabase: SupabaseLike, profileId: string, deviceToken?: string | null, deviceId?: string | null, expectedSource?: string | null) {
  // This operation removes one current device. An empty selector must not
  // silently revoke every Gan and Observer token belonging to the profile.
  if (!deviceToken && !deviceId) return { ok: false, rows: [], error: "push_device_selector_required" };
  let exactTokenId: string | null = null;
  if (!deviceToken && deviceId) {
    // device_id is client-supplied and not a product identity. Never let a
    // native logout revoke several token rows with the same local reference.
    const match = await supabase.from("push_device_tokens")
      .select("id, metadata").eq("profile_id", profileId).eq("device_id", deviceId)
      .eq("is_active", true).limit(2);
    if (match.error) return { ok: false, rows: [], error: match.error.message };
    if ((match.data ?? []).length > 1) {
      return { ok: false, rows: [], error: "push_device_id_ambiguous" };
    }
    if (!(match.data ?? []).length) return { ok: true, rows: [], error: null };
    // This is an accidental cross-product revocation fence, not proof of app
    // identity: metadata.source was originally supplied by a client. A
    // server-owned product binding is still required for attestation.
    if (expectedSource && match.data[0].metadata?.source !== expectedSource)
      return { ok: false, rows: [], error: "push_device_source_mismatch" };
    exactTokenId = match.data[0].id;
  }
  let query = supabase.from("push_device_tokens").update({
    is_active: false,
    disabled_reason: "unregistered_by_user",
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("profile_id", profileId);

  if (deviceToken) query = query.eq("device_token", deviceToken);
  else if (exactTokenId) {
    query = query.eq("id", exactTokenId).eq("is_active", true);
    if (expectedSource) query = query.contains("metadata", { source: expectedSource });
  }
  else query = query.eq("is_active", true);

  const result = await query.select("id, is_active");
  return {
    ok: !result.error && (!expectedSource || !exactTokenId || (result.data ?? []).length === 1),
    rows: result.data ?? [],
    error: result.error?.message ?? (expectedSource && exactTokenId && !(result.data ?? []).length ? "push_device_source_conflict" : null)
  };
}

async function preferencesAllowPush(supabase: SupabaseLike, profileId: string, critical?: boolean) {
  const { data, error } = await supabase
    .from("communication_preferences")
    .select("receive_push, critical_push_allowed")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) return { allowed: false, error: error.message };
  if (!data) return { allowed: true, error: null };
  if (critical && data.critical_push_allowed !== false) return { allowed: true, error: null };
  return { allowed: data.receive_push !== false, error: null };
}

async function categoryPreferencesAllowPush(supabase: SupabaseLike, profileId: string, category?: string | null, critical?: boolean) {
  if (!category) return { allowed: true, error: null };
  const { data, error } = await supabase
    .from("push_category_preferences")
    .select("enabled, critical_only")
    .eq("profile_id", profileId)
    .eq("category", category)
    .maybeSingle();
  if (error) return { allowed: false, error: error.message };
  if (!data) return { allowed: true, error: null };
  if (data.enabled === false) return { allowed: false, error: null };
  if (data.critical_only && !critical) return { allowed: false, error: null };
  return { allowed: true, error: null };
}

async function getPushTemplate(supabase: SupabaseLike, templateKey?: string | null) {
  if (!templateKey) return null;
  const { data, error } = await supabase
    .from("push_templates")
    .select("id, category, default_action_type, default_action_url")
    .eq("template_key", templateKey)
    .maybeSingle();
  if (error) return null;
  return data;
}

export async function preparePushForNotification(supabase: SupabaseLike, input: PreparePushInput) {
  const template = await getPushTemplate(supabase, input.templateKey);
  const category = input.category ?? template?.category ?? "system_notification";
  const deepLinkType = input.deepLinkType ?? template?.default_action_type ?? null;
  const actionUrl = input.actionUrl ?? template?.default_action_url ?? null;
  const preference = await preferencesAllowPush(supabase, input.profileId, input.critical);
  const categoryPreference = await categoryPreferencesAllowPush(supabase, input.profileId, category, input.critical);
  const preferenceError = preference.error ?? categoryPreference.error;
  if (preferenceError) {
    const failed = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      template_id: template?.id ?? null,
      category,
      title: input.title,
      body: input.body ?? null,
      action_url: actionUrl,
      deep_link_type: deepLinkType,
      status: "failed",
      provider: "preferences",
      failure_reason: preferenceError,
      metadata: input.metadata ?? {}
    });
    return { ok: false, logs: [], error: failed.error?.message ?? preferenceError };
  }
  const { data: tokens, error: tokensError } = await supabase
    .from("push_device_tokens")
    .select("id, platform, device_token, is_active")
    .eq("profile_id", input.profileId)
    .eq("is_active", true)
    .eq("platform", "web")
    .contains("metadata", { source: "fcm_web" });

  if (tokensError) {
    const log = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      template_id: template?.id ?? null,
      category,
      title: input.title,
      body: input.body ?? null,
      action_url: actionUrl,
      deep_link_type: deepLinkType,
      status: "failed",
      provider: "lookup",
      failure_reason: tokensError.message,
      metadata: input.metadata ?? {}
    });
    return { ok: false, logs: [], error: log.error?.message ?? tokensError.message };
  }

  if (!preference.allowed || !categoryPreference.allowed) {
    const skipped = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      template_id: template?.id ?? null,
      category,
      title: input.title,
      body: input.body ?? null,
      action_url: actionUrl,
      deep_link_type: deepLinkType,
      status: "skipped_preferences",
      provider: "preferences",
      failure_reason: "User communication preferences do not allow push notifications.",
      metadata: input.metadata ?? {}
    });
    return { ok: !skipped.error, logs: [], error: skipped.error?.message ?? null };
  }

  const activeTokens = (tokens ?? []) as Array<{ id: string; platform: PushPlatform; device_token: string }>;
  if (!activeTokens.length) {
    const noDevice = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      template_id: template?.id ?? null,
      category,
      title: input.title,
      body: input.body ?? null,
      action_url: actionUrl,
      deep_link_type: deepLinkType,
      status: "no_active_device",
      provider: "mock_push",
      failure_reason: "No active push device token is registered for this user.",
      metadata: input.metadata ?? {}
    });
    return { ok: !noDevice.error, logs: [], error: noDevice.error?.message ?? null };
  }

  const rows = await Promise.all(activeTokens.map(async (token) => {
    const provider = getPushProviderForPlatform(token.platform);
    let providerResult: PushProviderResult;
    let outcomeUnknown = false;
    try {
      providerResult = await provider.send({
        profileId: input.profileId,
        deviceTokenId: token.id,
        deviceToken: token.device_token,
        platform: token.platform,
        title: input.title,
        body: input.body ?? null,
        actionUrl,
        category,
        deepLinkType,
        metadata: input.metadata ?? {}
      });
    } catch {
      // A provider may have accepted the message before its response failed.
      // Record this token independently without scheduling an unsafe retry.
      outcomeUnknown = true;
      providerResult = { ok: false, status: "failed", provider: provider.name, failureReason: "provider_submission_outcome_unknown" };
    }
    return {
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      device_token_id: token.id,
      platform: token.platform,
      template_id: template?.id ?? null,
      category,
      title: input.title,
      body: input.body ?? null,
      action_url: actionUrl,
      deep_link_type: deepLinkType,
      status: providerResult.status,
      provider: providerResult.provider,
      provider_message_id: providerResult.providerMessageId ?? null,
      provider_reference: providerResult.providerReference ?? null,
      failure_reason: providerResult.failureReason ?? null,
      sent_at: providerResult.sentAt ?? null,
      failed_at: providerResult.status === "failed" ? new Date().toISOString() : null,
      next_retry_at: providerResult.status === "failed" && !outcomeUnknown ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      metadata: {
        ...(input.metadata ?? {}),
        ...(providerResult.metadata ?? {})
      }
    };
  }));

  const inserted = await supabase.from("push_notification_logs").insert(rows).select("id, status, provider, platform");
  return {
    ok: !inserted.error,
    logs: inserted.data ?? [],
    error: inserted.error?.message ?? null
  };
}
