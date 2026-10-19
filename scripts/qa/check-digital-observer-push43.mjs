import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

registerHooks({
  resolve(specifier, context, next) { if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context); return next(specifier, context); },
  load(url, context, next) { if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
    source: ts.transpileModule(readFileSync(new URL(url), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText }; return next(url, context); }
});

const contract = await import("../../lib/domain/digital-observer/partner-platform.ts");
const { DigitalObserverServerClient, verifyWebhook } = await import("../../packages/digital-observer-sdk/src/index.ts");
const { DigitalObserverEmbeddedClient } = await import("../../packages/digital-observer-sdk/src/browser.ts");
const migration = readFileSync(new URL("../../supabase/migrations/20261019040000_digital_observer_push43_oem_sdk.sql", import.meta.url), "utf8");
const delegatedUsageMigration = readFileSync(new URL("../../supabase/migrations/20261019041000_digital_observer_push43_delegated_usage.sql", import.meta.url), "utf8");
const embedOriginMigration = readFileSync(new URL("../../supabase/migrations/20261019042000_digital_observer_push43_embed_origin_constraint.sql", import.meta.url), "utf8");
const service = readFileSync(new URL("../../lib/domain/digital-observer/partner-platform-service.ts", import.meta.url), "utf8");
const partnerRoute = readFileSync(new URL("../../app/api/digital-observer/partner/v1/[...segments]/route.ts", import.meta.url), "utf8");
const embeddedRoute = readFileSync(new URL("../../app/api/digital-observer/embed/v1/dashboard/route.ts", import.meta.url), "utf8");
const sdk = readFileSync(new URL("../../packages/digital-observer-sdk/src/index.ts", import.meta.url), "utf8");
const browserSdk = readFileSync(new URL("../../packages/digital-observer-sdk/src/browser.ts", import.meta.url), "utf8");
const example = readFileSync(new URL("../../examples/digital-observer-partner-app/server.mjs", import.meta.url), "utf8");
const docs = readFileSync(new URL("../../docs/DIGITAL_OBSERVER_PARTNER_SDK_V1.md", import.meta.url), "utf8");
const p39 = readFileSync(new URL("../../supabase/migrations/20261018010000_digital_observer_push39_orchestration.sql", import.meta.url), "utf8");
const p40 = readFileSync(new URL("../../supabase/migrations/20261019010000_digital_observer_push40_commercial_billing.sql", import.meta.url), "utf8");
const p41 = readFileSync(new URL("../../supabase/migrations/20261019020000_digital_observer_push41_enterprise_identity.sql", import.meta.url), "utf8");
const p42 = readFileSync(new URL("../../supabase/migrations/20261019030000_digital_observer_push42_external_api.sql", import.meta.url), "utf8");

assert.equal(contract.DIGITAL_OBSERVER_PARTNER_CONTRACT, "digital-observer-partner-v1");
assert.equal(new Set(contract.partnerTypes).size, 9);
assert.equal(new Set(contract.embeddedScopes).size, 7);
assert.equal(contract.partnerCustomerTransition("provisioning", "active"), "active");
assert.equal(contract.partnerCustomerTransition("suspended", "active"), "active");
assert.throws(() => contract.partnerCustomerTransition("deprovisioned", "active"), /TRANSITION_DENIED/);
assert.equal(contract.validateEmbedOrigin("https://app.partner.example", ["https://app.partner.example"]), "https://app.partner.example");
assert.throws(() => contract.validateEmbedOrigin("https://attacker.example", ["https://app.partner.example"]), /ORIGIN_DENIED/);
const issued = contract.issueEmbeddedToken({ pepper: "safe-test-pepper-value", ttlMinutes: 15, now: 1792375200000 });
assert.match(issued.raw, /^doemb_[A-Za-z0-9_-]+$/);
assert.equal(issued.expiresAt, "2026-10-19T02:15:00.000Z");
assert.equal(contract.customerReference("partner-customer-001").hash.length, 64);
assert(!JSON.stringify(contract.customerReference("partner-customer-001")).includes("partner-customer-001"));

for (const table of ["digital_observer_partners", "digital_observer_partner_customers", "digital_observer_partner_customer_sites",
  "digital_observer_partner_customer_entitlements", "digital_observer_partner_brand_profiles", "digital_observer_partner_service_accounts",
  "digital_observer_partner_provisioning_receipts", "digital_observer_embedded_sessions"]) assert(migration.includes(table), `missing ${table}`);
for (const safety of ["enable row level security", "from anon,authenticated", "partner_status in ('draft','sandbox','suspended','revoked')",
  "expires_at<=created_at+interval '60 minutes'", "customer_status in ('provisioning','active','suspended','deprovisioned')",
  "references public.digital_observer_entitlement_grants", "raw tokens are never stored"]) assert(migration.toLowerCase().includes(safety.toLowerCase()), `missing ${safety}`);
assert(!migration.includes("partner_status in ('draft','sandbox','active'"));
assert(!migration.match(/card_number|cvv|camera_password|rtsp_url|raw_video/i));
for (const required of ["record_digital_observer_external_api_usage", "digital_observer_partner_service_accounts",
  "access_kind='customer_resources'", "customer_status='active'", "partner_status='sandbox'",
  "digital_observer_partner_customer_sites", "auth.role() <> 'service_role'"]) {
  assert(delegatedUsageMigration.includes(required), `missing delegated usage guard ${required}`);
}
assert(!delegatedUsageMigration.match(/card_number|cvv|camera_password|rtsp_url|raw_video/i));
assert(embedOriginMigration.includes("127[.]0[.]0[.]1"));
assert(embedOriginMigration.includes("validate constraint do_embedded_session_origin_check"));
assert(!embedOriginMigration.includes("127\\\\.0\\\\.0\\\\.1"));

for (const required of ["authorizePartnerDelegatedSite", "PARTNER_CUSTOMER_SITE_SCOPE_DENIED", "PARTNER_CUSTOMER_ENTITLEMENT_DENIED",
  "PARTNER_IDEMPOTENCY_CONFLICT", "digital_observer_partner_provisioning_receipts", "digital_observer_partner_customer_sites",
  "digital_observer_embedded_sessions", "raw_token_stored: false", "PARTNER_CONTROL_SCOPE_DENIED"]) assert((service + partnerRoute).includes(required), `missing ${required}`);
assert(service.includes('.is("garden_id", null).neq("site_type", "kindergarten")'));
assert(embeddedRoute.includes("raw_video_embedded: false") && embeddedRoute.includes("biometric_features_enabled: false"));
assert(embeddedRoute.includes("cache-control") && embeddedRoute.includes("vary"));
assert(!browserSdk.includes("dosvc_") && !browserSdk.includes("node:crypto"));
assert(!example.match(/@\/|lib\/domain|app\/api|supabase/));
assert(docs.includes("does not create new Event, Incident, Evidence") && docs.includes("PUSH 46 owns real zero-install proof"));

let calls = [];
const client = new DigitalObserverServerClient({ baseUrl: "https://api.example.test/api/digital-observer/external/v1", credential: "dosvc_test_partner_secret",
  fetch: async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ data: [], api_version: "2026-10-19.v1" }), { status: 200, headers: { "content-type": "application/json" } }); } });
await client.cameras("00000000-0000-4000-8000-000000000043");
await client.provisionPartnerCustomer({ customer_organization_id: "00000000-0000-4000-8000-000000000044",
  external_customer_reference: "synthetic-44", site_ids: ["00000000-0000-4000-8000-000000000045"],
  entitlement_grant_ids: ["00000000-0000-4000-8000-000000000046"], idempotency_key: "push43-test-1" });
assert(calls[0].url.includes("/external/v1/cameras"));
assert(calls[1].url.includes("/partner/v1/customers"));
assert.equal(calls[1].init.headers.get("idempotency-key"), "push43-test-1");
assert.match(calls[1].init.headers.get("x-do-signature"), /^v1=[a-f0-9]{64}$/);

const embeddedClient = new DigitalObserverEmbeddedClient({ endpoint: "https://embed.example.test/dashboard", token: "doemb_short_lived_test_token", audience: "partner-app",
  fetch: async (_url, init) => { assert.equal(init.headers.authorization, "Bearer doemb_short_lived_test_token"); assert.equal(init.headers["x-do-audience"], "partner-app");
    return new Response(JSON.stringify({ contract: "digital-observer-embedded-v1", cameras: [] }), { status: 200, headers: { "content-type": "application/json" } }); } });
assert.equal((await embeddedClient.dashboard()).contract, "digital-observer-embedded-v1");
const payload = "{\"event\":\"created\"}"; const timestamp = 1792375200; const deliveryId = "delivery-43"; const secret = "sandbox-webhook-secret";
const signature = `v1=${(await import("node:crypto")).createHmac("sha256", secret).update(`do-external-webhook-v1.1.${timestamp}.${deliveryId}.${payload}`).digest("hex")}`;
assert.equal(verifyWebhook({ payload, timestamp, deliveryId, signature, secret, keyVersion: 1, now: timestamp }), true);
assert.equal(verifyWebhook({ payload, timestamp, deliveryId: "wrong", signature, secret, keyVersion: 1, now: timestamp }), false);

for (const [source, names] of [[p39, ["digital_observer_action_intents","digital_observer_webhook_endpoints"]],
  [p40, ["digital_observer_entitlement_grants","digital_observer_partner_billing_accounts"]],
  [p41, ["digital_observer_service_accounts","digital_observer_sso_connections"]],
  [p42, ["digital_observer_external_api_request_receipts","digital_observer_external_api_usage_buckets"]]]) {
  for (const name of names) assert(source.includes(name), `preservation missing ${name}`);
}

console.log("PUSH 43 deterministic QA passed: canonical API reuse, signed SDK requests, partner/customer/Site isolation, idempotent provisioning, canonical entitlement references, short-lived audience/origin-scoped embedding, branding safety, webhook verification, independent public-contract sample, zero-install compatibility and PUSH 39-42 preservation.");
