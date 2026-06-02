type SupabaseLike = {
  from: (table: string) => any;
};

export type PushPlatform = "web" | "android" | "ios";
export type PushProvider = "mock" | "web_push" | "fcm" | "apns" | "capacitor";
export type PushLogStatus = "queued_mock" | "sent_mock" | "queued" | "sent" | "failed" | "skipped_preferences" | "no_active_device" | "deduped";

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
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  critical?: boolean;
  metadata?: Record<string, unknown>;
};

function providerForPlatform(platform: PushPlatform): PushProvider {
  const mode = process.env.PUSH_PROVIDER || "mock";
  if (mode !== "real") return "mock";
  if (platform === "web" && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) return "web_push";
  if (platform === "android" && process.env.FCM_PROJECT_ID && process.env.FCM_SERVER_KEY) return "fcm";
  if (platform === "ios" && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID && process.env.APNS_BUNDLE_ID) return "apns";
  return "mock";
}

function logStatusForProvider(provider: PushProvider): PushLogStatus {
  if (provider === "mock") return "sent_mock";
  return "queued";
}

export function maskDeviceToken(token?: string | null) {
  if (!token) return null;
  if (token.length <= 10) return "***";
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

export async function registerPushDevice(supabase: SupabaseLike, input: RegisterPushDeviceInput) {
  const now = new Date().toISOString();
  const result = await supabase.from("push_device_tokens").upsert({
    profile_id: input.profileId,
    role: input.role,
    platform: input.platform,
    device_token: input.deviceToken,
    device_id: input.deviceId ?? null,
    app_version: input.appVersion ?? null,
    is_active: true,
    last_seen_at: now,
    updated_at: now,
    metadata: input.metadata ?? {}
  }, { onConflict: "device_token" }).select("id, profile_id, role, platform, device_id, app_version, is_active, last_seen_at, created_at, updated_at, metadata").single();

  return {
    ok: !result.error,
    device: result.data,
    error: result.error?.message ?? null
  };
}

export async function unregisterPushDevice(supabase: SupabaseLike, profileId: string, deviceToken?: string | null, deviceId?: string | null) {
  let query = supabase.from("push_device_tokens").update({
    is_active: false,
    updated_at: new Date().toISOString()
  }).eq("profile_id", profileId);

  if (deviceToken) query = query.eq("device_token", deviceToken);
  else if (deviceId) query = query.eq("device_id", deviceId);
  else query = query.eq("is_active", true);

  const result = await query.select("id, is_active");
  return {
    ok: !result.error,
    rows: result.data ?? [],
    error: result.error?.message ?? null
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

export async function preparePushForNotification(supabase: SupabaseLike, input: PreparePushInput) {
  const preference = await preferencesAllowPush(supabase, input.profileId, input.critical);
  const { data: tokens, error: tokensError } = await supabase
    .from("push_device_tokens")
    .select("id, platform, is_active")
    .eq("profile_id", input.profileId)
    .eq("is_active", true);

  if (tokensError) {
    const log = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      title: input.title,
      body: input.body ?? null,
      action_url: input.actionUrl ?? null,
      status: "failed",
      provider: "lookup",
      failure_reason: tokensError.message,
      metadata: input.metadata ?? {}
    });
    return { ok: false, logs: [], error: log.error?.message ?? tokensError.message };
  }

  if (!preference.allowed) {
    const skipped = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      title: input.title,
      body: input.body ?? null,
      action_url: input.actionUrl ?? null,
      status: "skipped_preferences",
      provider: "preferences",
      failure_reason: "User communication preferences do not allow push notifications.",
      metadata: input.metadata ?? {}
    });
    return { ok: !skipped.error, logs: [], error: skipped.error?.message ?? null };
  }

  const activeTokens = (tokens ?? []) as Array<{ id: string; platform: PushPlatform }>;
  if (!activeTokens.length) {
    const noDevice = await supabase.from("push_notification_logs").insert({
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      platform: "web",
      title: input.title,
      body: input.body ?? null,
      action_url: input.actionUrl ?? null,
      status: "no_active_device",
      provider: "mock",
      failure_reason: "No active push device token is registered for this user.",
      metadata: input.metadata ?? {}
    });
    return { ok: !noDevice.error, logs: [], error: noDevice.error?.message ?? null };
  }

  const rows = activeTokens.map((token) => {
    const provider = providerForPlatform(token.platform);
    const status = logStatusForProvider(provider);
    return {
      notification_id: input.notificationId ?? null,
      profile_id: input.profileId,
      device_token_id: token.id,
      platform: token.platform,
      title: input.title,
      body: input.body ?? null,
      action_url: input.actionUrl ?? null,
      status,
      provider,
      provider_message_id: provider === "mock" ? `mock_push_${Date.now()}_${token.id.slice(0, 8)}` : null,
      sent_at: status === "sent_mock" ? new Date().toISOString() : null,
      metadata: input.metadata ?? {}
    };
  });

  const inserted = await supabase.from("push_notification_logs").insert(rows).select("id, status, provider, platform");
  return {
    ok: !inserted.error,
    logs: inserted.data ?? [],
    error: inserted.error?.message ?? null
  };
}
