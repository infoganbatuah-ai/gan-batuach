// An empty relay set is not proof of expired authentication. Native streams
// can all end together at the recorder's finite response boundary.
export function reuseMatchingPrivateNvrSession(existing, input) {
  return Boolean(existing?.input && existing.input.password === input?.password
    && (existing.input.stream_quality || "sub") === (input?.stream_quality || "sub")
    && existing.input.username === input.username);
}

// Ordinary transport and finite native-stream failures must never rotate a
// shared recorder login. An explicit authentication rejection always proves
// that the login needs replacement. The one recorder-specific exception below
// requires the device's own non-exclusive-login declaration and a mature
// session, so a camera-specific failure cannot churn a fresh/shared login.
export function shouldRefreshPrivateNvrSession(failure, context = {}) {
  if (failure === "authentication_rejected") return true;
  // This recorder family can expire a finite native-web session by returning
  // a non-media success response instead of 401/403. A replacement login is
  // safe only when the device itself explicitly reports non-exclusive logins
  // and the existing session has reached the observed finite-session window.
  return failure === "source_not_media"
    && context.loginExclusivity === false
    && Number(context.sessionAgeMs || 0) >= 240_000;
}
