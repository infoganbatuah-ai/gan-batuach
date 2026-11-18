import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createQaCallbackSupabaseStore } from "../../lib/domain/digital-observer/qa-auth-callback-supabase-store.ts";
import { consumeObserverQaCallbackState, issueObserverQaCallbackState,
  OBSERVER_QA_CALLBACK_ORIGIN } from "../../lib/domain/digital-observer/qa-auth-callback-state.ts";

const binding = "A".repeat(32);
const code = "B".repeat(32);
const initialTime = 1_000_000;

// Deterministic RPC fixture, not PostgreSQL concurrency or RLS proof.
function rpcFixture() {
  const rows = new Map();
  let clock = initialTime;
  const calls = [];
  return {
    rows, calls, setTime(value) { clock = value; },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "observer_qa_callback_state_put_v1") {
        if (rows.has(args.p_state_hash) || args.p_expires_at_ms <= clock ||
            args.p_expires_at_ms > clock + 300_000) return { data: false, error: null };
        rows.set(args.p_state_hash, { ...args, consumed: false });
        return { data: true, error: null };
      }
      if (name === "observer_qa_callback_state_consume_v1") {
        const row = rows.get(args.p_state_hash);
        if (!row || row.consumed || row.p_expires_at_ms <= clock ||
            row.p_product !== args.p_product || row.p_flow !== args.p_flow ||
            row.p_browser_binding_hash !== args.p_browser_binding_hash) return { data: false, error: null };
        row.consumed = true;
        return { data: true, error: null };
      }
      return { data: null, error: { message: "unsupported RPC" } };
    }
  };
}

function callback(state) {
  return `${OBSERVER_QA_CALLBACK_ORIGIN}/auth/callback?code=${code}&state=${state}`;
}

test("issued state is hashed and two concurrent consumers select one winner", async () => {
  const fixture = rpcFixture();
  const store = createQaCallbackSupabaseStore(fixture);
  const { state } = await issueObserverQaCallbackState({ store, flow: "verify", browserBinding: binding, now: initialTime });
  assert.equal(fixture.rows.has(state), false);
  const request = { store, callbackUrl: callback(state), flow: "verify", browserBinding: binding, now: initialTime + 1 };
  const results = await Promise.all([consumeObserverQaCallbackState(request), consumeObserverQaCallbackState(request)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(await consumeObserverQaCallbackState(request), null);
});

test("browser, flow and product mismatch cannot consume the stored state", async () => {
  const fixture = rpcFixture();
  const store = createQaCallbackSupabaseStore(fixture);
  const { state } = await issueObserverQaCallbackState({ store, flow: "recovery", browserBinding: binding, now: initialTime });
  const request = { store, callbackUrl: callback(state), flow: "recovery", browserBinding: binding, now: initialTime + 1 };
  assert.equal(await consumeObserverQaCallbackState({ ...request, browserBinding: "C".repeat(32) }), null);
  assert.equal(await consumeObserverQaCallbackState({ ...request, flow: "verify" }), null);
  assert.equal(await store.consume("a".repeat(64), { product: "gan_batuach", flow: "recovery", browserBindingHash: "b".repeat(64) }, initialTime), false);
  assert.deepEqual(await consumeObserverQaCallbackState(request), { code });
});

test("database clock expiry wins over a stale caller clock", async () => {
  const fixture = rpcFixture();
  const store = createQaCallbackSupabaseStore(fixture);
  const { state } = await issueObserverQaCallbackState({ store, flow: "verify", browserBinding: binding, now: initialTime });
  fixture.setTime(initialTime + 300_000);
  assert.equal(await consumeObserverQaCallbackState({ store, callbackUrl: callback(state), flow: "verify",
    browserBinding: binding, now: initialTime + 1 }), null);
});

test("duplicate state insertion is denied even after first use", async () => {
  const fixture = rpcFixture();
  const store = createQaCallbackSupabaseStore(fixture);
  const record = { product: "digital_observer", flow: "verify", browserBindingHash: "b".repeat(64), expiresAt: initialTime + 1000 };
  const stateHash = "a".repeat(64);
  assert.equal(await store.putIfAbsent(stateHash, record), true);
  assert.equal(await store.consume(stateHash, record, initialTime), true);
  assert.equal(await store.putIfAbsent(stateHash, record), false);
});

test("RPC errors, forged data and missing client fail closed", async () => {
  assert.throws(() => createQaCallbackSupabaseStore(null), /UNAVAILABLE/);
  const broken = createQaCallbackSupabaseStore({ async rpc() { throw new Error("offline"); } });
  assert.equal(await broken.putIfAbsent("a".repeat(64), {
    product: "digital_observer", flow: "verify", browserBindingHash: "b".repeat(64), expiresAt: initialTime + 1000
  }), false);
  assert.equal(await broken.consume("a".repeat(64), {
    product: "digital_observer", flow: "verify", browserBindingHash: "b".repeat(64)
  }, initialTime), false);
  const forged = createQaCallbackSupabaseStore({ async rpc() { return { data: "true", error: null }; } });
  assert.equal(await forged.consume("a".repeat(64), {
    product: "digital_observer", flow: "verify", browserBindingHash: "b".repeat(64)
  }, initialTime), false);
});

test("unapplied SQL proposal is service-only and uses one conditional update", () => {
  const sql = readFileSync(new URL("../../supabase/migrations/20261117010818_observer_qa_callback_state_durable.sql", import.meta.url), "utf8");
  assert.match(sql, /create schema observer_qa_private/);
  assert.match(sql, /security invoker/g);
  assert.match(sql, /on conflict \(state_hash\) do nothing/);
  assert.match(sql, /consumed_at is null and expires_at > clock_timestamp\(\)/);
  assert.match(sql, /revoke all on function public\.observer_qa_callback_state_consume_v1/);
  assert.match(sql, /grant execute on function public\.observer_qa_callback_state_consume_v1\(text,text,text,text\) to service_role/);
  assert.doesNotMatch(sql, /grant execute[^;]*to (?:anon|authenticated|public)/i);
});
