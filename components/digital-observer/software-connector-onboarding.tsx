"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { AlertTriangle, Camera, Check, LoaderCircle, LockKeyhole, RefreshCw, Router, ShieldCheck, Wifi } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";

type Connector = { gateway_id: string; name: string; status: string; last_seen_at: string | null; version: string | null };
type CameraSource = { id: string; display_name: string; location_label: string | null; source_mode: string; status: string;
  health_status: string; last_seen_at: string | null; active_monitoring: boolean };
type Candidate = { id: string; connector_gateway_id: string; name: string; vendor: string; model: string | null;
  protocols: string[]; credentials_saved: boolean; registration_status: string; camera_source: CameraSource | null };
type ConnectorOnboardingData = { site: { id: string; name: string }; onboarding_session_id: string | null;
  connectors: Connector[]; candidates: Candidate[] };
type Draft = { displayName: string; locationLabel: string; username: string; password: string; editCredentials: boolean };
type Effort = { product_actions: number; technical_actions: number; installer_actions: number; external_app_actions: number;
  elapsed_ms: number; support_required: boolean };

async function api(path: string, init?: RequestInit) {
  const token = readObserverAccessToken();
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin",
    headers: { ...(init?.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "לא ניתן להשלים את הפעולה");
  return body.data;
}
function fresh(timestamp: string | null | undefined) {
  const age = Date.now() - Date.parse(timestamp ?? "");
  return Number.isFinite(age) && age >= 0 && age < 120000;
}
function cameraState(candidate: Candidate, connectorOnline: boolean) {
  if (!connectorOnline) return "רכיב החיבור אינו זמין כרגע";
  if (candidate.camera_source?.active_monitoring && fresh(candidate.camera_source.last_seen_at) && candidate.camera_source.health_status === "healthy") return "ניטור פעיל";
  if (candidate.camera_source?.active_monitoring) return "ניטור מופעל — נדרשת בדיקת עדכניות";
  if (candidate.camera_source?.status === "connected" && candidate.camera_source.health_status === "healthy" && fresh(candidate.camera_source.last_seen_at)) return "מוכנה להפעלה";
  if (candidate.credentials_saved) return "בודקים את החיבור";
  return "נמצאה מצלמה";
}
function initialDraft(candidate: Candidate): Draft {
  return { displayName: candidate.camera_source?.display_name ?? candidate.name,
    locationLabel: candidate.camera_source?.location_label ?? "בית", username: "", password: "", editCredentials: false };
}

export function SoftwareConnectorOnboarding({ siteId, installIntentId, onProductAction, measuredEffort, onFailure }: {
  siteId: string; installIntentId?: string; onProductAction?: () => void; measuredEffort?: () => Effort;
  onFailure?: (category: "CREDENTIALS_INVALID" | "DISCOVERY_FAILED" | "UNKNOWN") => void;
}) {
  const [data, setData] = useState<ConnectorOnboardingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const suffix = installIntentId ? `&install_intent_id=${encodeURIComponent(installIntentId)}` : "";
      const result = await api(`/api/digital-observer/software-connector?observer_site_id=${encodeURIComponent(siteId)}${suffix}`) as ConnectorOnboardingData;
      setData(result);
      setSelectedIds(current => current.filter(id => result.candidates.some(item => item.id === id)));
      setDrafts(current => Object.fromEntries(result.candidates.map(candidate => [candidate.id, current[candidate.id] ?? initialDraft(candidate)])));
      setError("");
      return result;
    } catch (caught) { setError(caught instanceof Error ? caught.message : "לא ניתן לקרוא את מצב החיבור"); }
    finally { if (!quiet) setLoading(false); }
  }, [siteId, installIntentId]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden && !busy) void refresh(true); }, 5000);
    return () => window.clearInterval(timer);
  }, [refresh, busy]);

  const selected = useMemo(() => data?.candidates.filter(candidate => selectedIds.includes(candidate.id)) ?? [], [data, selectedIds]);
  const connector = data?.connectors[0] ?? null;
  const connectorOnline = Boolean(connector && fresh(connector.last_seen_at) && connector.status.toUpperCase() === "HEALTHY");
  const credentialsRequired = selected.filter(candidate => !candidate.credentials_saved || drafts[candidate.id]?.editCredentials);
  const ready = selected.filter(candidate => candidate.camera_source?.status === "connected"
    && candidate.camera_source.health_status === "healthy" && fresh(candidate.camera_source.last_seen_at)
    && !candidate.camera_source.active_monitoring);
  const activeCount = selected.filter(candidate => candidate.camera_source?.active_monitoring).length;

  function toggle(id: string) {
    onProductAction?.(); setMessage(""); setSelectedIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  }
  function changeDraft(id: string, change: Partial<Draft>) {
    const candidate = data?.candidates.find(item => item.id === id);
    if (!candidate) return;
    setDrafts(current => ({ ...current, [id]: { ...(current[id] ?? initialDraft(candidate)), ...change } }));
  }
  async function configureSelected(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!connector || !credentialsRequired.length) return;
    onProductAction?.(); setBusy(true); setError(""); setMessage("");
    try {
      await api("/api/digital-observer/software-connector", { method: "POST", body: JSON.stringify({ action: "configure_batch",
        observer_site_id: siteId, gateway_id: connector.gateway_id, cameras: credentialsRequired.map(candidate => ({
          candidate_id: candidate.id, display_name: drafts[candidate.id].displayName,
          location_label: drafts[candidate.id].locationLabel, username: drafts[candidate.id].username,
          password: drafts[candidate.id].password })) }) });
      setDrafts(current => Object.fromEntries(Object.entries(current).map(([id, draft]) => [id,
        selectedIds.includes(id) ? { ...draft, username: "", password: "", editCredentials: false } : draft])));
      setMessage(`${credentialsRequired.length} מצלמות נשמרו בצורה מוצפנת. רכיב החיבור בודק כעת את הזרמים.`);
      await refresh(true);
    } catch (caught) { onFailure?.("CREDENTIALS_INVALID"); setError(caught instanceof Error ? caught.message : "לא ניתן לשמור את פרטי החיבור"); }
    finally { setBusy(false); }
  }
  async function activateSelected() {
    if (!ready.length) return;
    onProductAction?.(); setBusy(true); setError(""); setMessage("");
    try {
      await api("/api/digital-observer/software-connector", { method: "POST", body: JSON.stringify({ action: "activate_batch",
        observer_site_id: siteId, camera_source_ids: ready.map(candidate => candidate.camera_source!.id),
        effort: measuredEffort?.() }) });
      setMessage(`${ready.length} מצלמות הופעלו בבית הקיים.`); await refresh(true);
    } catch (caught) { onFailure?.("UNKNOWN"); setError(caught instanceof Error ? caught.message : "לא ניתן להפעיל את המצלמות"); }
    finally { setBusy(false); }
  }

  if (loading && !data) return <section className="do-panel do-form-section"><div className="do-action-result loading"><LoaderCircle className="do-spin" /> מחפש מצלמות ברשת המקומית...</div></section>;
  return <section className="do-panel do-form-section" aria-live="polite">
    <div className="do-section-head"><div><h2>{data?.candidates.length ? `מצאנו ${data.candidates.length} מצלמות` : "מחפש מצלמות"}</h2>
      <p>בחרו את המצלמות הרצויות. פרטי הרשת והפרוטוקול נשארים מאחורי הקלעים.</p></div>
      <button className="do-button secondary" type="button" onClick={() => void (async () => { onProductAction?.(); const next = await refresh(); if (!next?.candidates.length) onFailure?.("DISCOVERY_FAILED"); })()} disabled={loading}><RefreshCw className={loading ? "do-spin" : ""} /> נסה שוב</button></div>
    {connector ? <div className={connectorOnline ? "do-connection-check-result" : "do-notice warn"}><span>{connectorOnline ? <Check /> : <AlertTriangle />}</span><div><strong>{connectorOnline ? "רכיב החיבור נמצא" : "רכיב החיבור אינו זמין כרגע"}</strong><small>{connectorOnline ? "החיפוש ממשיך אוטומטית" : "בדקו שהמחשב פועל ומחובר לרשת; המצב יתעדכן אוטומטית."}</small></div></div>
      : <div className="do-notice warn"><AlertTriangle /><span>עדיין לא נמצא רכיב חיבור מאושר לבית הזה.</span></div>}
    {data?.candidates.length ? <>
      <div className="do-button-row"><button type="button" className="do-button secondary" disabled={busy} onClick={() => {
        onProductAction?.(); setSelectedIds(selectedIds.length === data.candidates.length ? [] : data.candidates.map(item => item.id));
      }}>{selectedIds.length === data.candidates.length ? "בטל בחירת הכול" : "בחר הכול"}</button><span>{selectedIds.length} נבחרו</span></div>
      <div className="do-camera-selection-list">{data.candidates.map(candidate => {
        const selectedCamera = selectedIds.includes(candidate.id); const draft = drafts[candidate.id] ?? initialDraft(candidate);
        return <article key={candidate.id} className={selectedCamera ? "do-connection-check-result" : "do-notice info"}>
          <label><input type="checkbox" checked={selectedCamera} disabled={busy} onChange={() => toggle(candidate.id)} /> <Camera /> <strong>{candidate.name}</strong></label>
          <small>{cameraState(candidate, connectorOnline)}</small>
          {selectedCamera ? <div className="do-form-grid"><label className="do-field"><span>שם במערכת</span><input value={draft.displayName} minLength={2} maxLength={100} onChange={event => changeDraft(candidate.id, { displayName: event.target.value })} /></label>
            <label className="do-field"><span>מיקום</span><input value={draft.locationLabel} maxLength={100} onChange={event => changeDraft(candidate.id, { locationLabel: event.target.value })} /></label></div> : null}
          {selectedCamera && candidate.credentials_saved && !draft.editCredentials ? <button type="button" className="do-button secondary" onClick={() => changeDraft(candidate.id, { editCredentials: true })}>עדכון פרטי המצלמה</button> : null}
        </article>;
      })}</div>
    </> : connectorOnline ? <div className="do-notice info"><Router /><span>עדיין לא נמצאו מצלמות. ודאו שהן פועלות באותה רשת; החיפוש ינסה שוב אוטומטית.</span></div> : null}

    {credentialsRequired.length ? <form className="do-connector-credentials-form" onSubmit={configureSelected}>
      <div className="do-connector-credentials-head"><LockKeyhole /><div><h3>פרטי התחברות למצלמות שנבחרו</h3><p>הזינו רק את חשבון המצלמה המקומי כאשר הוא נדרש. הפרטים מוצפנים ואינם מוצגים שוב.</p></div></div>
      {credentialsRequired.map(candidate => <fieldset key={candidate.id}><legend>{drafts[candidate.id]?.displayName || candidate.name}</legend><div className="do-connector-credential-grid">
        <label className="do-connector-credential-field"><span><strong>שם משתמש</strong></span><input value={drafts[candidate.id]?.username ?? ""} onChange={event => changeDraft(candidate.id, { username: event.target.value })} autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} lang="en" maxLength={128} dir="ltr" required /></label>
        <label className="do-connector-credential-field"><span><strong>סיסמת מצלמה</strong></span><input type="password" value={drafts[candidate.id]?.password ?? ""} onChange={event => changeDraft(candidate.id, { password: event.target.value })} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} lang="en" minLength={8} maxLength={256} dir="ltr" required /></label>
      </div></fieldset>)}
      <div className="do-connector-credentials-security"><ShieldCheck /><span>הפרטים נשלחים לכספת המאובטחת; אין כתובות שידור או סיסמאות בדפדפן לאחר השמירה.</span></div>
      <button className="do-button primary" type="submit" disabled={busy || !connectorOnline || credentialsRequired.some(candidate => (drafts[candidate.id]?.username.length ?? 0) < 1 || (drafts[candidate.id]?.password.length ?? 0) < 8)}>{busy ? <LoaderCircle className="do-spin" /> : <Wifi />} בדיקת המצלמות</button>
    </form> : null}
    {ready.length ? <div className="do-notice good"><ShieldCheck /><span>{ready.length} מצלמות עברו בדיקת חיבור עדכנית.</span><button className="do-button primary" type="button" onClick={() => void activateSelected()} disabled={busy}>{busy ? <LoaderCircle className="do-spin" /> : <Check />} הוסף את המצלמות</button></div> : null}
    {activeCount ? <div className="do-notice info"><span>{activeCount} מהמצלמות שנבחרו פעילות בבית.</span><Link className="do-button primary" href={`/digital-observer/cameras?site=${encodeURIComponent(siteId)}`}>למצלמות ולצפייה חיה</Link></div> : null}
    {message ? <div className="do-action-result success"><Check /> {message}</div> : null}
    {error ? <div className="do-action-result error" role="alert"><AlertTriangle /> {error}</div> : null}
  </section>;
}
