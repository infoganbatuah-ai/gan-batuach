"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { connectivityRegistry, type ConnectivityFamilyId } from "@/lib/domain/digital-observer/connectivity-registry";
import type { ConnectionPlan } from "@/lib/domain/digital-observer/connection-orchestrator";
import { SoftwareConnectorOnboarding } from "./software-connector-onboarding";
import { ConnectorInstallHandoff } from "./connector-install-handoff";

type PlanResponse = { plan: ConnectionPlan; diagnostic_id: string; connector_online: boolean; installer_delivery: string };
type NativeDiscoveryBridge = { discoverLocalCameras(input: { sessionId: string; siteId: string }): Promise<unknown> };

export function UniversalCameraOnboarding({ sites, initialSiteId, initialIntent }: { sites: { id: string; name: string }[]; initialSiteId?: string; initialIntent?: string }) {
  const [siteId, setSiteId] = useState(initialSiteId ?? sites[0]?.id ?? "");
  const [family, setFamily] = useState<ConnectivityFamilyId>("unknown");
  const [computer, setComputer] = useState<"YES" | "NO" | "UNKNOWN">("UNKNOWN");
  const [result, setResult] = useState<PlanResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestGeneration = useRef(0);
  const effort = useRef({ productActions: 0, technicalActions: 0, installerActions: 0, externalAppActions: 0, startedAt: 0 });
  const [installedOnline, setInstalledOnline] = useState(false);
  const [activeIntent, setActiveIntent] = useState(initialIntent ?? "");
  const [mobileMessage, setMobileMessage] = useState("");
  const connectorFound = useCallback((intentId: string) => { setActiveIntent(intentId); setInstalledOnline(true); }, []);
  const productAction = useCallback(() => { effort.current.productActions++; effort.current.startedAt ||= Date.now(); }, []);
  const installerAction = useCallback(() => { effort.current.installerActions++; effort.current.startedAt ||= Date.now(); }, []);
  const measuredEffort = useCallback(() => ({ product_actions: effort.current.productActions,
    technical_actions: effort.current.technicalActions, installer_actions: effort.current.installerActions,
    external_app_actions: effort.current.externalAppActions,
    elapsed_ms: effort.current.startedAt ? Math.min(7 * 86400000, Date.now() - effort.current.startedAt) : 0,
    support_required: false }), []);
  async function reportFailure(failure: "INSTALLER_UNAVAILABLE" | "ENROLLMENT_EXPIRED" | "CREDENTIALS_INVALID" | "DISCOVERY_FAILED" | "LOCAL_PERMISSION_DENIED" | "UNKNOWN") {
    try {
      const token = readObserverAccessToken(); const currentEffort = measuredEffort();
      await fetch("/api/digital-observer/connection-assessment", { method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "record_failure", observer_site_id: siteId,
          attempt_id: result?.diagnostic_id ?? crypto.randomUUID(), family, computer_available: computer,
          strategy: result?.plan.preferredStrategy ?? null, failure, effort: currentEffort }) });
    } catch { /* Observability must never block camera onboarding or recovery. */ }
  }
  function reset() { requestGeneration.current++; setResult(null); setError(""); setBusy(false); setInstalledOnline(false); setActiveIntent(""); }
  async function assess(nextComputer = computer) {
    effort.current.productActions++;
    effort.current.startedAt ||= Date.now();
    const generation = ++requestGeneration.current;
    setBusy(true); setError(""); setResult(null);
    try {
      const token = readObserverAccessToken();
      const response = await fetch("/api/digital-observer/connection-assessment", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ action: "plan", observer_site_id: siteId, family, computer_available: nextComputer,
          effort: { product_actions: Math.min(1000, effort.current.productActions), technical_actions: 0,
            elapsed_ms: Math.min(7 * 86400000, Date.now() - effort.current.startedAt) } })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error("CONNECTION_PLAN_UNAVAILABLE");
      if (generation === requestGeneration.current) setResult(payload.data);
    } catch {
      if (generation === requestGeneration.current) setError("לא ניתן להשלים את בדיקת החיבור כרגע. בדקו את החיבור לאינטרנט ונסו שוב.");
    } finally { if (generation === requestGeneration.current) setBusy(false); }
  }
  async function mobileDiscovery() {
    productAction(); setBusy(true); setError(""); setMobileMessage("");
    try {
      const token = readObserverAccessToken();
      const headers = { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) };
      const started = await fetch("/api/digital-observer/mobile-camera-setup", { method: "POST", credentials: "same-origin", cache: "no-store", headers,
        body: JSON.stringify({ action: "start", observer_site_id: siteId }) });
      const startBody = await started.json(); if (!started.ok) throw new Error("MOBILE_SETUP_UNAVAILABLE");
      const bridge = (window as typeof window & { DigitalObserverCameraDiscovery?: NativeDiscoveryBridge }).DigitalObserverCameraDiscovery;
      if (!bridge) { setMobileMessage("איתור מקומי בטלפון עדיין אינו זמין בגרסה הזו. אפשר להמשיך לפי שם האפליקציה או היצרן."); return; }
      const receipt = await bridge.discoverLocalCameras({ sessionId: startBody.data.session_id, siteId });
      const submitted = await fetch("/api/digital-observer/mobile-camera-setup", { method: "POST", credentials: "same-origin", cache: "no-store", headers,
        body: JSON.stringify({ action: "submit", observer_site_id: siteId, session_id: startBody.data.session_id, receipt }) });
      const submitBody = await submitted.json(); if (!submitted.ok) throw new Error("MOBILE_DISCOVERY_REJECTED");
      setResult({ plan: submitBody.data.plan, diagnostic_id: startBody.data.session_id, connector_online: false, installer_delivery: "PLATFORM_CHECK_REQUIRED" });
    } catch { void reportFailure("LOCAL_PERMISSION_DENIED"); setError("לא ניתן להשלים חיפוש מקומי בטלפון. אפשר להמשיך לפי שם האפליקציה או היצרן."); }
    finally { setBusy(false); }
  }
  const showDiscovery = installedOnline || (result?.plan.nextAction === "DISCOVER" && result.connector_online);
  return <div className="do-page-stack">
    <section className="do-panel do-form-section" aria-label="הוספת מצלמות">
      <h1>נמצא את המצלמות שלך</h1>
      <p>נשתמש במצלמות שכבר יש לך ונבדוק מהי דרך החיבור המתאימה. לאחר הבדיקה תבחרו אילו מצלמות להפעיל.</p>
      <p>אין צורך במחשב כדי להתחיל. נבדוק תחילה חיבור ללא התקנה; רכיב מקומי יוצע רק אם אין כרגע מסלול מתמשך מתאים בלעדיו.</p>
      {sites.length > 1 ? <label className="do-field"><span>לאיזה בית או עסק להוסיף?</span><select value={siteId} onChange={event => { effort.current = { productActions: 1, technicalActions: 0, installerActions: 0, externalAppActions: 0, startedAt: Date.now() }; reset(); setActiveIntent(""); setSiteId(event.target.value); setComputer("UNKNOWN"); }}>
        {sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}
      </select></label> : null}
      <label className="do-field"><span>באיזו מצלמה או אפליקציה אתם משתמשים?</span><select value={family} onChange={event => { effort.current.productActions++; effort.current.startedAt ||= Date.now(); reset(); setFamily(event.target.value as ConnectivityFamilyId); setComputer("UNKNOWN"); }}>
        {connectivityRegistry.filter(item => item.id !== "generic-onvif").map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <button className="do-button primary" disabled={busy || !siteId} onClick={() => void assess()} type="button">
        {busy ? <LoaderCircle className="do-spin" /> : <Camera />} {busy ? "בודק אפשרויות חיבור…" : "מצא את המצלמות שלי"}
      </button>
      <button className="do-button secondary" disabled={busy || !siteId} onClick={() => void mobileDiscovery()} type="button">חיפוש זמני ברשת הביתית</button>
      {mobileMessage ? <p className="do-help-copy">{mobileMessage}</p> : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
    {result ? <section className="do-panel do-form-section" aria-live="polite">
      <h2>דרך החיבור למצלמות</h2><p>{result.plan.reason}</p>
      {result.plan.nextAction === "ASK_COMPUTER" ? <fieldset><legend>האם יש במקום מחשב Windows או Mac שבדרך כלל נשאר דלוק ומחובר?</legend>
        <button className="do-button secondary" disabled={busy} onClick={() => { setComputer("YES"); void assess("YES"); }}>כן</button>
        <button className="do-button secondary" disabled={busy} onClick={() => { setComputer("NO"); void assess("NO"); }}>לא</button>
      </fieldset> : null}
      {result.plan.nextAction === "IDENTIFY" ? <p>אפשר למצוא את שם היצרן או הדגם באפליקציה שבה המצלמה פועלת או על מדבקת המכשיר, ולבחור אותו למעלה. איתור מקומי דרך הטלפון עדיין אינו זמין בגרסה זו.</p> : null}
      {result.plan.nextAction === "INSTALL_CONNECTOR" ? <p>נדרש רכיב חיבור קטן במחשב שנשאר במקום. ההתקנה והקישור ממשיכים מתוך האשף הזה.</p> : null}
      {result.plan.nextAction === "LOCAL_DEVICE_OPTION" ? <p>למסלול המקומי שנבדק נדרש מכשיר חיבור שנשאר במקום. נבדוק התאמה לפני הזמנת ציוד.</p> : null}
      <p><small>מספר בדיקה: <bdi>{result.diagnostic_id}</bdi></small></p>
      <details><summary>פרטי בדיקת החיבור</summary><p>גרסת הבדיקה: {result.plan.version}; גרסת מאגר היכולות: {result.plan.registryVersion}</p>
        <p>איתור והערכת חיבור אינם אישור שהניטור פעיל.</p>
      </details>
    </section> : null}
    {(result?.plan.nextAction === "INSTALL_CONNECTOR" || (initialIntent && siteId === initialSiteId)) && !installedOnline ? <ConnectorInstallHandoff key={siteId} siteId={siteId} family={family} initialIntent={initialIntent} onOnline={connectorFound} onProductAction={productAction} onInstallerAction={installerAction} onFailure={category => void reportFailure(category)} /> : null}
    {showDiscovery ? <SoftwareConnectorOnboarding key={`${siteId}:${activeIntent}`} siteId={siteId} installIntentId={activeIntent || undefined} onProductAction={productAction} measuredEffort={measuredEffort} onFailure={category => void reportFailure(category)} /> : null}
  </div>;
}
