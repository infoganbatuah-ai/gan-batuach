import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createObserverQaBrowserBinding, matchesObserverQaBrowserBinding, observerQaReturnTarget
} from "../../lib/domain/digital-observer/qa-browser-binding.ts";
import { OBSERVER_QA_CALLBACK_ORIGIN } from "../../lib/domain/digital-observer/qa-auth-callback-state.ts";

const origin = "https://observer-qa.ganbatuach.com";
const input = { configuredOrigin: origin, product: "digital_observer", flow: "verify" };
const target = `${origin}/auth/callback`;

test("QA host agrees with the dormant durable callback-state contract", () => {
  assert.equal(origin, OBSERVER_QA_CALLBACK_ORIGIN);
});

test("random browser binding is cookie-only with host-only secure attributes", () => {
  const one = createObserverQaBrowserBinding(input);
  const two = createObserverQaBrowserBinding(input);
  assert.ok(one && two);
  assert.notEqual(one.browserBinding, two.browserBinding);
  assert.notEqual(one.browserBindingHash, two.browserBindingHash);
  assert.deepEqual({ ...one.cookie, value: undefined }, {
    name: "__Host-observer_qa_browser_binding", value: undefined,
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 300
  });
  assert.equal(Object.hasOwn(one.cookie, "domain"), false);
  assert.equal(matchesObserverQaBrowserBinding(one.cookie.value, one.browserBindingHash), true);
  assert.equal(matchesObserverQaBrowserBinding(two.cookie.value, one.browserBindingHash), false);
  assert.equal(matchesObserverQaBrowserBinding(undefined, one.browserBindingHash), false);
  assert.equal(matchesObserverQaBrowserBinding(one.cookie.value, "bad"), false);
});

test("missing QA configuration and foreign product fail closed", () => {
  assert.equal(createObserverQaBrowserBinding({ ...input, configuredOrigin: undefined }), null);
  assert.equal(createObserverQaBrowserBinding({ ...input, configuredOrigin: "https://ganbatuach.com" }), null);
  assert.equal(createObserverQaBrowserBinding({ ...input, product: "gan_management" }), null);
  assert.equal(createObserverQaBrowserBinding({ ...input, flow: "login" }), null);
});

test("only exact QA callback target passes; no open redirect or query injection", () => {
  assert.equal(observerQaReturnTarget({ ...input, target }), target);
  assert.equal(observerQaReturnTarget({ ...input, flow: "recovery", target }), target);
  for (const foreign of [
    `${target}?state=secret`, `${target}#fragment`, `${origin}.evil.test/auth/callback`,
    `http://observer-qa.ganbatuach.com/auth/callback`, `${origin}:443/auth/callback`,
    `${origin}/auth/callback/`, "//evil.test", "/auth/callback"
  ]) assert.equal(observerQaReturnTarget({ ...input, target: foreign }), null, foreign);
  assert.equal(observerQaReturnTarget({ ...input, configuredOrigin: undefined, target }), null);
  assert.equal(observerQaReturnTarget({ ...input, product: "gan_management", target }), null);
});
