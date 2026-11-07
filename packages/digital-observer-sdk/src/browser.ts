export class DigitalObserverEmbeddedClient {
  #endpoint: string; #token: string; #audience: string; #fetch: typeof fetch;
  constructor(input: { endpoint: string; token: string; audience: string; fetch?: typeof fetch }) {
    if (!input.token.startsWith("doemb_")) throw new Error("SDK_EMBEDDED_TOKEN_REQUIRED");
    if (!input.audience.trim()) throw new Error("SDK_AUDIENCE_REQUIRED");
    this.#endpoint = input.endpoint; this.#token = input.token; this.#audience = input.audience; this.#fetch = input.fetch ?? fetch;
  }
  async dashboard() {
    const response = await this.#fetch(this.#endpoint, { headers: { authorization: `Bearer ${this.#token}`, "x-do-audience": this.#audience }, credentials: "omit", cache: "no-store" });
    const payload = await response.json(); if (!response.ok) throw new Error(payload?.error?.code ?? `SDK_EMBEDDED_HTTP_${response.status}`); return payload;
  }
}
