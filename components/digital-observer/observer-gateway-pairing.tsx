"use client";

import { useEffect, useState } from "react";
import { Activity, Copy, ExternalLink, LoaderCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type GatewayStatus = {
  camera_count: number;
  connected_camera_count: number;
  offline_camera_count: number;
  gateway_enrolled: boolean;
  checked_at: string | null;
  truthful_status: "connected" | "enrolled_waiting_for_discovery" | "not_enrolled";
};

export function ObserverGatewayPairing({ observerSiteId }: { observerSiteId: string }) {
  const [status, setStatus] = useState<GatewayStatus | null>(null);
  const [pairingValue, setPairingValue] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    async function refreshStatus() {
      const token = readObserverAccessToken();
      const response = await fetch(`/api/digital-observer/runtime-status?observer_site_id=${encodeURIComponent(observerSiteId)}`, {
        credentials: "same-origin",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "לא ניתן לבדוק את מצב החיבור.");
      if (active) setStatus(payload.data);
    }
    void refreshStatus().catch((cause) => active && setError(cause instanceof Error ? cause.message : "לא ניתן לבדוק את מצב החיבור."));
    const timer = window.setInterval(() => void refreshStatus().catch(() => undefined), 60_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [observerSiteId]);

  async function createFallbackPairing() {
    setBusy(true);
    setError("");
    try {
      const token = readObserverAccessToken();
      const response = await fetch("/api/digital-observer/gateway-pairing", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "create", observer_site_id: observerSiteId })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "לא ניתן להכין קוד שחזור.");
      setPairingValue(`${payload.data.pairing_id}.${payload.data.pairing_code}`);
      setExpiresAt(String(payload.data.expires_at || ""));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "לא ניתן להכין קוד שחזור.");
    } finally {
      setBusy(false);
    }
  }

  const connected = Boolean(status?.connected_camera_count);
  return <section className="do-gateway-pairing-step">
    <div className={`do-gateway-status ${connected ? "connected" : "pending"}`} aria-live="polite">
      <Activity />
      <span>
        <strong>{status ? `${status.connected_camera_count}/${status.camera_count} ערוצים מחוברים` : "בודק את מצב המקליט..."}</strong>
        <small>{status?.checked_at ? `בדיקה אחרונה ${new Date(status.checked_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "פרטי המקליט אינם נשלחים לדשבורד"}</small>
      </span>
    </div>
    <div className="do-gateway-pairing-actions">
      <a className="do-button primary" href="http://127.0.0.1:18180" target="_blank" rel="noreferrer">
        <ExternalLink /> {status?.gateway_enrolled ? "פתיחת חיבור המקליט" : "חיבור המחשב והמקליט"}
      </a>
      <span>במחשב המחובר לרשת המקליט ייפתח אישור חד־פעמי. בשימוש רגיל אין קוד ואין הזנה חוזרת.</span>
    </div>
    <details className="do-gateway-recovery">
      <summary><RefreshCw /> שחזור, מחשב אחר או התקנה ללא מסך</summary>
      <div className="do-gateway-recovery-content">
        {!pairingValue ? <button className="do-button secondary" type="button" disabled={busy} onClick={createFallbackPairing}>{busy ? <LoaderCircle className="do-spin" /> : <ShieldCheck />} יצירת קוד חד־פעמי</button> : <>
          <code className="do-pairing-code">{pairingValue}</code>
          <small>בתוקף עד {new Date(expiresAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}. הקוד אינו כולל כתובת או סיסמת DVR.</small>
          <button className="do-button secondary" type="button" onClick={() => navigator.clipboard?.writeText(pairingValue)}><Copy /> העתקה</button>
        </>}
      </div>
    </details>
    {error ? <p className="do-action-result error">{error}</p> : null}
  </section>;
}
