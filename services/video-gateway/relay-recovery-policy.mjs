export const RELAY_RECOVERY_STABLE_MS = 60_000;

export function relayRetryDelayMs(recovery, now = Date.now()) {
  return Math.max(0, Number(recovery?.next_retry_at || 0) - now);
}

export function relayRecoveryIsStable(relay, now = Date.now(), stableMs = RELAY_RECOVERY_STABLE_MS) {
  return Boolean(relay && now - relay.startedAt >= stableMs);
}

export function relayRecoveryShouldResume({ hasPlaybackLease = false,
  sourceRegistered = false } = {}) {
  // A playback claim is deliberately issued only after ensureRelay succeeds.
  // Requiring that future lease as the sole restart signal creates a circular
  // recovery gap: the relay cannot restart without a lease and the lease
  // cannot be issued without a relay. A registered local source is also an
  // authoritative demand signal for health/AI supervision.
  return Boolean(hasPlaybackLease || sourceRegistered);
}

export function nextRelayRecovery(previous, now = Date.now()) {
  // A zero exit can still be a short-lived native stream. Only sustained
  // progressing video, not the child exit code, clears the failure history.
  const failures = Math.min(8, (previous?.failures || 0) + 1);
  const retry_ms = Math.min(60_000, 500 * (2 ** Math.max(0, failures - 1)));
  return { ...previous, failures, next_retry_at: now + retry_ms, retry_ms };
}
