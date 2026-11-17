import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const API_VERSION = "2026-10-19.v1";
const WEBHOOK_VERSION = "do-external-webhook-v1";

export function verifyDigitalObserverWebhook({ payload, timestamp, deliveryId, signature, secret, keyVersion, now = Math.floor(Date.now() / 1000) }) {
  if (Math.abs(now - Number(timestamp)) > 300 || !/^v1=[a-f0-9]{64}$/i.test(signature ?? "")) return false;
  const canonical = `${WEBHOOK_VERSION}.${keyVersion}.${timestamp}.${deliveryId}.${payload}`;
  const expected = `v1=${createHmac("sha256", secret).update(canonical).digest("hex")}`;
  return expected.length === signature.length && timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export class DigitalObserverExternalClient {
  constructor({ baseUrl, credential, fetchImpl = fetch }) {
    if (!baseUrl || !credential?.startsWith("dosvc_")) throw new Error("A base URL and one-time dosvc_ credential are required.");
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.credential = credential;
    this.fetch = fetchImpl;
  }

  async request(path, { method = "GET", body, idempotencyKey, timestamp: suppliedTimestamp, nonce: suppliedNonce } = {}) {
    const payload = body === undefined ? "" : JSON.stringify(body);
    const timestamp = suppliedTimestamp ?? String(Math.floor(Date.now() / 1000));
    const nonce = suppliedNonce ?? randomBytes(18).toString("base64url");
    const url = new URL(path, `${this.baseUrl}/`);
    const bodyDigest = createHash("sha256").update(payload).digest("hex");
    const canonical = [API_VERSION, method.toUpperCase(), `${url.pathname}${url.search}`, timestamp, nonce, bodyDigest].join("\n");
    const signature = `v1=${createHmac("sha256", this.credential).update(canonical).digest("hex")}`;
    const result = await this.fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.credential}`,
        "Content-Type": "application/json",
        "X-DO-Timestamp": timestamp,
        "X-DO-Nonce": nonce,
        "X-DO-Signature": signature,
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {})
      },
      body: method === "GET" ? undefined : payload,
      redirect: "manual"
    });
    if (result.status === 307) return { redirect: result.headers.get("location"), status: 307 };
    const data = await result.json();
    if (!result.ok) throw Object.assign(new Error(data?.error?.code ?? `HTTP_${result.status}`), { status: result.status, response: data });
    return data;
  }

  cameras(siteId) { return this.request(`cameras?site_id=${encodeURIComponent(siteId)}`); }
  events(siteId, cursor) { return this.request(`events?site_id=${encodeURIComponent(siteId)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`); }
  incidents(siteId) { return this.request(`incidents?site_id=${encodeURIComponent(siteId)}`); }
  investigate(siteId, question) { return this.request("investigations/search", { method: "POST", body: { site_id: siteId, question }, idempotencyKey: `investigation-${randomBytes(12).toString("hex")}` }); }
  integrationCapabilities(siteId) { return this.request(`integrations/capabilities?site_id=${encodeURIComponent(siteId)}`); }
}

// Example:
// const client = new DigitalObserverExternalClient({
//   baseUrl: "http://127.0.0.1:3000/api/digital-observer/external/v1",
//   credential: process.env.DIGITAL_OBSERVER_EXTERNAL_API_CREDENTIAL
// });
// console.log(await client.cameras(process.env.DIGITAL_OBSERVER_EXTERNAL_API_SITE_ID));
