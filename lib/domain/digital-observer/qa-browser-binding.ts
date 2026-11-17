import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
// Keep this exact host aligned with the dormant callback-state contract.
// The focused test fails if either side drifts.
const OBSERVER_QA_CALLBACK_ORIGIN = "https://observer-qa.ganbatuach.com";

const COOKIE_NAME = "__Host-observer_qa_browser_binding";
const CALLBACK_PATH = "/auth/callback";
const MAX_AGE_SECONDS = 300;
const BINDING_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/;

export type ObserverQaFlow = "verify" | "recovery";

function configuredQaOrigin(value: string | undefined): boolean {
  return value === OBSERVER_QA_CALLBACK_ORIGIN;
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// Pure, dormant contract: the caller must set this cookie on the exact QA host.
// Never put the raw value in a redirect, log, or durable state record.
export function createObserverQaBrowserBinding(input: {
  configuredOrigin?: string;
  product: string;
  flow: ObserverQaFlow;
}) {
  if (!configuredQaOrigin(input.configuredOrigin) || input.product !== "digital_observer" ||
      (input.flow !== "verify" && input.flow !== "recovery")) return null;
  const entropy = randomBytes(32);
  const value = entropy.toString("base64url");
  return Object.freeze({
    browserBinding: value,
    browserBindingHash: digest(value),
    cookie: Object.freeze({ name: COOKIE_NAME, value, httpOnly: true, secure: true,
      sameSite: "lax" as const, path: "/", maxAge: MAX_AGE_SECONDS })
  });
}

export function observerQaReturnTarget(input: {
  configuredOrigin?: string;
  product: string;
  flow: ObserverQaFlow;
  target: string;
}): string | null {
  if (!configuredQaOrigin(input.configuredOrigin) || input.product !== "digital_observer" ||
      (input.flow !== "verify" && input.flow !== "recovery") ||
      input.target !== `${OBSERVER_QA_CALLBACK_ORIGIN}${CALLBACK_PATH}`) return null;
  return input.target;
}

// A missing/mismatched cookie cannot recover a state, even with its hash.
// Replay protection remains the durable store's atomic consume responsibility.
export function matchesObserverQaBrowserBinding(cookieValue: string | undefined, expectedHash: string): boolean {
  if (!cookieValue || !BINDING_PATTERN.test(cookieValue) || !HASH_PATTERN.test(expectedHash)) return false;
  return timingSafeEqual(Buffer.from(digest(cookieValue), "hex"), Buffer.from(expectedHash, "hex"));
}
