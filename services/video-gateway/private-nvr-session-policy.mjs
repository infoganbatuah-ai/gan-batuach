// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

// Transport and finite native-stream failures must never rotate a shared
// recorder login. Only an explicit authentication rejection proves that the
// login needs replacement; command/watchdog recovery is separately bounded.
export function shouldRefreshPrivateNvrSession(failure) {
  return failure === "authentication_rejected";
}
