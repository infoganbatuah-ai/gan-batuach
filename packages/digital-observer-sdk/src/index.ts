import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type DigitalObserverServerClientOptions = { baseUrl: string; partnerBaseUrl?: string; credential: string; fetch?: typeof fetch };
export class DigitalObserverServerClient {
  #baseUrl: string; #partnerBaseUrl: string; #credential: string; #fetch: typeof fetch;
  constructor(options: DigitalObserverServerClientOptions) {
    if (!options.credential.startsWith("dosvc_")) throw new Error("SDK_SERVICE_CREDENTIAL_REQUIRED");
    this.#baseUrl = options.baseUrl.replace(/\/$/, "");
    this.#partnerBaseUrl = (options.partnerBaseUrl ?? this.#baseUrl.replace(/\/external\/v1$/, "/partner/v1")).replace(/\/$/, "");
    this.#credential = options.credential; this.#fetch = options.fetch ?? fetch;
  }
  async request(path: string, init: RequestInit = {}, idempotencyKey?: string, baseUrl = this.#baseUrl) {
    const method = String(init.method ?? "GET").toUpperCase(); const body = typeof init.body === "string" ? init.body : "";
    const timestamp = String(Math.floor(Date.now() / 1000)); const nonce = randomBytes(18).toString("base64url");
    const target = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`; const url = new URL(target);
    const canonical = ["2026-10-19.v1", method, `${url.pathname}${url.search}`, timestamp, nonce, createHash("sha256").update(body).digest("hex")].join("\n");
    const headers = new Headers(init.headers); headers.set("authorization", `Bearer ${this.#credential}`); headers.set("x-do-timestamp", timestamp);
    headers.set("x-do-nonce", nonce); headers.set("x-do-signature", `v1=${createHmac("sha256", this.#credential).update(canonical).digest("hex")}`);
    if (method !== "GET") { headers.set("content-type", "application/json"); headers.set("idempotency-key", idempotencyKey ?? randomBytes(18).toString("base64url")); }
    const response = await this.#fetch(url, { ...init, method, headers }); const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload?.error?.code ?? `SDK_HTTP_${response.status}`), { status: response.status, payload });
    return payload;
  }
  cameras(siteId: string, cursor?: string) { return this.request(`/cameras?site_id=${encodeURIComponent(siteId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`); }
  cameraHealth(siteId: string) { return this.cameras(siteId); }
  events(siteId: string, cursor?: string) { return this.request(`/events?site_id=${encodeURIComponent(siteId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`); }
  incidents(siteId: string, cursor?: string) { return this.request(`/incidents?site_id=${encodeURIComponent(siteId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`); }
  evidence(siteId: string, evidenceId: string) { return this.request(`/evidence/${encodeURIComponent(evidenceId)}?site_id=${encodeURIComponent(siteId)}`); }
  investigation(siteId: string, question: string) { return this.request("/investigations/search", { method: "POST", body: JSON.stringify({ site_id: siteId, question, cursor: 0, limit: 25 }) }); }
  watchRules(siteId: string) { return this.request(`/watch-rules?site_id=${encodeURIComponent(siteId)}`); }
  integrationCapabilities(siteId: string) { return this.request(`/integrations/capabilities?site_id=${encodeURIComponent(siteId)}`); }
  webhookSubscriptions(siteId: string) { return this.request(`/webhooks/subscriptions?site_id=${encodeURIComponent(siteId)}`); }
  partnerProfile() { return this.request("/profile", {}, undefined, this.#partnerBaseUrl); }
  partnerCustomers() { return this.request("/customers", {}, undefined, this.#partnerBaseUrl); }
  provisionPartnerCustomer(input: { customer_organization_id: string; external_customer_reference: string; site_ids: string[]; entitlement_grant_ids: string[]; idempotency_key: string }) {
    return this.request("/customers", { method: "POST", body: JSON.stringify(input) }, input.idempotency_key, this.#partnerBaseUrl);
  }
  issueEmbeddedSession(input: { partner_customer_id: string; site_id: string; audience: string; allowed_origin: string; scopes: string[]; ttl_minutes?: number }, idempotencyKey: string) {
    return this.request("/embedded-sessions", { method: "POST", body: JSON.stringify(input) }, idempotencyKey, this.#partnerBaseUrl);
  }
}

export function verifyWebhook(input: { payload: string; timestamp: number; deliveryId: string; signature: string; secret: string; keyVersion: number; now?: number }) {
  if (Math.abs((input.now ?? Math.floor(Date.now() / 1000)) - input.timestamp) > 300 || !/^v1=[a-f0-9]{64}$/i.test(input.signature)) return false;
  const canonical = `do-external-webhook-v1.${input.keyVersion}.${input.timestamp}.${input.deliveryId}.${input.payload}`;
  const expected = `v1=${createHmac("sha256", input.secret).update(canonical).digest("hex")}`;
  return expected.length === input.signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(input.signature));
}
