import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "server-only") return { url: "test:server-only", shortCircuit: true };
    if (specifier === "next/server") return { url: "test:next-server", shortCircuit: true };
    if (specifier === "@/lib/supabase/admin") return { url: "test:admin", shortCircuit: true };
    if (specifier === "@/lib/domain/digital-observer/partner-platform-service"
      || (specifier === "./partner-platform-service" && context.parentURL?.endsWith("external-api-service.ts"))) {
      return { url: "test:partner-service", shortCircuit: true };
    }
    if (specifier.startsWith("@/")) return next(new URL(`${specifier.slice(2)}.ts`, root).href, context);
    if (specifier.startsWith(".") && context.parentURL?.endsWith(".ts")) return next(`${specifier}.ts`, context);
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url === "test:server-only") return { format: "module", shortCircuit: true, source: "export {};" };
    if (url === "test:next-server") return { format: "module", shortCircuit: true,
      source: "export const NextResponse = { json: (body, init) => Response.json(body, init) };" };
    if (url === "test:admin") return { format: "module", shortCircuit: true,
      source: "export const createAdminClient = () => globalThis.__push43Admin; export const isAdminClientConfigured = () => true;" };
    if (url === "test:partner-service") return { format: "module", shortCircuit: true, source: `
      export const partnerCorrelationId = () => "synthetic-correlation";
      export const authorizePartnerDelegatedSite = async () => null;
      export const partnerState = async () => ({ partner: { id: "partner-a" }, brand: null, customers: [], externalProof: false });
      export const provisionPartnerCustomer = async () => { globalThis.__push43Calls.provision++; return { customer: { id: "customer-a" } }; };
      export const issuePartnerEmbeddedSession = async () => { globalThis.__push43Calls.issue++; return { session: { id: "session-a" }, oneTimeSecret: true }; };
    ` };
    if (url.endsWith(".ts")) return { format: "module", shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }
      }).outputText };
    return next(url, context);
  }
});

process.env.DIGITAL_OBSERVER_ENTERPRISE_CREDENTIAL_PEPPER = "synthetic-only-test-pepper-value";
const { externalApiSignature } = await import("../../lib/domain/digital-observer/external-api-contract.ts");
const route = await import("../../app/api/digital-observer/partner/v1/[...segments]/route.ts");
const credential = "dosvc_synthetic_partner_credential";
const uuid = (suffix) => `00000000-0000-4000-8000-${String(suffix).padStart(12, "0")}`;
const customerBody = JSON.stringify({ customer_organization_id: uuid(1), external_customer_reference: "synthetic-customer",
  site_ids: [uuid(2)], entitlement_grant_ids: [uuid(3)], idempotency_key: "customer-body-key" });
const embeddedBody = JSON.stringify({ partner_customer_id: uuid(4), site_id: uuid(2), audience: "partner-qa",
  allowed_origin: "https://partner.example.test", scopes: ["events.read"], ttl_minutes: 15 });

function database() {
  const state = { receipts: new Map(), receiptUpdates: 0, credentialUpdates: 0, accountUpdates: 0 };
  const admin = { from(table) {
    const filters = new Map();
    let operation = "read";
    let payload;
    const query = {
      select() { return this; }, eq(key, value) { filters.set(key, value); return this; },
      is() { return this; }, limit() { return this; },
      insert(value) { operation = "insert"; payload = value; return this; },
      update(value) { operation = "update"; payload = value; return this; },
      then(resolve, reject) { return Promise.resolve(this.result()).then(resolve, reject); },
      async single() { return this.result(); }, async maybeSingle() { return this.result(); },
      result() {
        if (table === "digital_observer_service_account_credentials") {
          if (operation === "update") { state.credentialUpdates++; return { error: null }; }
          return { data: { id: "credential-a", service_account_id: "service-a", expires_at: "2099-01-01T00:00:00Z" }, error: null };
        }
        if (table === "digital_observer_service_accounts") {
          if (operation === "update") { state.accountUpdates++; return { error: null }; }
          return { data: { id: "service-a", organization_id: "org-a", account_status: "active",
            permissions: [], all_sites: true, expires_at: "2099-01-01T00:00:00Z", revoked_at: null }, error: null };
        }
        if (table === "digital_observer_external_api_request_receipts") {
          const key = `${payload?.service_account_id ?? filters.get("service_account_id")}:${payload?.method ?? filters.get("method")}`
            + `:${payload?.request_path ?? filters.get("request_path")}:${payload?.idempotency_key ?? filters.get("idempotency_key") ?? ""}`;
          if (operation === "insert") {
            if (state.receipts.has(key)) return { data: null, error: { code: "23505" } };
            const receipt = { id: `receipt-${state.receipts.size + 1}`, ...payload };
            state.receipts.set(key, receipt);
            return { data: { id: receipt.id }, error: null };
          }
          if (operation === "update") {
            const receipt = [...state.receipts.values()].find((item) => item.id === filters.get("id"));
            assert(receipt, "only a newly accepted receipt may be finalized");
            Object.assign(receipt, payload);
            state.receiptUpdates++;
            return { error: null };
          }
          const receipt = state.receipts.get(key);
          return { data: receipt ? { id: receipt.id, request_nonce: receipt.request_nonce,
            request_hash: receipt.request_hash } : null, error: null };
        }
        if (table === "digital_observer_partner_service_accounts") {
          return { data: { partner_id: "partner-a", access_kind: "partner_control",
            digital_observer_partners: { id: "partner-a", organization_id: "org-a", partner_status: "sandbox" } }, error: null };
        }
        throw new Error(`UNEXPECTED_TABLE:${table}`);
      }
    };
    return query;
  } };
  return { admin, state };
}

function signedRequest(method, segment, body, key, nonce) {
  const path = `/api/digital-observer/partner/v1/${segment}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const headers = { authorization: `Bearer ${credential}`, "x-do-timestamp": timestamp, "x-do-nonce": nonce,
    "x-do-signature": externalApiSignature({ method, path, timestamp, nonce, body, credential }) };
  if (key) headers["idempotency-key"] = key;
  return new Request(`https://partner.example.test${path}`, { method, headers, ...(method === "GET" ? {} : { body }) });
}

async function call(method, segment, body, key, nonce) {
  const response = await route[method](signedRequest(method, segment, body, key, nonce),
    { params: Promise.resolve({ segments: [segment] }) });
  return { status: response.status, body: await response.json() };
}

test("first signed customer POST works, but identical new-nonce replay never reprovisions", async () => {
  const fixture = database(); globalThis.__push43Admin = fixture.admin;
  globalThis.__push43Calls = { provision: 0, issue: 0 };
  const first = await call("POST", "customers", customerBody, "receipt-key-customers", "nonce_first_customer_001");
  assert.equal(first.status, 201);
  assert.equal(globalThis.__push43Calls.provision, 1);
  const replay = await call("POST", "customers", customerBody, "receipt-key-customers", "nonce_second_customer_002");
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error.code, "EXTERNAL_API_IDEMPOTENT_REPLAY");
  assert.equal(globalThis.__push43Calls.provision, 1);
  assert.equal(globalThis.__push43Calls.issue, 0);
  assert.equal(fixture.state.receiptUpdates, 1);
  assert.equal([...fixture.state.receipts.values()][0].response_status, 201);
});

test("same receipt key with a changed body fails before customer side effects", async () => {
  const fixture = database(); globalThis.__push43Admin = fixture.admin;
  globalThis.__push43Calls = { provision: 0, issue: 0 };
  assert.equal((await call("POST", "customers", customerBody, "receipt-key-conflict", "nonce_first_conflict_001")).status, 201);
  const changed = JSON.stringify({ ...JSON.parse(customerBody), external_customer_reference: "other-customer" });
  const collision = await call("POST", "customers", changed, "receipt-key-conflict", "nonce_second_conflict_002");
  assert.equal(collision.status, 409);
  assert.equal(collision.body.error.code, "EXTERNAL_API_IDEMPOTENCY_CONFLICT");
  assert.equal(globalThis.__push43Calls.provision, 1);
  assert.equal(fixture.state.receiptUpdates, 1);
});

test("embedded session replay is denied before issuing another session", async () => {
  const fixture = database(); globalThis.__push43Admin = fixture.admin;
  globalThis.__push43Calls = { provision: 0, issue: 0 };
  assert.equal((await call("POST", "embedded-sessions", embeddedBody, "receipt-key-embedded", "nonce_first_embedded_001")).status, 201);
  assert.equal(globalThis.__push43Calls.issue, 1);
  const replay = await call("POST", "embedded-sessions", embeddedBody, "receipt-key-embedded", "nonce_second_embedded_002");
  assert.equal(replay.status, 409);
  assert.equal(replay.body.error.code, "EXTERNAL_API_IDEMPOTENT_REPLAY");
  assert.equal(globalThis.__push43Calls.issue, 1);
  assert.equal(fixture.state.receiptUpdates, 1);
});

test("signed GET remains available and requires no POST idempotency key", async () => {
  const fixture = database(); globalThis.__push43Admin = fixture.admin;
  globalThis.__push43Calls = { provision: 0, issue: 0 };
  const result = await call("GET", "profile", "", null, "nonce_get_profile_0001");
  assert.equal(result.status, 200);
  assert.equal(result.body.partner.id, "partner-a");
  assert.deepEqual(globalThis.__push43Calls, { provision: 0, issue: 0 });
});

test("the only other external-auth route already gates replay before handlers", () => {
  const external = readFileSync(new URL("../../app/api/digital-observer/external/v1/[...segments]/route.ts", import.meta.url), "utf8");
  const partner = readFileSync(new URL("../../app/api/digital-observer/partner/v1/[...segments]/route.ts", import.meta.url), "utf8");
  assert.match(external, /if \(actor\.idempotentReplay\) throw new Error\("EXTERNAL_API_IDEMPOTENT_REPLAY"\)/);
  assert(partner.indexOf("if (actor.idempotentReplay)") < partner.indexOf("await partnerActor"));
});
