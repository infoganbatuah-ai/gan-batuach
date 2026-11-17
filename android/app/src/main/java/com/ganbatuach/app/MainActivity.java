package com.ganbatuach.app;

import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private final ObserverQaReturnGate qaReturnGate = new ObserverQaReturnGate(false, System::currentTimeMillis);

  @Override
  public void onCreate(Bundle savedInstanceState) {
    suppressUnapprovedQaReturn(getIntent());
    super.onCreate(savedInstanceState);
    getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    suppressUnapprovedQaReturn(intent);
    super.onNewIntent(intent);
  }

  private void suppressUnapprovedQaReturn(Intent intent) {
    if (intent == null || !ObserverQaReturnGate.isReturnCandidate(intent.getDataString())) return;
    // The authenticated return producer is not activated. Do not forward a
    // callback, valid or malformed, to Capacitor's generic appUrlOpen path.
    qaReturnGate.consume(getPackageName(), intent.getDataString());
    intent.setData(null);
  }
}
