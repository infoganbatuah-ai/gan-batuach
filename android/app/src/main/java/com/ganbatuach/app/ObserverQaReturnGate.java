package com.ganbatuach.app;

import java.util.Locale;
import java.util.function.LongSupplier;

// Android-only, default-off control return. No production code issues a pending
// state or enables this gate; a future authorized flow must do both explicitly.
final class ObserverQaReturnGate {
  private static final String APP_ID = "com.digitalobserver.app.qa";
  private static final String PREFIX = "observerqaandroid://return/qa/device-proof?state=";
  private static final long MAX_AGE_MS = 120_000L;
  private final boolean enabled;
  private final LongSupplier clock;
  private String pendingState;
  private long expiresAt;

  ObserverQaReturnGate(boolean enabled, LongSupplier clock) {
    this.enabled = enabled;
    this.clock = clock;
  }

  static boolean isReturnCandidate(String rawUrl) {
    return rawUrl != null && rawUrl.toLowerCase(Locale.ROOT).startsWith("observerqaandroid://return");
  }

  synchronized boolean begin(String appId, String state) {
    if (!enabled || !APP_ID.equals(appId) || pendingState != null || !isState(state)) return false;
    pendingState = state;
    expiresAt = clock.getAsLong() + MAX_AGE_MS;
    return true;
  }

  synchronized boolean consume(String appId, String rawUrl) {
    if (!enabled || pendingState == null) return false;
    String expected = pendingState;
    pendingState = null; // Any attempt, including a rejected one, burns the pending return.
    return APP_ID.equals(appId) && clock.getAsLong() < expiresAt &&
        rawUrl != null && rawUrl.equals(PREFIX + expected);
  }

  private static boolean isState(String state) {
    return state != null && state.matches("[a-f0-9]{64}");
  }
}
