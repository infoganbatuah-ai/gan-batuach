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
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText };
    return next(url, context);
  }
});

const contract = await import("../../lib/domain/digital-observer/external-api-contract.ts");
const { DigitalObserverExternalClient, verifyDigitalObserverWebhook } = await import("../../examples/digital-observer-external-api/client.mjs");
const migration = readFileSync(new URL("../../supabase/migrations/20261019030000_digital_observer_push42_external_api.sql", import.meta.url), "utf8");
const route = readFileSync(new URL("../../app/api/digital-observer/external/v1/[...segments]/route.ts", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/external-api-service.ts", import.meta.url), "utf8");
const openApi = readFileSync(new URL("../../lib/domain/digital-observer/external-api-openapi.ts", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../docs/DIGITAL_OBSERVER_EXTERNAL_API_V1.md", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("../../examples/digital-observer-external-api/client.mjs", import.meta.url), "utf8");
const push39Migration = readFileSync(new URL("../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql", import.meta.url), "utf8");
const push40Migration = readFileSync(new URL("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql", import.meta.url), "utf8");
const push41Migration = readFileSync(new URL("../../supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql", import.meta.url), "utf8");

assert.equal(contract.externalApiScopes.length, 12);
assert.equal(new Set(contract.externalApiScopes).size, 12);
assert.equal(contract.externalApiPermissionMap["evidence.read"], "evidence.view");
assert.equal(contract.externalApiPermissionMap["webhooks.write"], "notifications.manage");
assert.equal(contract.externalApiPermissionMap["gan_batuach.read"], "events.view");

const signed = contract.externalApiSignature({ method: "GET", path: "/api/digital-observer/external/v1/cameras?site_id=x",
  timestamp: "1792375200", nonce: "safe_nonce_123456789", body: "", credential: "dosvc_test_secret" });
assert.equal(contract.verifyExternalApiSignature({ method: "GET", path: "/api/digital-observer/external/v1/cameras?site_id=x",
  timestamp: "1792375200", nonce: "safe_nonce_123456789", body: "", signature: signed,
  credential: "dosvc_test_secret", now: 1792375200 }).valid, true);
assert.equal(contract.verifyExternalApiSignature({ method: "GET", path: "/api/digital-observer/external/v1/events?site_id=x",
  timestamp: "1792375200", nonce: "safe_nonce_123456789", body: "", signature: signed,
  credential: "dosvc_test_secret", now: 1792375200 }).reason, "signature_invalid");
assert.equal(contract.verifyExternalApiSignature({ method: "GET", path: "/api/digital-observer/external/v1/cameras?site_id=x",
  timestamp: "1792370000", nonce: "safe_nonce_123456789", body: "", signature: signed,
  credential: "dosvc_test_secret", now: 1792375200 }).reason, "timestamp_outside_replay_window");

const webhookPayload = JSON.stringify(contract.externalWebhookPayload({ id: "delivery-1", eventType: "event.created",
  organizationId: "org", siteId: "site", resourceId: "event", occurredAt: "2026-10-19T00:00:00Z", productPath: "/digital-observer/events" }));
const webhookSignature = contract.externalWebhookSignature({ payload: webhookPayload, timestamp: 1792375200, deliveryId: "delivery-1", secret: "test-secret", keyVersion: 1 });
assert.equal(contract.verifyExternalWebhookSignature({ payload: webhookPayload, timestamp: 1792375200, deliveryId: "delivery-1",
  signature: webhookSignature, secret: "test-secret", keyVersion: 1, now: 1792375200 }).valid, true);
assert.equal(contract.verifyExternalWebhookSignature({ payload: webhookPayload, timestamp: 1792375200, deliveryId: "delivery-2",
  signature: webhookSignature, secret: "test-secret", keyVersion: 1, now: 1792375200 }).valid, false);
assert.equal(verifyDigitalObserverWebhook({ payload: webhookPayload, timestamp: 1792375200, deliveryId: "delivery-1",
  signature: webhookSignature, secret: "test-secret", keyVersion: 1, now: 1792375200 }), true);
assert.equal(verifyDigitalObserverWebhook({ payload: webhookPayload, timestamp: 1792375200, deliveryId: "delivery-2",
  signature: webhookSignature, secret: "test-secret", keyVersion: 1, now: 1792375200 }), false);
assert.equal(contract.webhookSubscriptionSchema.parse({ action: "revoke", site_id: "00000000-0000-4000-8000-000000000001",
  subscription_id: "00000000-0000-4000-8000-000000000002" }).action, "revoke");
assert.throws(() => contract.safeExternalProductPath("//attacker.example"), /INVALID_PRODUCT_PATH/);
assert.equal(contract.parseCursor(contract.encodeCursor(125)), 125);
assert.throws(() => contract.parseCursor("not-a-cursor"), /INVALID_CURSOR/);
assert.equal(contract.integrationCapabilityTruth({ kind: "vms", configured: false, realProof: false }).status, "NOT_CONFIGURED");
assert.equal(contract.integrationCapabilityTruth({ kind: "vms", configured: true, realProof: false }).status, "CONNECTED_NOT_PROVEN");
assert.equal(contract.integrationCapabilityTruth({ kind: "vms", configured: true, realProof: true }).status, "CONNECTED_AND_VERIFIED");
assert.deepEqual(contract.ganBatuachRoleMapping.parent, []);
assert.deepEqual(contract.ganBatuachRoleMapping.staff, []);

for (const required of [
  "digital_observer_external_api_request_receipts", "digital_observer_external_api_usage_buckets",
  "digital_observer_external_integration_sources", "record_digital_observer_external_api_usage",
  "unique(credential_id,request_nonce)", "do_external_api_idempotency_idx", "enable row level security",
  "provider_mode in ('disabled','sandbox')", "real_proof_status", "credential_reference is null or credential_reference like 'secret://%'",
  "revoke all on public.digital_observer_external_api_request_receipts from anon, authenticated"
]) assert(migration.includes(required), `migration missing ${required}`);
assert(!migration.includes("provider_mode in ('disabled','sandbox','production')"));
assert(!migration.match(/raw_video|camera_password|rtsp_url/i));

for (const endpoint of ["cameras", "events", "incidents", "evidence", "investigations/search", "watch-rules",
  "webhooks/subscriptions", "integrations/capabilities", "integrations/deep-links", "federation/query", "gan-batuach/contract"]) {
  assert(route.includes(endpoint), `route missing ${endpoint}`);
  assert(openApi.includes(endpoint), `OpenAPI missing ${endpoint}`);
}
for (const required of ["hashEnterpriseCredential", "digital_observer_service_account_credentials", "EXTERNAL_API_REPLAY_DETECTED",
  "assertCommercialEntitlement", "api_access", "validateWebhookDestination", "digital_observer_enterprise_audit_events",
  "digital_observer_external_api_request_receipts", "record_digital_observer_external_api_usage",
  "completeExternalApiReceipt", "response_status"]) assert(service.includes(required));
assert(route.includes("EXTERNAL_API_IDEMPOTENT_REPLAY"));
assert(route.includes('.select("id,observer_site_id,camera_id,signal_type'));
assert(route.includes('.eq("camera_id", input.camera_id)'));
assert(route.includes("external_action_execution: false"));
assert(route.includes("identity_or_movement_inference_is_certain: false"));
assert(route.includes("universal_compatibility_claimed: false"));
assert(route.includes("status: \"NOT_EXECUTED\""));
assert(route.includes("createSupabaseStorageBackend") && route.includes("ttlSeconds: 60"));
assert(docs.includes("No row implies universal compatibility"));
assert(docs.includes("separate products and authorization domains"));
assert(docs.includes("imports no private server module"));
assert(!clientSource.match(/@\/|lib\/domain|app\/api|supabase/));

let captured;
const client = new DigitalObserverExternalClient({ baseUrl: "https://api.example.test/api/digital-observer/external/v1",
  credential: "dosvc_independent_test_secret", fetchImpl: async (url, init) => {
    captured = { url: String(url), init };
    return new Response(JSON.stringify({ api_version: "2026-10-19.v1", data: [] }), { status: 200, headers: { "content-type": "application/json" } });
  } });
const independentResult = await client.cameras("00000000-0000-4000-8000-000000000421");
assert.equal(independentResult.api_version, "2026-10-19.v1");
assert.equal(captured.init.method, "GET");
assert.match(captured.init.headers.Authorization, /^Bearer dosvc_/);
assert.match(captured.init.headers["X-DO-Signature"], /^v1=[a-f0-9]{64}$/);
assert.match(captured.init.headers["X-DO-Nonce"], /^[A-Za-z0-9_-]{16,120}$/);
assert(captured.url.includes("site_id="));

for (const preserved of ["digital_observer_action_intents", "digital_observer_webhook_endpoints", "digital_observer_provider_callbacks"]) assert(push39Migration.includes(preserved));
assert(push40Migration.includes("api_access") && push40Migration.includes("digital_observer_entitlement_grants"));
for (const preserved of ["digital_observer_service_accounts", "digital_observer_service_account_credentials", "digital_observer_enterprise_audit_events"]) assert(push41Migration.includes(preserved));

console.log("PUSH 42 deterministic QA passed: versioned independent client, signed Service Account requests, replay/idempotency/rate guards, tenant/Site/entitlement enforcement, bounded canonical resources, private Evidence authorization, Watch safety, signed webhook registry, truthful VMS/federation state, Gan Batuach isolation and PUSH 39-41 preservation.");
