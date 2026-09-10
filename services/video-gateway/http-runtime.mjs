import { install } from "undici";

// Node 24.16 bundles Undici 7.25.0. That build can synchronously throw
// setTypeOfService EINVAL on macOS from outside the fetch promise, terminating
// the edge process. Use the maintained package runtime whose upstream fix
// makes advisory ToS handling best-effort. This is deliberately installed only
// by the managed edge entry points; it does not add a global exception filter.
export const EDGE_HTTP_RUNTIME_VERSION = "8.10.2";

const singleton = Symbol.for("digital-observer.edge-http-runtime");

if (!globalThis[singleton]) {
  install();
  globalThis[singleton] = Object.freeze({
    provider: "undici-package",
    version: EDGE_HTTP_RUNTIME_VERSION,
    bundledNodeVersion: process.versions.undici || null,
    typeOfServiceCrashGuard: true
  });
}

export function edgeHttpRuntimeStatus() {
  return globalThis[singleton];
}
