export function createRequestWorkScope(request, response, timeoutMs) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const close = () => { if (!response.writableFinished) abort(); };
  const timer = setTimeout(abort, timeoutMs);
  timer.unref?.();
  // IncomingMessage.close also fires after a normally consumed POST body.
  // Only an aborted request or unfinished response cancels request-owned work.
  request.once("aborted", abort);
  response.once("close", close);
  response.once("error", abort);
  if (request.aborted || response.destroyed) abort();
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      request.removeListener("aborted", abort);
      response.removeListener("close", close);
      response.removeListener("error", abort);
    }
  };
}

// Detach a cancelled caller without stopping a relay shared by other viewers.
export function awaitRequestWork(work, signal) {
  if (!signal) return Promise.resolve(work);
  return new Promise((resolve, reject) => {
    const abort = () => finish(reject, signal.reason);
    const finish = (settle, value) => {
      signal.removeEventListener("abort", abort);
      settle(value);
    };
    Promise.resolve(work).then(value => finish(resolve, value), error => finish(reject, error));
    if (signal.aborted) abort();
    else signal.addEventListener("abort", abort, { once: true });
  });
}
