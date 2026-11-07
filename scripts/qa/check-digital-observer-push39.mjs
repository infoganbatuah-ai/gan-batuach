import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const orchestration = await import("../../lib/domain/digital-observer/notification-orchestration.ts");
const providers = await import("../../lib/domain/digital-observer/notification-providers.ts");
const webhooks = await import("../../lib/domain/digital-observer/webhook-security.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql", import.meta.url), "utf8");
const intentRoute = readFileSync(new URL("../../app/api/digital-observer/action-intents/route.ts", import.meta.url), "utf8");
const deliveryRoute = readFileSync(new URL("../../app/api/digital-observer/notifications/route.ts", import.meta.url), "utf8");
const callbackRoute = readFileSync(new URL("../../app/api/digital-observer/provider-callbacks/route.ts", import.meta.url), "utf8");
const cameraActionRoute = readFileSync(new URL("../../app/api/digital-observer/camera-actions/route.ts", import.meta.url), "utf8");

const recipient = (overrides = {}) => ({
  profileId: "profile-a", observerSiteId: "site-a", activeMembership: true, memberRole: "operator",
  allowedSiteIds: ["site-a"], channelEnabled: true, channelEligible: true, consentOrLegalBasis: true,
  revoked: false, quietHours: null, emergencyOverrideAuthorized: false, ...overrides
});

const authorized = orchestration.assertRecipientAuthorization(recipient(), "site-a", "email");
assert.equal(authorized.allowed, true);
for (const [name, value, reason] of [
  ["wrong tenant/site", recipient({ allowedSiteIds: ["site-b"] }), "scope_mismatch"],
  ["inactive membership", recipient({ activeMembership: false }), "inactive_membership"],
  ["revoked recipient", recipient({ revoked: true }), "recipient_revoked"],
  ["channel disabled", recipient({ channelEnabled: false }), "channel_not_eligible"],
  ["missing legal basis", recipient({ consentOrLegalBasis: false }), "legal_basis_missing"],
  ["wrong role", recipient({ memberRole: "billing" }), "role_not_eligible"]
]) assert.deepEqual(orchestration.assertRecipientAuthorization(value, "site-a", "email"), { allowed: false, reason }, name);

const quietRecipient = recipient({ quietHours: { start: "22:00", end: "06:00", timezone: "UTC" } });
assert.equal(orchestration.isInQuietHours(new Date("2026-10-18T23:00:00Z"), quietRecipient.quietHours), true);
assert.equal(orchestration.isInQuietHours(new Date("2026-10-18T12:00:00Z"), quietRecipient.quietHours), false);
const quietPlan = orchestration.createDeliveryPlan({ intentId: "intent-a", observerSiteId: "site-a", recipient: quietRecipient,
  channel: "email", providerMode: "sandbox", severity: "high", priority: 8, now: new Date("2026-10-18T23:00:00Z") });
assert.equal(quietPlan.status, "suppressed");
assert.equal(quietPlan.suppressionReason, "quiet_hours");
const emergencyPlan = orchestration.createDeliveryPlan({ intentId: "intent-a", observerSiteId: "site-a",
  recipient: recipient({ ...quietRecipient, emergencyOverrideAuthorized: true }), channel: "email", providerMode: "sandbox",
  severity: "critical", priority: 10, emergencyOverrideRequested: true, now: new Date("2026-10-18T23:00:00Z") });
assert.equal(emergencyPlan.status, "queued");
assert.equal(orchestration.createDeliveryPlan({ intentId: "intent-a", observerSiteId: "site-a", recipient: recipient(),
  channel: "sms", providerMode: "disabled", severity: "high", priority: 8 }).suppressionReason, "provider_disabled");

assert.equal(orchestration.boundedBackoff(1), 15);
assert.equal(orchestration.boundedBackoff(10), 3600);
assert.equal(orchestration.transitionForProviderOutcome({ outcome: "success", attemptCount: 1, maxAttempts: 3, expiresAt: "2026-10-19T00:00:00Z", now: new Date("2026-10-18T00:00:00Z") }).status, "sent");
assert.equal(orchestration.transitionForProviderOutcome({ outcome: "timeout", attemptCount: 1, maxAttempts: 3, expiresAt: "2026-10-19T00:00:00Z", now: new Date("2026-10-18T00:00:00Z") }).status, "retry_scheduled");
assert.equal(orchestration.transitionForProviderOutcome({ outcome: "rate_limit", attemptCount: 3, maxAttempts: 3, expiresAt: "2026-10-19T00:00:00Z", now: new Date("2026-10-18T00:00:00Z") }).status, "dead_letter");
assert.equal(orchestration.transitionForProviderOutcome({ outcome: "permanent_failure", attemptCount: 1, maxAttempts: 3, expiresAt: "2026-10-19T00:00:00Z", now: new Date("2026-10-18T00:00:00Z") }).status, "terminal_failure");
const unknown = orchestration.transitionForProviderOutcome({ outcome: "unknown_outcome", attemptCount: 1, maxAttempts: 3, expiresAt: "2026-10-19T00:00:00Z", now: new Date("2026-10-18T00:00:00Z") });
assert.deepEqual(unknown, { status: "unknown_outcome", retryAt: null, terminal: true });

const safeContent = orchestration.minimizeNotificationContent({ title: "Camera password=abc", body: "rtsp://user:pass@10.0.0.2/x token=secret https://private/x", productPath: "/digital-observer/alerts", severity: "high" });
assert(!JSON.stringify(safeContent).includes("abc") && !JSON.stringify(safeContent).includes("user:pass") && !JSON.stringify(safeContent).includes("secret"));
assert.equal(safeContent.productPath, "/digital-observer/alerts");
assert.equal(orchestration.minimizeNotificationContent({ title: "x", body: "x", productPath: "https://evil.test", severity: "info" }).productPath, null);

for (const [instruction, action] of [["הפעל אזעקה", "siren"], ["turn on the light", "lighting"], ["זום פנימה", "zoom"], ["הזז ימינה", "ptz"], ["שלח התראה", "notify"], ["התקשר למוקד חירום", "phone_escalation"]]) {
  const proposal = orchestration.compileNaturalLanguageAction(instruction);
  assert.equal(proposal.actionType, action);
  assert.equal(proposal.executionAuthorized, false);
}
assert.throws(() => orchestration.compileNaturalLanguageAction("delete everything"), /ACTION_INSTRUCTION_UNSUPPORTED/);
assert.throws(() => orchestration.actionIntentDraft({ siteId: "site-a", sourceId: "shadow", sourceProvenance: "SHADOW_AI", actionType: "notify", severity: "high", proposedAction: {} }), /UNTRUSTED_ACTION_PROVENANCE/);
assert.equal(orchestration.actionIntentDraft({ siteId: "site-a", sourceId: "manual", sourceProvenance: "HUMAN_AUTHORIZED", actionType: "siren", severity: "critical", proposedAction: {} }).human_confirmation_required, true);
assert.equal(orchestration.evaluateCameraActionCapability({ action: "speaker", capabilities: { twoWayAudio: { supported: true } } }).allowed, true);
assert.equal(orchestration.evaluateCameraActionCapability({ action: "preset", capabilities: { ptz: true, presets: ["gate"] }, presetReference: "other" }).reason, "preset_not_supported");
assert.equal(orchestration.evaluateCameraActionCapability({ action: "lighting", capabilities: { lighting: false } }).reason, "unsupported_action");

for (const channel of ["push", "email", "sms", "whatsapp", "webhook", "phone"]) {
  const disabled = providers.providerAdapter({ channel });
  assert.equal(disabled.mode, "disabled");
  assert.equal((await disabled.send({ requestId: "r", stableDeliveryId: "d", channel, destinationReference: "p", title: "t", body: "b", productPath: null })).outcome, "blocked");
  const sandbox = providers.providerAdapter({ channel, mode: "sandbox", sandboxBehavior: "success" });
  const result = await sandbox.send({ requestId: "r", stableDeliveryId: "d", channel, destinationReference: "p", title: "t", body: "b", productPath: null });
  assert.equal(result.confirmedDelivery, true);
  assert.match(result.providerMessageId, /^sandbox:/);
}
const unknownSandbox = await new providers.DeterministicSandboxAdapter("sms", "unknown_outcome").send({ requestId: "r", stableDeliveryId: "d", channel: "sms", destinationReference: "p", title: "t", body: "b", productPath: null });
assert.equal(unknownSandbox.confirmedDelivery, false);

for (const candidate of ["http://example.com/hook", "https://localhost/hook", "https://127.0.0.1/hook", "https://169.254.169.254/hook", "https://10.0.0.2/hook", "https://[::1]/hook", "https://evil.example/hook"])
  assert.equal(webhooks.validateWebhookDestination(candidate, ["hooks.example.com"]).allowed, false, candidate);
assert.equal(webhooks.validateWebhookDestination("https://hooks.example.com/do", ["hooks.example.com"]).allowed, true);
const body = JSON.stringify(webhooks.versionedWebhookPayload({ deliveryId: "delivery-a", eventType: "delivery.status", occurredAt: "2026-10-18T00:00:00Z", siteReference: "site-ref", status: "delivered" }));
const signature = webhooks.webhookSignature({ body, timestamp: 1000, deliveryId: "delivery-a", secret: "sandbox-secret", keyVersion: 2 });
assert.equal(webhooks.verifyWebhookSignature({ body, timestamp: 1000, deliveryId: "delivery-a", signature, secret: "sandbox-secret", keyVersion: 2, now: 1000 }).valid, true);
assert.equal(webhooks.verifyWebhookSignature({ body, timestamp: 1000, deliveryId: "delivery-a", signature, secret: "sandbox-secret", keyVersion: 2, now: 2000 }).reason, "timestamp_outside_replay_window");
assert.equal(webhooks.verifyWebhookSignature({ body: body + "x", timestamp: 1000, deliveryId: "delivery-a", signature, secret: "sandbox-secret", keyVersion: 2, now: 1000 }).valid, false);

assert.deepEqual(orchestration.nextEscalationStep({ currentStep: 0, maxSteps: 3, status: "pending", acknowledged: false, now: new Date() }), { status: "active", nextStep: 1, activate: true });
assert.equal(orchestration.nextEscalationStep({ currentStep: 1, maxSteps: 3, status: "active", acknowledged: true, now: new Date() }).status, "acknowledged");
assert.equal(orchestration.nextEscalationStep({ currentStep: 3, maxSteps: 3, status: "escalated", acknowledged: false, now: new Date() }).status, "failed");

for (const required of [
  "digital_observer_action_intents", "digital_observer_provider_channels", "digital_observer_delivery_attempts",
  "digital_observer_escalations", "digital_observer_escalation_steps", "digital_observer_webhook_endpoints",
  "digital_observer_provider_callbacks", "digital_observer_action_audit", "enable row level security",
  "unknown_outcome", "dead_letter", "credential_reference", "block_digital_observer_push39_history_mutation",
  "revoke insert, update, delete on public.digital_observer_notification_deliveries from authenticated",
  "revoke execute on function public.enqueue_digital_guard_camera_command_v1(uuid,text,jsonb,text) from service_role"
]) assert(migration.includes(required), `migration missing ${required}`);
assert(intentRoute.includes('provenance !== "REAL_CAMERA_AI"'), "mock/shadow Watch Rule output cannot trigger action intent");
assert(intentRoute.includes('rule.data.validation_status !== "VALID"') && intentRoute.includes('rule.data.rule_state !== "ACTIVE"'), "Watch Rule must be confirmed and active");
assert(deliveryRoute.includes("getObserverSiteAccess") && deliveryRoute.includes("queueAuthorizedDelivery"), "delivery API must re-check Site and recipient policy");
assert(callbackRoute.includes("verifyWebhookSignature") && callbackRoute.includes("applyAuthenticatedCallback"), "callbacks must be signed and idempotent");
assert(cameraActionRoute.includes("reconciliation_required") && cameraActionRoute.includes("non_retryable"), "physical unknown outcomes remain locked and non-retryable");

console.log("PUSH 39 deterministic QA passed: provider modes/channels, authorization, privacy minimization, quiet hours, retry/idempotency states, unknown outcomes, human gates, natural-language proposals, webhook SSRF/signature/replay, escalation bounds, RLS/audit schema and camera-action fail-safe.");
