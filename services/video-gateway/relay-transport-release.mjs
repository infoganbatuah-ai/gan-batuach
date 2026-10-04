export async function awaitRelayTransportRelease(relay, {
  timeoutMs = 2_000,
  now = () => Date.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout
} = {}) {
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1)
    throw new Error("RELAY_TRANSPORT_RELEASE_TIMEOUT_INVALID");
  const pending = [relay?.inputCompletion, relay?.processClosed]
    .filter(value => value && typeof value.then === "function");
  if (!pending.length) return { released: true, elapsed_ms: 0 };
  const startedAt = now();
  let timer = null;
  const timeout = new Promise(resolve => {
    timer = setTimer(() => resolve(false), timeoutMs);
    timer?.unref?.();
  });
  const released = await Promise.race([
    Promise.allSettled(pending).then(() => true),
    timeout
  ]);
  if (timer) clearTimer(timer);
  return { released, elapsed_ms: Math.max(0, now() - startedAt) };
}
