"use client";

import { useState } from "react";
import { Copy, ExternalLink, LoaderCircle, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

export function ObserverGatewayPairing({ observerSiteId }: { observerSiteId: string }) {
  const [value, setValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
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
      setGatewayUrl(String(payload.data.gateway_url || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן ליצור קוד pairing.");
    } finally { setBusy(false); }
  }

  return <section className="do-panel do-form-section do-gateway-pairing-step">
    <div className="do-section-head"><div><h2>חיבור המקליט במחשב המקומי</h2><p>זהו שלב פנימי בהוספת המקליט. הרכיב המקומי מגלה את הערוצים ושומר פרטי DVR במחשב בלבד.</p></div><ShieldCheck /></div>
    {!value ? <div className="do-pairing-start"><p>במחשב שבו נמצא המקליט, צרו אישור קצר־חיים ואז פתחו את רכיב החיבור המקומי.</p><button className="do-button primary" type="button" disabled={busy} onClick={createPairing}>{busy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} הכנת חיבור המקליט</button></div> : <div className="do-notice info"><strong>החיבור מוכן לאישור במחשב המקומי</strong><ol className="do-gateway-pairing-steps"><li>פתחו את רכיב החיבור במחשב שמחובר לאותה רשת של המקליט.</li><li>הדביקו את הקוד החד־פעמי ואשרו Pairing.</li><li>אחרי אישור מוצג המקליט הקיים; CONNECT מתחיל discovery לקריאה בלבד.</li></ol><code className="do-pairing-code">{value}</code><small>בתוקף עד {new Date(expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}. הקוד לא כולל כתובת, משתמש או סיסמת DVR.</small><div className="do-inline-actions">{gatewayUrl ? <a className="do-button primary" href={gatewayUrl} target="_blank" rel="noreferrer"><ExternalLink /> פתיחת רכיב החיבור במחשב זה</a> : null}<button className="do-button secondary" type="button" onClick={() => navigator.clipboard?.writeText(value)}><Copy /> העתקת קוד</button></div></div>}
    {error ? <p className="do-action-result error">{error}</p> : null}
  </section>;
}
