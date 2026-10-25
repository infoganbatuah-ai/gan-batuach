type SupabaseLike = {
  // The shared push tables are not yet represented in the generated client types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

import { createHash } from "crypto";
import { getPushProviderForPlatform } from "./push-provider";

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

type PushTokenRow = {
  id: string;
  profile_id: string;
  role: string;
  platform: PushPlatform;
  device_id: string | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
};

const registrationColumns = "id, profile_id, role, platform, device_id, app_version, is_active, last_seen_at, created_at, updated_at, metadata";

function registrationConflict() {
  return { ok: false, device: null, error: "PUSH_TOKEN_BINDING_CONFLICT", conflict: true };
}

function registrationError(error: string) {
  return { ok: false, device: null, error, conflict: false };
}

function registrationBinding(metadata: Record<string, unknown> | null | undefined) {
  return {
    source: metadata?.source ?? null,
    observerSiteId: metadata?.observer_site_id ?? null
  };
}

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
  const now = new Date().toISOString();
  const binding = registrationBinding(input.metadata);
  const existingResult = await supabase.from("push_device_tokens")
    .select("id, profile_id, role, platform, device_id, is_active, metadata")
    .eq("device_token", input.deviceToken).maybeSingle();
  if (existingResult.error) return registrationError(existingResult.error.message);
  const existing = existingResult.data as PushTokenRow | null;
  if (existing && (existing.profile_id !== input.profileId || existing.role !== input.role
    || existing.platform !== input.platform || existing.device_id !== (input.deviceId ?? null)
    || !existing.is_active || registrationBinding(existing.metadata).source !== binding.source
    || registrationBinding(existing.metadata).observerSiteId !== binding.observerSiteId)) {
    return registrationConflict();
  }

  // A provider token rotation must not leave a second active token for the
  // same installation. Revocation is an explicit, separate user action.
  if (input.deviceId) {
    const installation = await supabase.from("push_device_tokens").select("id, device_token")
      .eq("profile_id", input.profileId).eq("device_id", input.deviceId)
      .eq("is_active", true).limit(2);
    if (installation.error) return registrationError(installation.error.message);
    if ((installation.data ?? []).some((row: { id: string; device_token: string }) => row.device_token !== input.deviceToken)) {
      return registrationConflict();
    }
  }

  if (existing) {
    // Replays may refresh liveness/version only. Identity, site and token
    // metadata never move through this path, even for a database admin.
    let update = supabase.from("push_device_tokens")
      .update({ app_version: input.appVersion ?? null, last_seen_at: now, updated_at: now })
      .eq("id", existing.id).eq("profile_id", input.profileId).eq("device_token", input.deviceToken)
      .eq("role", input.role).eq("platform", input.platform).eq("is_active", true)
      .contains("metadata", existing.metadata ?? {});
    update = input.deviceId ? update.eq("device_id", input.deviceId) : update.is("device_id", null);
    const replay = await update.select(registrationColumns).maybeSingle();
    if (replay.error) return registrationError(replay.error.message);
    if (!replay.data) return registrationConflict();
    return { ok: true, device: replay.data, error: null, conflict: false };
  }

  const result = await supabase.from("push_device_tokens").insert({
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
    last_seen_at: now,
    updated_at: now,
    metadata: input.metadata ?? {}
  }).select(registrationColumns).single();

  // A concurrent registration can win the unique device_token index after
  // our read; never retry it as an upsert or transfer ownership.
  if (result.error?.code === "23505") return registrationConflict();

  return {
    ok: !result.error,
    device: result.data,
    error: result.error?.message ?? null,
    conflict: false
  };
}

export type ObserverPushScope = {
  source: "digital_observer_native" | "digital_observer_fcm";
  siteId: string;
};

export async function unregisterPushDevice(
  supabase: SupabaseLike,
  profileId: string,
  deviceToken?: string | null,
  deviceId?: string | null,
  observerScope?: ObserverPushScope
) {
  if (!deviceToken && !deviceId) return { ok: false, rows: [], error: "PUSH_REVOCATION_TARGET_REQUIRED" };
  let query = supabase.from("push_device_tokens").update({
    is_active: false,
    disabled_reason: "unregistered_by_user",
    revoked_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).eq("profile_id", profileId).eq("is_active", true);

  if (deviceToken) query = query.eq("device_token", deviceToken);
  if (deviceId) query = query.eq("device_id", deviceId);
  if (observerScope) query = query.contains("metadata", {
    source: observerScope.source,
    observer_site_id: observerScope.siteId
  });

  const result = await query.select("id, is_active");
  if (result.error || !observerScope) return {
    ok: !result.error,
    rows: result.data ?? [],
    error: result.error?.message ?? null,
    confirmed: false
  };

  // A lost response after a successful UPDATE is retried idempotently. A
  // second, exact owner-scoped read must confirm no active row remains before
  // the native client discards its local revocation target.
  let remaining = supabase.from("push_device_tokens").select("id")
    .eq("profile_id", profileId).eq("is_active", true);
  if (deviceToken) remaining = remaining.eq("device_token", deviceToken);
  if (deviceId) remaining = remaining.eq("device_id", deviceId);
  remaining = remaining.contains("metadata", {
    source: observerScope.source,
    observer_site_id: observerScope.siteId
  });
  const verification = await remaining.limit(1);
  const confirmed = !verification.error && Array.isArray(result.data)
    && result.data.every((row: { is_active: boolean }) => row.is_active === false)
    && Array.isArray(verification.data) && verification.data.length === 0;
  return {
    ok: confirmed,
    rows: result.data ?? [],
    error: verification.error?.message ?? (confirmed ? null : "PUSH_REVOCATION_UNCONFIRMED"),
    confirmed
  };
}

async function preferencesAllowPush(supabase: SupabaseLike, profileId: string, critical?: boolean) {
  const { data, error } = await supabase
    .from("communication_preferences")
    .select("receive_push, critical_push_allowed")
    .eq("profile_id", profileId)
    .maybeSingle();
  if (error) return { allowed: true, error: error.message };
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
  if (error) return { allowed: true, error: error.message };
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
  const { data: tokens, error: tokensError } = await supabase
    .from("push_device_tokens")
    .select("id, platform, device_token, is_active")
    .eq("profile_id", input.profileId)
    .eq("is_active", true);

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
    const providerResult = await provider.send({
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
      next_retry_at: providerResult.status === "failed" ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
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
