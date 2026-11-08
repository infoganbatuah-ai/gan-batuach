"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { LoaderCircle, Radar } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { expireGuardDiagnostic, runGuardDiagnostic } from "@/lib/domain/digital-observer/guard-diagnostics-client";
import type { GuardDiagnosticRequest, GuardDiagnosticView } from "@/lib/domain/digital-observer/guard-diagnostics-types";

const labels = { ptz: "סיבוב וזום", twoWayAudio: "שמע דו־כיווני", siren: "סירנה", lighting: "תאורה" };
const states = { queued: "הבקשה ממתינה ל־Gateway", running: "בדיקת היכולות מתבצעת", completed: "התקבלה תוצאת בדיקה בלבד", failed: "הבדיקה נכשלה", expired: "תוקף הבדיקה פג — היכולות אינן מאומתות כרגע", blocked: "הבדיקה חסומה", cancelled: "הבדיקה בוטלה" };
type Action = "ptz" | "talk" | "siren" | "lighting";

/** Mount keyed by site + camera: old requests/evidence must not cross navigation. */
export function GuardDiagnosticsPanel({ observerSiteId, cameraSourceId }: { observerSiteId: string; cameraSourceId: string }) {
  return <ScopedGuardDiagnosticsPanel key={JSON.stringify([observerSiteId, cameraSourceId])} observerSiteId={observerSiteId} cameraSourceId={cameraSourceId} />;
}

function ScopedGuardDiagnosticsPanel({ observerSiteId, cameraSourceId }: Parameters<typeof GuardDiagnosticsPanel>[0]) {
  const [view, setView] = useState<GuardDiagnosticView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action>("ptz");
  const controller = useRef<AbortController | null>(null);
  const intent = useRef<{ signature: string; request: GuardDiagnosticRequest } | null>(null);
  const [renderedActionRevision, setRenderedActionRevision] = useState(0);
  const owner = useRef({ active: true, operation: 0, actionRevision: 0, resetBusy: false, view: null as GuardDiagnosticView | null });
  const expiration = useRef<{ id: number; cancel: () => void } | null>(null);
  useLayoutEffect(() => {
    const lifetime = owner.current;
    lifetime.active = true;
    if (lifetime.resetBusy) { lifetime.resetBusy = false; lifetime.view = null; setView(null); setBusy(false); }
    return () => {
      lifetime.active = false;
      lifetime.operation += 1;
      const owned = controller.current;
      lifetime.resetBusy = owned !== null;
      controller.current = null;
      owned?.abort();
      const timer = expiration.current;
      expiration.current = null;
      timer?.cancel();
    };
  }, []);
  useLayoutEffect(() => {
    if (!view || view.state !== "completed") return;
    const lifetime = owner.current;
    if (!lifetime.active || lifetime.view !== view) return;
    const operation = lifetime.operation;
    const revision = lifetime.actionRevision;
    let active = true;
    const timer = window.setTimeout(() => {
      const isCurrent = () => active && lifetime.active && lifetime.operation === operation && lifetime.actionRevision === revision && lifetime.view === view && expiration.current?.id === timer;
      if (!isCurrent()) return;
      const expired = expireGuardDiagnostic(view, Date.now());
      if (!isCurrent()) return;
      expiration.current = null;
      active = false;
      lifetime.view = expired;
      setView(expired);
    }, Math.max(0, Date.parse(view.expires_at) - Date.now()));
    expiration.current = { id: timer, cancel: () => { active = false; window.clearTimeout(timer); } };
    return () => { active = false; window.clearTimeout(timer); if (expiration.current?.id === timer) expiration.current = null; };
  }, [view]);
  const ownsAction = () => owner.current.active && owner.current.actionRevision === renderedActionRevision;
  function publishView(next: GuardDiagnosticView | null) {
    if (owner.current.view !== next) { const timer = expiration.current; expiration.current = null; timer?.cancel(); }
    owner.current.view = next;
    setView(next);
  }
  function changeAction(next: Action) {
    if (!ownsAction() || controller.current || next === action) return;
    owner.current.actionRevision += 1;
    owner.current.operation += 1;
    setRenderedActionRevision(owner.current.actionRevision);
    setAction(next);
    publishView(null);
    setError("");
    setBusy(false);
  }

  async function diagnose(taskKind: GuardDiagnosticRequest["task_kind"]) {
    if (!ownsAction() || controller.current) return;
    const scope = { observer_site_id: observerSiteId, camera_source_id: cameraSourceId };
    // These bounded payloads describe compatibility checks, never commands.
    const payload = action === "ptz" ? { direction: "left", duration_ms: 500 }
      : action === "talk" ? { text: "בדיקת תאימות בלבד" }
      : action === "siren" ? { duration_ms: 3000 } : { enabled: true };
    const body = taskKind === "capability_snapshot" ? { ...scope, task_kind: taskKind }
      : { ...scope, task_kind: taskKind, action, payload };
    const signature = JSON.stringify(body);
    if (intent.current?.signature !== signature) intent.current = { signature, request: { ...body, request_id: crypto.randomUUID() } };
    const submittedIntent = intent.current;
    const abort = new AbortController();
    controller.current = abort;
    const lifetime = owner.current;
    const operation = ++lifetime.operation;
    const ownsOperation = () => lifetime.active && lifetime.operation === operation && lifetime.actionRevision === renderedActionRevision && controller.current === abort;
    const isCurrent = () => ownsOperation() && !abort.signal.aborted;
    setBusy(true); setError(""); publishView(null);
    try {
      if (!isCurrent()) return;
      const result = await runGuardDiagnostic(submittedIntent.request, { signal: abort.signal, token: readObserverAccessToken(), onUpdate: next => { if (isCurrent()) publishView(next); } });
      if (!isCurrent()) return;
      const state = result.state;
      if (!isCurrent()) return;
      // Only terminal responses allow a new intent; lost responses reuse the ID.
      if (!["queued", "running"].includes(state) && intent.current === submittedIntent) intent.current = null;
      if (!isCurrent()) return;
      if (state === "completed" && typeof window !== "undefined") {
        const event = new CustomEvent("observer-camera-capabilities-updated", { detail: { cameraSourceId: scope.camera_source_id } });
        if (isCurrent()) window.dispatchEvent(event);
      }
    } catch (cause) {
      if (isCurrent()) {
        publishView(null);
        if (!isCurrent()) return;
        const nextError = cause instanceof Error && cause.message === "DIAGNOSTIC_LOGIN_REQUIRED" ? "נדרשת התחברות מחדש."
          : cause instanceof Error && cause.message === "DIAGNOSTIC_FORBIDDEN" ? "בדיקה זו זמינה למנהל אתר Standard מורשה בלבד."
          : "לא התקבלה תוצאה מאומתת. אפשר לנסות שוב עם אותה בקשה; לא תופעל פעולה פיזית.";
        if (isCurrent()) setError(nextError);
      }
    } finally {
      if (ownsOperation()) { controller.current = null; setBusy(false); }
    }
  }

  return <section className="do-panel do-form-section" aria-label="אבחון מצלמה ללא הפעלה">
    <div className="do-section-head"><div><h2><Radar /> בדיקת יכולות המצלמה</h2><p>בדיקה דרך ה־Gateway עם תיעוד אודיט. אין הזזת מצלמה, הדלקת אור או השמעת קול.</p></div></div>
    <div className="do-button-row"><button className="do-button secondary" type="button" disabled={busy} onClick={() => diagnose("capability_snapshot")}>בדיקת יכולות</button>
      <label>בדיקת תאימות <select value={action} disabled={busy} onChange={event => { if (ownsAction() && !controller.current) changeAction(event.target.value as Action); }}><option value="ptz">סיבוב וזום</option><option value="lighting">תאורה</option><option value="talk">שמע דו־כיווני</option><option value="siren">סירנה</option></select></label>
      <button className="do-button secondary" type="button" disabled={busy} onClick={() => diagnose("command_preflight")}>בדיקת תאימות בלבד</button></div>
    <div role="status" aria-live="polite">{busy ? <LoaderCircle className="do-spin" /> : null}{view ? states[view.state] : busy ? "שולח בקשת בדיקה…" : "טרם התקבלה בדיקה תקפה"}</div>
    {view?.state === "completed" && view.capabilities ? <div className="do-summary-list">{(Object.keys(labels) as Array<keyof typeof labels>).map(key => <div key={key}><strong>{labels[key]}</strong><small>{view.capabilities![key] ? "דווחה תמיכה — הפעלה חסומה" : "לא אומתה תמיכה"}</small></div>)}</div> : null}
    {view?.state === "completed" && view.action ? <p>{view.supported ? "המתאם דיווח על תאימות. אין בכך אישור להפעלה." : "לא אומתה תאימות לפעולה שנבחרה."}</p> : null}
    {view ? <small>הבקשה תועדה באודיט. תוקף הבדיקה עד {new Date(view.expires_at).toLocaleTimeString("he-IL")}.</small> : null}
    <p className="do-notice info">שליטה פיזית חסומה. בדיקת יכולות אינה אישור ביצוע ואינה הוכחה שהמצלמה ביצעה פעולה.</p>
    {error ? <div role="alert" className="do-action-result error">{error}</div> : null}
  </section>;
}
