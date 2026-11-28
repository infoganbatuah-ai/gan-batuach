package com.ganbatuach.app;

import java.util.concurrent.atomic.AtomicLong;

public class ObserverQaReturnGateTest {
  private static final String APP = "com.digitalobserver.app.qa";
  private static final String STATE = "a".repeat(64);
  private static final String URL = "observerqaandroid://return/qa/device-proof?state=" + STATE;

  private static void check(boolean condition) {
    if (!condition) throw new AssertionError("OBSERVER_QA_RETURN_GATE_TEST_FAILED");
  }

  public static void main(String[] args) {
    defaultClosedAndExactObserverOnly();
    malformedForeignAndExpiredReturnsFailClosed();
    returnCandidateIsOnlyTheAndroidControlAuthority();
  }

  private static void defaultClosedAndExactObserverOnly() {
    AtomicLong now = new AtomicLong(1000);
    check(!new ObserverQaReturnGate(false, now::get).begin(APP, STATE));
    ObserverQaReturnGate gate = new ObserverQaReturnGate(true, now::get);
    check(!gate.begin("com.ganbatuach.app.qa", STATE));
    check(!gate.begin(APP, "not-a-state"));
    check(gate.begin(APP, STATE));
    check(!gate.begin(APP, STATE));
    check(!gate.consume("com.ganbatuach.app.qa", URL));
    check(!gate.consume(APP, URL));
    check(gate.begin(APP, STATE));
    check(gate.consume(APP, URL));
    check(!gate.consume(APP, URL));
  }

  private static void malformedForeignAndExpiredReturnsFailClosed() {
    String[] invalid = {
      URL.replace("observerqaandroid", "observerqaapp"),
      URL.replace("//return", "//other"),
      URL.replace("/qa/device-proof", "/qa/other"),
      URL + "&code=secret", URL + "#fragment", URL.replace(STATE, "b".repeat(64))
    };
    AtomicLong now = new AtomicLong(1000);
    ObserverQaReturnGate gate = new ObserverQaReturnGate(true, now::get);
    for (String url : invalid) {
      check(gate.begin(APP, STATE));
      check(!gate.consume(APP, url));
      check(!gate.consume(APP, URL));
    }
    check(gate.begin(APP, STATE));
    now.set(121000);
    check(!gate.consume(APP, URL));
  }

  private static void returnCandidateIsOnlyTheAndroidControlAuthority() {
    check(ObserverQaReturnGate.isReturnCandidate(URL));
    check(ObserverQaReturnGate.isReturnCandidate("observerqaandroid://return/other"));
    check(!ObserverQaReturnGate.isReturnCandidate("observerqaandroid://camera/id"));
    check(!ObserverQaReturnGate.isReturnCandidate("digitalobserver://return/qa/device-proof"));
  }
}
