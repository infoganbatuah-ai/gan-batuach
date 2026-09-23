// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

// Ordinary transport, finite native-stream, and non-media responses must never
// rotate a shared recorder login. Live Home evidence showed that a recorder
// can advertise non-exclusive logins yet invalidate all active channels when
// a second login replaces the shared session. Only an explicit 401/403 proves
// that the credentialed session itself must be replaced.
export function shouldRefreshPrivateNvrSession(failure) {
  return failure === "authentication_rejected";
}
