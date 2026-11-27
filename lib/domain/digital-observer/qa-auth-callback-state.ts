import { createHash, randomBytes } from "node:crypto";

export const OBSERVER_QA_CALLBACK_ORIGIN = "https://observer-qa.ganbatuach.com";
const callbackPath = "/auth/callback";
const maxLifetimeMs = 5 * 60_000;

export type QaCallbackFlow = "verify" | "recovery";
export type QaCallbackRecord = {
  product: "digital_observer";
  flow: QaCallbackFlow;
  browserBindingHash: string;
  expiresAt: number;
};

// An active implementation must provide durable, cross-process atomic insert
// and compare-and-consume. There is deliberately no in-memory production store.
export type QaCallbackStore = {
  putIfAbsent: (stateHash: string, record: QaCallbackRecord) => Promise<boolean>;
  consume: (stateHash: string, expected: Omit<QaCallbackRecord, "expiresAt">, now: number) => Promise<boolean>;
};

function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function validBinding(value: string) { return /^[A-Za-z0-9_-]{32,256}$/.test(value); }
function validFlow(value: unknown): value is QaCallbackFlow { return value === "verify" || value === "recovery"; }

export async function issueObserverQaCallbackState(input: {
  store?: QaCallbackStore;
  flow: QaCallbackFlow;
  browserBinding: string;
  now: number;
}): Promise<{ state: string; expiresAt: number }> {
  if (!input.store || !validFlow(input.flow) || !validBinding(input.browserBinding) || !Number.isSafeInteger(input.now))
    throw new Error("OBSERVER_QA_CALLBACK_UNAVAILABLE");
  const state = randomBytes(32).toString("base64url");
  const expiresAt = input.now + maxLifetimeMs;
  const stored = await input.store.putIfAbsent(digest(state), {
    product: "digital_observer", flow: input.flow, browserBindingHash: digest(input.browserBinding), expiresAt
  });
  if (!stored) throw new Error("OBSERVER_QA_CALLBACK_UNAVAILABLE");
  return { state, expiresAt };
}

export async function consumeObserverQaCallbackState(input: {
  store?: QaCallbackStore;
  callbackUrl: string;
  flow: QaCallbackFlow;
  browserBinding: string;
  now: number;
}): Promise<{ code: string } | null> {
  if (!input.store || !validFlow(input.flow) || !validBinding(input.browserBinding) || !Number.isSafeInteger(input.now) ||
      typeof input.callbackUrl !== "string" || input.callbackUrl.length > 2_400) return null;
  // Inspect the authority before URL() normalizes default ports or dot segments.
  if (!input.callbackUrl.startsWith(`${OBSERVER_QA_CALLBACK_ORIGIN}${callbackPath}?`)) return null;
  let url: URL;
  try { url = new URL(input.callbackUrl); } catch { return null; }
  if (url.origin !== OBSERVER_QA_CALLBACK_ORIGIN || url.pathname !== callbackPath || url.username || url.password || url.hash ||
      [...url.searchParams.keys()].sort().join(",") !== "code,state" || url.searchParams.size !== 2) return null;
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{8,2048}$/.test(code)) return null;
  const consumed = await input.store.consume(digest(state), {
    product: "digital_observer", flow: input.flow, browserBindingHash: digest(input.browserBinding)
  }, input.now);
  return consumed ? { code } : null;
}
