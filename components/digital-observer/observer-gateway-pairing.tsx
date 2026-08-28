"use client";

import { useState } from "react";
import { Copy, LoaderCircle, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

export function ObserverGatewayPairing({ observerSiteId }: { observerSiteId: string }) {
  const [value, setValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createPairing() {
    setBusy(true); setError("");
    try {
      const token = readObserverAccessToken();
      const response = await fetch("/api/digital-observer/gateway-pairing", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "create", observer_site_id: observerSiteId }) });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "לא ניתן ליצור קוד pairing.");
      setValue(`${payload.data.pairing_id}.${payload.data.pairing_code}`);
      setExpiresAt(String(payload.data.expires_at || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן ליצור קוד pairing.");
    } finally { setBusy(false); }
  }

  return <section className="do-panel do-form-section">
    <div className="do-section-head"><div><h2>Pairing ל-Gateway המקומי</h2><p>הקוד מחבר את המקבוק לאתר הזה בלבד. הוא חד־פעמי וקצר־חיים; פרטי ה-DVR נשארים מקומיים.</p></div><ShieldCheck /></div>
    {!value ? <button className="do-button primary" type="button" disabled={busy} onClick={createPairing}>{busy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} יצירת קוד pairing</button> : <div className="do-notice info"><strong>קוד pairing מוכן</strong><code className="do-pairing-code">{value}</code><small>בתוקף עד {new Date(expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}. הזינו אותו במסך ה-Gateway המקומי.</small><button className="do-button secondary" type="button" onClick={() => navigator.clipboard?.writeText(value)}><Copy /> העתקה</button></div>}
    {error ? <p className="do-action-result error">{error}</p> : null}
  </section>;
}
