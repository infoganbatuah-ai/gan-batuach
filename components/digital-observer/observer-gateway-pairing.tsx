"use client";

import { useEffect, useState } from "react";
import { Activity, Copy, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

export function ObserverGatewayPairing({ observerSiteId }: { observerSiteId: string }) {
  const [value, setValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [gatewayUrl, setGatewayUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ camera_count: number; connected_camera_count: number; checked_at: string } | null>(null);
  const [statusError, setStatusError] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadConnectionStatus() {
      try {
        const token = readObserverAccessToken();
        const response = await fetch(`/api/digital-observer/runtime-status?observer_site_id=${encodeURIComponent(observerSiteId)}`, {
          credentials: "same-origin",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error("status_unavailable");
        if (active) {
          setConnectionStatus(payload.data ?? null);
          setStatusError(false);
        }
      } catch {
        if (active) setStatusError(true);
      }
    }
    void loadConnectionStatus();
    const timer = window.setInterval(() => void loadConnectionStatus(), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [observerSiteId]);

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

  const hasMappedCameras = Boolean(connectionStatus?.connected_camera_count);
  return <section className="do-panel do-form-section do-gateway-pairing-step">
    <div className="do-section-head"><div><h2>מצב המקליט והחיבור המקומי</h2><p>פרטי DVR במחשב בלבד. מצב הערוצים בדשבורד מתעדכן אוטומטית, ללא Pairing מחדש בשימוש רגיל.</p></div><ShieldCheck /></div>
    <div className={`do-gateway-status ${hasMappedCameras ? "connected" : "pending"}`} aria-live="polite">
      <Activity />
      <span><strong>{connectionStatus ? `${connectionStatus.connected_camera_count}/${connectionStatus.camera_count} ערוצים מחוברים` : statusError ? "לא ניתן לקרוא כרגע את מצב המקליט" : "בודק את מצב המקליט..."}</strong><small>{connectionStatus?.checked_at ? `עודכן ${new Date(connectionStatus.checked_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })} · רענון אוטומטי כל דקה` : "לא נשלחים פרטי DVR לדשבורד"}</small></span>
    </div>
    {!value ? <details className="do-gateway-recovery"><summary><RefreshCw /> {hasMappedCameras ? "חיבור מחדש או החלפת מחשב" : "חיבור המקליט בפעם הראשונה"}</summary><div className="do-gateway-recovery-content"><p>{hasMappedCameras ? "Pairing נדרש רק כאשר מחברים מקליט ממחשב חדש, משחזרים חיבור מקומי או מחליפים את המקליט." : "הכינו אישור קצר־חיים במחשב שמחובר לאותה רשת של המקליט."}</p><button className="do-button primary" type="button" disabled={busy} onClick={createPairing}>{busy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} הכנת חיבור המקליט</button></div></details> : <div className="do-gateway-pairing-code-stage"><strong>החיבור מוכן לאישור במחשב המקומי</strong><ol className="do-gateway-pairing-steps"><li>פתחו את רכיב החיבור במחשב שמחובר לאותה רשת של המקליט.</li><li>הדביקו את הקוד החד־פעמי ואשרו Pairing.</li><li>אחרי אישור מוצג המקליט הקיים; CONNECT מתחיל discovery לקריאה בלבד.</li></ol><code className="do-pairing-code">{value}</code><small>בתוקף עד {new Date(expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}. הקוד לא כולל כתובת, משתמש או סיסמת DVR.</small><div className="do-gateway-pairing-actions">{gatewayUrl ? <a className="do-button primary" href={gatewayUrl} target="_blank" rel="noreferrer"><ExternalLink /> פתיחת רכיב החיבור במחשב זה</a> : null}<button className="do-button secondary" type="button" onClick={() => navigator.clipboard?.writeText(value)}><Copy /> העתקת קוד</button></div></div>}
    {error ? <p className="do-action-result error">{error}</p> : null}
  </section>;
}
