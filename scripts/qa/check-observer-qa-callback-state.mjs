import assert from "node:assert/strict";
import { test } from "node:test";
import { consumeObserverQaCallbackState, issueObserverQaCallbackState, OBSERVER_QA_CALLBACK_ORIGIN } from "../../lib/domain/digital-observer/qa-auth-callback-state.ts";

const binding = "A".repeat(32);
const code = "B".repeat(32);
const now = 1_000_000;

function syntheticAtomicStore() {
  const rows = new Map();
  return {
    rows,
    async putIfAbsent(hash, record) {
      if (rows.has(hash)) return false;
      rows.set(hash, { ...record });
      return true;
    },
    async consume(hash, expected, at) {
      const record = rows.get(hash);
      if (!record || at >= record.expiresAt || record.product !== expected.product ||
          record.flow !== expected.flow || record.browserBindingHash !== expected.browserBindingHash) return false;
      rows.delete(hash); // synthetic atomic compare-and-consume; no database proof
      return true;
    }
  };
}

const callback = (state) => `${OBSERVER_QA_CALLBACK_ORIGIN}/auth/callback?code=${code}&state=${state}`;

test("exact-host synthetic callback consumes state once and stores no raw state", async () => {
  const store = syntheticAtomicStore();
  const issued = await issueObserverQaCallbackState({ store, flow: "verify", browserBinding: binding, now });
  assert.equal(store.rows.has(issued.state), false);
  const input = { store, callbackUrl: callback(issued.state), flow: "verify", browserBinding: binding, now: now + 1 };
  assert.deepEqual(await consumeObserverQaCallbackState(input), { code });
  assert.equal(await consumeObserverQaCallbackState(input), null);
});

test("wrong host, product, path, credentials and token-bearing callback never consume state", async () => {
  const store = syntheticAtomicStore();
  const { state } = await issueObserverQaCallbackState({ store, flow: "verify", browserBinding: binding, now });
  for (const url of [
    callback(state).replace("observer-qa.ganbatuach.com", "ganbatuach.com"),
    callback(state).replace("observer-qa.ganbatuach.com", "observer-qa.ganbatuach.com.evil.test"),
    callback(state).replace("/auth/callback", "/dashboard/parent"),
    `${callback(state)}&product=gan_batuach`, `${callback(state)}&access_token=hidden`,
    `${callback(state)}#refresh_token=hidden`,
    callback(state).replace("https://", "https://user@"),
    callback(state).replace("observer-qa.ganbatuach.com/auth", "observer-qa.ganbatuach.com:443/auth")
  ]) assert.equal(await consumeObserverQaCallbackState({ store, callbackUrl: url, flow: "verify", browserBinding: binding, now: now + 1 }), null);
  assert.deepEqual(await consumeObserverQaCallbackState({ store, callbackUrl: callback(state), flow: "verify", browserBinding: binding, now: now + 1 }), { code });
});

test("missing, wrong-binding, wrong-flow and expired state fail closed", async () => {
  const store = syntheticAtomicStore();
  const { state } = await issueObserverQaCallbackState({ store, flow: "recovery", browserBinding: binding, now });
  const input = { store, callbackUrl: callback(state), flow: "recovery", browserBinding: binding, now: now + 1 };
  assert.equal(await consumeObserverQaCallbackState({ ...input, callbackUrl: `${OBSERVER_QA_CALLBACK_ORIGIN}/auth/callback?code=${code}` }), null);
  assert.equal(await consumeObserverQaCallbackState({ ...input, flow: "verify" }), null);
  assert.equal(await consumeObserverQaCallbackState({ ...input, browserBinding: "C".repeat(32) }), null);
  assert.equal(await consumeObserverQaCallbackState({ ...input, now: now + 300_000 }), null);
});

test("no durable store or malformed inputs cannot issue or consume", async () => {
  await assert.rejects(issueObserverQaCallbackState({ flow: "verify", browserBinding: binding, now }), /UNAVAILABLE/);
  assert.equal(await consumeObserverQaCallbackState({ callbackUrl: callback("D".repeat(43)), flow: "verify", browserBinding: binding, now }), null);
  const store = syntheticAtomicStore();
  const { state } = await issueObserverQaCallbackState({ store, flow: "verify", browserBinding: binding, now });
  assert.equal(await consumeObserverQaCallbackState({ store, callbackUrl: `${OBSERVER_QA_CALLBACK_ORIGIN}/auth/callback?code=${code}&code=${code}&state=${state}`, flow: "verify", browserBinding: binding, now }), null);
});
