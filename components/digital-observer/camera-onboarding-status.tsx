"use client";

import { useState } from "react";
import { Check, CircleAlert, LoaderCircle, RefreshCw, Router, ShieldCheck } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

export type CameraOnboardingSource = { id: string; display_name: string; status?: string | null; health_status?: string | null; source_mode?: string | null; last_seen_at?: string | null };
type ExistingSourceAssessment = { recommendation: string; reasonCodes: string[] };

const recommendationLabels: Record<string, string> = {
  DIRECT_CONNECTION_AVAILABLE: "חיבור דיגיטלי זמין",
  SOFTWARE_CONNECTOR_REQUIRED: "נדרש Connector",
  PHYSICAL_GATEWAY_REQUIRED: "Gateway מקומי מוצדק",
  ENTERPRISE_EDGE_RECOMMENDED: "מומלץ Edge ארגוני",
  UNSUPPORTED_SYSTEM: "נדרשים פרטים נוספים"
};

async function api(path: string, body: unknown) {
  const token = readObserverAccessToken();
  const response = await fetch(path, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "לא ניתן להשלים את בדיקת החיבור");
  return payload.data;
}

export function CameraOnboardingStatus({ observerSiteId, source }: { observerSiteId: string; source: CameraOnboardingSource }) {
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [assessment, setAssessment] = useState<ExistingSourceAssessment | null>(null);
  const healthyLive = source.status === "connected" && source.health_status === "healthy" && ["live", "gateway_test"].includes(String(source.source_mode)) && Boolean(source.last_seen_at);
  async function reassess() {
    setState("loading"); setError("");
    try {
      const result = await api("/api/digital-observer/connection-assessment", { action: "assess_existing", observer_site_id: observerSiteId, camera_source_id: source.id, persist: false });
      setAssessment(result.assessment); setState("ready");
    } catch (value) { setError(value instanceof Error ? value.message : "לא ניתן לבדוק את החיבור"); setState("error"); }
  }
  return <section className="do-panel do-form-section" aria-live="polite">
    <div className="do-section-head"><div><h2>החיבור הקיים נשמר</h2><p>לא ניצור מקור נוסף ולא נרשום מחדש את ה‑Gateway. זו בדיקה לא הרסנית של המסלול הקיים.</p></div>{healthyLive ? <span className="do-badge good"><Check /> ניטור פעיל</span> : <span className="do-badge warn"><CircleAlert /> דורש בדיקה</span>}</div>
    <dl className="do-connection-facts"><div><dt>מקור</dt><dd>{source.display_name}</dd></div><div><dt>מצב אמיתי</dt><dd>{healthyLive ? "Streaming / AI מוכן" : "לא מאומת כפעיל"}</dd></div><div><dt>המלצת חיבור</dt><dd>{assessment ? recommendationLabels[assessment.recommendation] ?? assessment.recommendation : "בודק…"}</dd></div></dl>
    {assessment ? <div className="do-notice info"><Router /><span>{assessment.reasonCodes.includes("LEGACY_RECORDER_REQUIRES_LOCAL_BRIDGE") ? "ה‑Gateway הקיים נשאר מוצדק: המקליט זמין רק ברשת המקומית ופועל בחיבור יוצא ומאומת." : "ההמלצה נשענת על יכולות המקור והמסלול המאובטח הזמין."}</span></div> : null}
    {state === "loading" ? <p className="do-help-copy"><LoaderCircle className="do-spin" /> בודק את ההגדרה הקיימת…</p> : state === "idle" ? <p className="do-help-copy">הבדיקה אינה משנה את ההגדרה הקיימת ואינה מפעילה רישום מחדש.</p> : null}
    {state === "error" ? <p className="do-action-result error"><CircleAlert /> {error}</p> : null}
    <button className="do-button secondary" type="button" onClick={() => void reassess()} disabled={state === "loading"}><RefreshCw /> בדיקה חוזרת</button>
    <p className="do-help-copy"><ShieldCheck /> בדיקה זו אינה קוראת או מציגה סיסמאות, כתובות מקור או מזהי זרם.</p>
  </section>;
}
