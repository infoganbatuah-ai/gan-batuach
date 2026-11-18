import type { QaCallbackRecord, QaCallbackStore } from "./qa-auth-callback-state";

// Server-only dependency injection. This module never creates a Supabase client
// or transports a service-role key; no live route imports it.
export type QaCallbackRpcClient = {
  rpc: (name: string, args: Record<string, string | number>) => Promise<{
    data: unknown; error: { message?: string } | null;
  }>;
};

const digest = (value: string) => /^[a-f0-9]{64}$/.test(value);
const validRecord = (record: Omit<QaCallbackRecord, "expiresAt">) =>
  record?.product === "digital_observer" &&
  (record.flow === "verify" || record.flow === "recovery") &&
  digest(record.browserBindingHash);

export function createQaCallbackSupabaseStore(client: QaCallbackRpcClient): QaCallbackStore {
  if (!client || typeof client.rpc !== "function") throw new Error("OBSERVER_QA_CALLBACK_STORE_UNAVAILABLE");
  return {
    async putIfAbsent(stateHash, record) {
      if (!digest(stateHash) || !validRecord(record) || !Number.isSafeInteger(record.expiresAt))
        return false;
      try {
        const result = await client.rpc("observer_qa_callback_state_put_v1", {
          p_state_hash: stateHash, p_product: record.product, p_flow: record.flow,
          p_browser_binding_hash: record.browserBindingHash, p_expires_at_ms: record.expiresAt
        });
        return !result.error && result.data === true;
      } catch { return false; }
    },
    async consume(stateHash, expected, now) {
      if (!digest(stateHash) || !validRecord(expected) || !Number.isSafeInteger(now)) return false;
      // SQL uses its own clock. The application timestamp is input validation
      // only; a caller cannot extend a state by passing an earlier `now`.
      try {
        const result = await client.rpc("observer_qa_callback_state_consume_v1", {
          p_state_hash: stateHash, p_product: expected.product, p_flow: expected.flow,
          p_browser_binding_hash: expected.browserBindingHash
        });
        return !result.error && result.data === true;
      } catch { return false; }
    }
  };
}
