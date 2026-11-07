function fail(code) { throw Object.assign(new Error(code), { code }); }

// A loopback caller may abandon a bounded cloud proxy request before the
// provider responds. Propagate that lifecycle upstream so repeated local
// retries cannot accumulate orphaned provider requests beside live media.
export function createDownstreamAbortScope({ request, response, timeoutMs = 30_000,
  setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  if (typeof request?.once !== "function" || typeof response?.once !== "function" ||
    !Number.isInteger(timeoutMs) || timeoutMs < 250) fail("EDGE_CLOUD_PROXY_SCOPE_INVALID");
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => { if (!response.writableEnded) abort(); };
  request.once("aborted", abort);
  response.once("close", close);
  const timer = setTimer(abort, timeoutMs);
  timer?.unref?.();
  if (request.aborted || (response.destroyed && !response.writableEnded)) abort();
  return {
    signal: controller.signal,
    dispose() {
      clearTimer(timer);
      request.removeListener?.("aborted", abort);
      response.removeListener?.("close", close);
    }
  };
}
