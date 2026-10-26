/* eslint-disable @typescript-eslint/no-explicit-any -- service consumes newly migrated tables before generated Supabase types exist. */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assertEquivalentStoredDelivery, assertRecipientAuthorization, createDeliveryPlan, isInQuietHours, minimizeNotificationContent, transitionForProviderOutcome,
  type DeliveryChannel, type ProviderOutcome, type RecipientAuthorization, type Severity
} from "./notification-orchestration";
import { providerAdapter, type SandboxBehavior } from "./notification-providers";

type AnySupabase = SupabaseClient<any>;

function hhmm(value: unknown) {
  if (typeof value !== "string") return null;
  const match = /^(\d{2}:\d{2})/.exec(value);
  return match?.[1] ?? null;
}

export async function loadRecipientAuthorization(admin: AnySupabase, input: { siteId: string; profileId: string; channel: DeliveryChannel }) {
  const [siteResult, profileResult, membershipResult, settingResult] = await Promise.all([
    admin.from("observer_sites").select("id,owner_profile_id,site_type,garden_id").eq("id", input.siteId).maybeSingle(),
    admin.from("profiles").select("id,active,role").eq("id", input.profileId).maybeSingle(),
    admin.from("observer_site_memberships").select("observer_site_id,profile_id,member_role,active").eq("observer_site_id", input.siteId).eq("profile_id", input.profileId).maybeSingle(),
    admin.from("observer_alert_channel_settings").select("observer_site_id,member_profile_id,channel,enabled,package_allowed,provider_mode,timezone,locale,quiet_hours_start,quiet_hours_end,consent_or_legal_basis,channel_eligible,emergency_override_authorized,revoked_at,rate_limit_per_hour").eq("observer_site_id", input.siteId).eq("member_profile_id", input.profileId).eq("channel", input.channel).maybeSingle()
  ]);
  const site = siteResult.data;
  const profile = profileResult.data;
  const membership = membershipResult.data;
  const setting = settingResult.data;
  if (!site || site.site_type === "kindergarten" || site.garden_id || !profile || profile.active === false) return null;
  const isOwner = site.owner_profile_id === input.profileId;
  const authorization: RecipientAuthorization = {
    profileId: input.profileId,
    observerSiteId: input.siteId,
    activeMembership: isOwner || membership?.active === true,
    memberRole: isOwner ? "owner" : membership?.member_role ?? "none",
    allowedSiteIds: [input.siteId],
    channelEnabled: input.channel === "in_app" ? true : setting?.enabled === true && setting?.package_allowed === true,
    channelEligible: input.channel === "in_app" ? true : setting?.channel_eligible === true,
    consentOrLegalBasis: input.channel === "in_app" ? true : setting?.consent_or_legal_basis === true,
    revoked: Boolean(setting?.revoked_at),
    emergencyOverrideAuthorized: setting?.emergency_override_authorized === true,
    quietHours: hhmm(setting?.quiet_hours_start) && hhmm(setting?.quiet_hours_end)
      ? { start: hhmm(setting?.quiet_hours_start)!, end: hhmm(setting?.quiet_hours_end)!, timezone: setting?.timezone || "Asia/Jerusalem" }
      : null
  };
  return { authorization, locale: setting?.locale || "he-IL", timezone: setting?.timezone || "Asia/Jerusalem", providerModeHint: setting?.provider_mode || "disabled", rateLimitPerHour: setting?.rate_limit_per_hour ?? 20 };
}

async function hourlyRecipientCount(admin: AnySupabase, siteId: string, profileId: string, channel: DeliveryChannel, now: Date) {
  const since = new Date(now.getTime() - 3600_000).toISOString();
  const result = await admin.from("digital_observer_notification_deliveries").select("id", { count: "exact", head: true })
    .eq("observer_site_id", siteId).eq("recipient_profile_id", profileId).eq("channel", channel).gte("created_at", since)
    .not("delivery_status", "in", '(suppressed,cancelled,expired)');
  if (result.error) throw new Error("DELIVERY_RATE_QUERY_FAILED");
  return result.count ?? 0;
}

export async function queueAuthorizedDelivery(admin: AnySupabase, input: {
  actionIntentId: string;
  observerSiteId: string;
  recipientProfileId: string;
  channel: DeliveryChannel;
  severity: Severity;
  priority: number;
  title: string;
  body: string;
  productPath?: string | null;
  ttlSeconds?: number;
  emergencyOverrideRequested?: boolean;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const [intentResult, recipient, providerResult] = await Promise.all([
    admin.from("digital_observer_action_intents").select("id,observer_site_id,intent_status,human_confirmation_required,human_confirmed_at,lawful_use_approval_required,source_provenance,policy_snapshot").eq("id", input.actionIntentId).eq("observer_site_id", input.observerSiteId).maybeSingle(),
    loadRecipientAuthorization(admin, { siteId: input.observerSiteId, profileId: input.recipientProfileId, channel: input.channel }),
    input.channel === "in_app" ? Promise.resolve({ data: null, error: null }) : admin.from("digital_observer_provider_channels").select("provider_key,provider_mode,active,configuration_status,rate_limit_per_minute,rate_limit_per_day,unit_cost_micros,currency").eq("observer_site_id", input.observerSiteId).eq("channel", input.channel).maybeSingle()
  ]);
  const intent = intentResult.data;
  if (!intent || !recipient) throw new Error("DELIVERY_SCOPE_OR_RECIPIENT_DENIED");
  if (intent.human_confirmation_required && !intent.human_confirmed_at) throw new Error("DELIVERY_HUMAN_CONFIRMATION_REQUIRED");
  if (intent.lawful_use_approval_required && typeof intent.policy_snapshot?.lawful_approval_reference !== "string") throw new Error("DELIVERY_LAWFUL_USE_APPROVAL_REQUIRED");
  if (!["authorized", "queued", "executing"].includes(intent.intent_status)) throw new Error("DELIVERY_INTENT_NOT_AUTHORIZED");
  const config = providerResult.data;
  const providerMode = input.channel === "in_app" ? "sandbox" : config?.active === true && config.configuration_status === "ready" ? config.provider_mode : "disabled";
  const count = await hourlyRecipientCount(admin, input.observerSiteId, input.recipientProfileId, input.channel, now);
  if (count >= recipient.rateLimitPerHour) recipient.authorization.channelEnabled = false;
  const plan = createDeliveryPlan({ intentId: input.actionIntentId, observerSiteId: input.observerSiteId, recipient: recipient.authorization,
    channel: input.channel, providerMode, severity: input.severity, priority: input.priority, ttlSeconds: input.ttlSeconds,
    emergencyOverrideRequested: input.emergencyOverrideRequested, now });
  if (count >= recipient.rateLimitPerHour) {
    plan.status = "suppressed";
    plan.suppressionReason = "recipient_rate_limit";
    plan.policySnapshot.rate_limit_per_hour = recipient.rateLimitPerHour;
  }
  const content = minimizeNotificationContent({ title: input.title, body: input.body, productPath: input.productPath, severity: input.severity });
  const insert = await admin.from("digital_observer_notification_deliveries").upsert({
    observer_site_id: input.observerSiteId, action_intent_id: input.actionIntentId,
    recipient_profile_id: input.recipientProfileId, channel: input.channel, severity: input.severity,
    provider_mode: providerMode, delivery_status: plan.status, attempt_count: 0,
    stable_delivery_id: plan.stableDeliveryId, dedupe_key: plan.idempotencyKey, priority: plan.priority,
    expires_at: plan.expiresAt, authorization_snapshot: plan.authorizationSnapshot,
    policy_snapshot: { ...plan.policySnapshot, suppression_reason: plan.suppressionReason },
    content_classification: "minimal", locale: recipient.locale, timezone: recipient.timezone,
    failure_reason: plan.suppressionReason,
    metadata: { content, provider_key: config?.provider_key ?? (input.channel === "in_app" ? "digital-observer-in-app" : "unconfigured"), external_message_sent: false }
  }, { onConflict: "observer_site_id,dedupe_key", ignoreDuplicates: true }).select("id,observer_site_id,recipient_profile_id,channel,provider_mode,delivery_status,attempt_count,max_attempts,expires_at,stable_delivery_id,metadata").maybeSingle();
  if (insert.error) throw new Error(`DELIVERY_PERSIST_FAILED:${insert.error.code ?? "unknown"}`);
  if (insert.data) return { delivery: insert.data, duplicate: false, plan };
  const existing = await admin.from("digital_observer_notification_deliveries").select("id,observer_site_id,action_intent_id,recipient_profile_id,channel,provider_mode,delivery_status,attempt_count,max_attempts,expires_at,stable_delivery_id,dedupe_key,severity,priority,content_classification,authorization_snapshot,policy_snapshot,metadata")
    .eq("observer_site_id", input.observerSiteId).eq("dedupe_key", plan.idempotencyKey).single();
  if (existing.error || !existing.data) throw new Error("DELIVERY_DEDUPE_LOOKUP_FAILED");
  assertEquivalentStoredDelivery(existing.data, { intentId: input.actionIntentId, plan, content });
  // A fresh plan would misrepresent the stored decision-time snapshots.
  return { delivery: existing.data, duplicate: true, plan: null };
}

export async function dispatchQueuedDelivery(admin: AnySupabase, input: { deliveryId: string; sandboxBehavior?: SandboxBehavior; now?: Date }) {
  const now = input.now ?? new Date();
  const claim = await admin.from("digital_observer_notification_deliveries")
    .update({ delivery_status: "dispatching", last_attempt_at: now.toISOString(), updated_at: now.toISOString() })
    .eq("id", input.deliveryId).in("delivery_status", ["queued", "retry_scheduled"])
    .or(`next_retry_at.is.null,next_retry_at.lte.${now.toISOString()}`).gt("expires_at", now.toISOString())
    .select("id,observer_site_id,recipient_profile_id,channel,severity,provider_mode,delivery_status,attempt_count,max_attempts,expires_at,stable_delivery_id,policy_snapshot,metadata").maybeSingle();
  if (claim.error) throw new Error("DELIVERY_CLAIM_FAILED");
  if (!claim.data) return { claimed: false, reason: "not_dispatchable" };
  const delivery = claim.data;
  const attemptNumber = delivery.attempt_count + 1;
  const requestId = `${delivery.stable_delivery_id}:${attemptNumber}`;
  const content = delivery.metadata?.content ?? {};
  const isInApp = delivery.channel === "in_app";
  const channel = isInApp ? null : delivery.channel as Exclude<DeliveryChannel, "in_app">;
  const [recipient, currentProvider] = await Promise.all([
    loadRecipientAuthorization(admin, { siteId: delivery.observer_site_id, profileId: delivery.recipient_profile_id, channel: delivery.channel }),
    isInApp ? Promise.resolve({ data: null, error: null }) : admin.from("digital_observer_provider_channels")
      .select("provider_key,provider_mode,active,configuration_status,rate_limit_per_minute,rate_limit_per_day")
      .eq("observer_site_id", delivery.observer_site_id).eq("channel", delivery.channel).maybeSingle()
  ]);
  const authorization = recipient ? assertRecipientAuthorization(recipient.authorization, delivery.observer_site_id, delivery.channel) : { allowed: false as const, reason: "recipient_missing" };
  const quiet = recipient ? isInQuietHours(now, recipient.authorization.quietHours) : false;
  const emergencyOverride = delivery.severity === "critical" && delivery.policy_snapshot?.emergency_override_authorized === true
    && recipient?.authorization.emergencyOverrideAuthorized === true;
  const providerReady = isInApp || (currentProvider.data?.active === true && currentProvider.data?.configuration_status === "ready"
    && currentProvider.data?.provider_mode === delivery.provider_mode && currentProvider.data?.provider_key === delivery.metadata?.provider_key);
  let dispatchBlock = !authorization.allowed ? `RECIPIENT_${authorization.reason?.toUpperCase()}`
    : quiet && !emergencyOverride ? "RECIPIENT_QUIET_HOURS"
      : !providerReady ? "PROVIDER_CONFIGURATION_CHANGED"
        : null;
  if (!dispatchBlock && currentProvider.data) {
    const minuteAgo = new Date(now.getTime() - 60_000).toISOString();
    const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
    const [minuteUsage, dayUsage] = await Promise.all([
      admin.from("digital_observer_delivery_attempts").select("id", { count: "exact", head: true })
        .eq("observer_site_id", delivery.observer_site_id).eq("provider_key", currentProvider.data.provider_key).gte("created_at", minuteAgo),
      admin.from("digital_observer_delivery_attempts").select("id", { count: "exact", head: true })
        .eq("observer_site_id", delivery.observer_site_id).eq("provider_key", currentProvider.data.provider_key).gte("created_at", dayAgo)
    ]);
    if (minuteUsage.error || dayUsage.error) dispatchBlock = "PROVIDER_RATE_QUERY_FAILED";
    else if ((minuteUsage.count ?? 0) >= currentProvider.data.rate_limit_per_minute || (dayUsage.count ?? 0) >= currentProvider.data.rate_limit_per_day) dispatchBlock = "PROVIDER_RATE_LIMIT";
  }
  const adapter = channel ? providerAdapter({ channel, mode: delivery.provider_mode, providerKey: currentProvider.data?.provider_key, sandboxBehavior: input.sandboxBehavior }) : null;
  const result = dispatchBlock ? { outcome: "blocked" as const, providerMessageId: null, retryAfterSeconds: null,
    safeErrorCode: dispatchBlock, confirmedDelivery: false, usageUnits: 0 }
    : adapter ? await adapter.send({ requestId, stableDeliveryId: delivery.stable_delivery_id, channel: adapter.channel,
    destinationReference: `profile:${delivery.recipient_profile_id}`, title: content.title ?? "Digital Observer",
    body: content.body ?? "A reviewed event requires attention.", productPath: content.productPath ?? null })
    : { outcome: "success" as const, providerMessageId: `in-app:${requestId}`, retryAfterSeconds: null, safeErrorCode: null, confirmedDelivery: true, usageUnits: 1 };
  const transition = transitionForProviderOutcome({ outcome: result.outcome, attemptCount: attemptNumber, maxAttempts: delivery.max_attempts, expiresAt: delivery.expires_at, now, retryAfterSeconds: result.retryAfterSeconds });
  const attempt = await admin.from("digital_observer_delivery_attempts").insert({
    delivery_id: delivery.id, observer_site_id: delivery.observer_site_id, attempt_number: attemptNumber,
    provider_key: adapter?.providerKey ?? "digital-observer-in-app", provider_mode: adapter?.mode ?? "sandbox",
    request_id: requestId, outcome: result.outcome, provider_message_id: result.providerMessageId,
    retryable: transition.status === "retry_scheduled", retry_after: transition.retryAt,
    error_code: result.safeErrorCode, usage_units: result.usageUnits,
    metadata: { confirmed_delivery: result.confirmedDelivery, raw_provider_response_stored: false }
  });
  // A duplicate key does not prove that the stored attempt has the same
  // provider result, recipient/Site or request identity. Never advance the
  // delivery from an unverified attempt record.
  if (attempt.error?.code === "23505") throw new Error("DELIVERY_ATTEMPT_DUPLICATE_UNVERIFIED");
  if (attempt.error) throw new Error("DELIVERY_ATTEMPT_PERSIST_FAILED");
  const update = await admin.from("digital_observer_notification_deliveries").update({
    delivery_status: transition.status, attempt_count: attemptNumber, provider_message_id: result.providerMessageId,
    next_retry_at: transition.retryAt, sent_at: result.outcome === "success" ? now.toISOString() : null,
    terminal_at: transition.terminal ? now.toISOString() : null,
    unknown_outcome_at: result.outcome === "unknown_outcome" ? now.toISOString() : null,
    dead_lettered_at: transition.status === "dead_letter" ? now.toISOString() : null,
    failure_reason: result.safeErrorCode, updated_at: now.toISOString(),
    metadata: { ...delivery.metadata, external_message_sent: result.confirmedDelivery, last_outcome: result.outcome }
  }).eq("id", delivery.id).eq("delivery_status", "dispatching").eq("attempt_count", delivery.attempt_count).select("id,delivery_status,attempt_count,next_retry_at,terminal_at").maybeSingle();
  if (update.error || !update.data) throw new Error("DELIVERY_TERMINAL_UPDATE_FAILED");
  return { claimed: true, delivery: update.data, outcome: result.outcome, confirmedDelivery: result.confirmedDelivery };
}

export async function applyAuthenticatedCallback(admin: AnySupabase, input: { deliveryId: string; providerKey: string; providerEventId: string; outcome: ProviderOutcome; occurredAt?: string | null; safeMetadata?: Record<string, unknown>; now?: Date }) {
  const now = input.now ?? new Date();
  const deliveryResult = await admin.from("digital_observer_notification_deliveries").select("id,observer_site_id,delivery_status,attempt_count,max_attempts,expires_at,metadata").eq("id", input.deliveryId).maybeSingle();
  if (deliveryResult.error || !deliveryResult.data) throw new Error("CALLBACK_DELIVERY_NOT_FOUND");
  const delivery = deliveryResult.data;
  if (delivery.metadata?.provider_key !== input.providerKey) throw new Error("CALLBACK_PROVIDER_MISMATCH");
  const callback = await admin.from("digital_observer_provider_callbacks").insert({ observer_site_id: delivery.observer_site_id,
    delivery_id: delivery.id, provider_key: input.providerKey, provider_event_id: input.providerEventId,
    callback_status: input.outcome, signature_valid: true, replay_detected: false,
    occurred_at: input.occurredAt ?? null, safe_metadata: input.safeMetadata ?? {} }).select("id").maybeSingle();
  if (callback.error?.code === "23505") {
    const original = await admin.from("digital_observer_provider_callbacks")
      .select("id,observer_site_id,delivery_id,provider_key,provider_event_id,callback_status,signature_valid,occurred_at,safe_metadata")
      .eq("provider_key", input.providerKey).eq("provider_event_id", input.providerEventId).maybeSingle();
    if (original.error || !original.data) throw new Error("CALLBACK_REPLAY_LOOKUP_FAILED");
    const stored = original.data;
    if (typeof stored.id !== "string" || stored.signature_valid !== true
      || typeof stored.delivery_id !== "string" || typeof stored.observer_site_id !== "string"
      || typeof stored.callback_status !== "string" || !isJsonObject(stored.safe_metadata)) {
      throw new Error("CALLBACK_REPLAY_RECORD_INVALID");
    }
    if (stored.provider_key !== input.providerKey || stored.provider_event_id !== input.providerEventId
      || stored.delivery_id !== delivery.id || stored.observer_site_id !== delivery.observer_site_id
      || stored.callback_status !== input.outcome
      || !sameCallbackTime(stored.occurred_at, input.occurredAt ?? null)
      || stableJson(stored.safe_metadata) !== stableJson(input.safeMetadata ?? {})) {
      throw new Error("CALLBACK_EVENT_ID_CONFLICT");
    }
    const current = await admin.from("digital_observer_notification_deliveries")
      .select("id,observer_site_id,delivery_status,metadata").eq("id", delivery.id).maybeSingle();
    if (current.error || !current.data || current.data.id !== delivery.id
      || current.data.observer_site_id !== delivery.observer_site_id
      || current.data.metadata?.provider_key !== input.providerKey) throw new Error("CALLBACK_RECOVERY_REQUIRED");
    const provenStatus: Partial<Record<ProviderOutcome, string>> = {
      success: "delivered", acknowledged: "acknowledged", unknown_outcome: "unknown_outcome",
      expired: "expired", cancelled: "cancelled", permanent_failure: "terminal_failure"
    };
    if (current.data.delivery_status !== provenStatus[input.outcome]) throw new Error("CALLBACK_RECOVERY_REQUIRED");
    return { replay: true, deliveryStatus: current.data.delivery_status };
  }
  if (callback.error || !callback.data?.id) throw new Error("CALLBACK_PERSIST_FAILED");
  const terminal = new Set(["acknowledged", "cancelled", "expired", "terminal_failure", "dead_letter", "unknown_outcome"]);
  if (terminal.has(delivery.delivery_status) || (delivery.delivery_status === "delivered" && input.outcome !== "acknowledged")) {
    return { replay: false, ignoredTerminal: true, deliveryStatus: delivery.delivery_status };
  }
  if (delivery.delivery_status !== "sent" && !(delivery.delivery_status === "delivered" && input.outcome === "acknowledged")) {
    throw new Error("CALLBACK_RECOVERY_REQUIRED");
  }
  const transition = transitionForProviderOutcome({ outcome: input.outcome, attemptCount: delivery.attempt_count, maxAttempts: delivery.max_attempts, expiresAt: delivery.expires_at, now });
  if (delivery.delivery_status === "delivered" && transition.status !== "acknowledged") {
    return { replay: false, ignoredTerminal: true, deliveryStatus: "delivered" };
  }
  const status = input.outcome === "success" && transition.status !== "expired" ? "delivered" : transition.status;
  const update = await admin.from("digital_observer_notification_deliveries").update({ delivery_status: status,
    acknowledged_at: input.outcome === "acknowledged" ? now.toISOString() : null,
    terminal_at: transition.terminal ? now.toISOString() : null,
    unknown_outcome_at: input.outcome === "unknown_outcome" ? now.toISOString() : null,
    next_retry_at: transition.retryAt, updated_at: now.toISOString() }).eq("id", delivery.id)
    .eq("observer_site_id", delivery.observer_site_id).eq("delivery_status", delivery.delivery_status)
    .eq("attempt_count", delivery.attempt_count).select("id,delivery_status").maybeSingle();
  if (update.error || !update.data || update.data.delivery_status !== status) throw new Error("CALLBACK_RECOVERY_REQUIRED");
  return { replay: false, deliveryStatus: update.data.delivery_status };
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isJsonObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
}

function sameCallbackTime(stored: unknown, received: string | null) {
  if (stored == null || received == null) return stored == null && received == null;
  return typeof stored === "string" && Number.isFinite(Date.parse(stored))
    && Number.isFinite(Date.parse(received)) && Date.parse(stored) === Date.parse(received);
}
