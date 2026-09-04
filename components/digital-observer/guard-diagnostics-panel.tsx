"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Radar } from "lucide-react";
import { readObserverAccessToken } from "@/lib/domain/digital-observer/client-session";
import { expireGuardDiagnostic, runGuardDiagnostic } from "@/lib/domain/digital-observer/guard-diagnostics-client";
import type { GuardDiagnosticRequest, GuardDiagnosticView } from "@/lib/domain/digital-observer/guard-diagnostics-types";

const labels = { ptz: "סיבוב וזום", twoWayAudio: "שמע דו־כיווני", siren: "סירנה", lighting: "תאורה" };
const states = { queued: "הבקשה ממתינה ל־Gateway", running: "בדיקת היכולות מתבצעת", completed: "התקבלה תוצאת בדיקה בלבד", failed: "הבדיקה נכשלה", expired: "תוקף הבדיקה פג — היכולות אינן מאומתות כרגע", blocked: "הבדיקה חסומה", cancelled: "הבדיקה בוטלה" };
type Action = "ptz" | "talk" | "siren" | "lighting";

/** Mount keyed by site + camera: old requests/evidence must not cross navigation. */
export function GuardDiagnosticsPanel({ observerSiteId, cameraSourceId }: { observerSiteId: string; cameraSourceId: string }) {
  const [view, setView] = useState<GuardDiagnosticView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [action, setAction] = useState<Action>("ptz");
  const controller = useRef<AbortController | null>(null);
  const intent = useRef<{ signature: string; request: GuardDiagnosticRequest } | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!view || view.state !== "completed") return;
    const timer = window.setTimeout(() => setView(current => current ? expireGuardDiagnostic(current) : null), Math.max(0, Date.parse(view.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [view]);

  async function diagnose(taskKind: GuardDiagnosticRequest["task_kind"]) {
    if (controller.current) return;
    const scope = { observer_site_id: observerSiteId, camera_source_id: cameraSourceId };
    // These bounded payloads describe compatibility checks, never commands.
    const payload = action === "ptz" ? { direction: "left", duration_ms: 500 }
      : action === "talk" ? { text: "בדיקת תאימות בלבד" }
      : action === "siren" ? { duration_ms: 3000 } : { enabled: true };
    const body = taskKind === "capability_snapshot" ? { ...scope, task_kind: taskKind }
      : { ...scope, task_kind: taskKind, action, payload };
    const signature = JSON.stringify(body);
    if (intent.current?.signature !== signature) intent.current = { signature, request: { ...body, request_id: crypto.randomUUID() } };
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true); setError(""); setView(null);
    try {
      const result = await runGuardDiagnostic(intent.current.request, { signal: abort.signal, token: readObserverAccessToken(), onUpdate: setView });
      // Only terminal responses allow a new intent; lost responses reuse the ID.
      if (!["queued", "running"].includes(result.state)) intent.current = null;
      if (result.state === "completed" && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("observer-camera-capabilities-updated", { detail: { cameraSourceId } }));
      }
    } catch (cause) {
      if (!abort.signal.aborted) {
        setView(null);
        setError(cause instanceof Error && cause.message === "DIAGNOSTIC_LOGIN_REQUIRED" ? "נדרשת התחברות מחדש."
          : cause instanceof Error && cause.message === "DIAGNOSTIC_FORBIDDEN" ? "בדיקה זו זמינה למנהל אתר Standard מורשה בלבד."
          : "לא התקבלה תוצאה מאומתת. אפשר לנסות שוב עם אותה בקשה; לא תופעל פעולה פיזית.");
      }
    } finally {
      if (!abort.signal.aborted) { controller.current = null; setBusy(false); }
    }
  }

  return <section className="do-panel do-form-section" aria-label="אבחון מצלמה ללא הפעלה">
    <div className="do-section-head"><div><h2><Radar /> בדיקת יכולות המצלמה</h2><p>בדיקה דרך ה־Gateway עם תיעוד אודיט. אין הזזת מצלמה, הדלקת אור או השמעת קול.</p></div></div>
    <div className="do-button-row"><button className="do-button secondary" type="button" disabled={busy} onClick={() => diagnose("capability_snapshot")}>בדיקת יכולות</button>
      <label>בדיקת תאימות <select value={action} disabled={busy} onChange={event => setAction(event.target.value as Action)}><option value="ptz">סיבוב וזום</option><option value="lighting">תאורה</option><option value="talk">שמע דו־כיווני</option><option value="siren">סירנה</option></select></label>
      <button className="do-button secondary" type="button" disabled={busy} onClick={() => diagnose("command_preflight")}>בדיקת תאימות בלבד</button></div>
    <div role="status" aria-live="polite">{busy ? <LoaderCircle className="do-spin" /> : null}{view ? states[view.state] : busy ? "שולח בקשת בדיקה…" : "טרם התקבלה בדיקה תקפה"}</div>
    {view?.state === "completed" && view.capabilities ? <div className="do-summary-list">{(Object.keys(labels) as Array<keyof typeof labels>).map(key => <div key={key}><strong>{labels[key]}</strong><small>{view.capabilities![key] ? "דווחה תמיכה — הפעלה חסומה" : "לא אומתה תמיכה"}</small></div>)}</div> : null}
    {view?.state === "completed" && view.action ? <p>{view.supported ? "המתאם דיווח על תאימות. אין בכך אישור להפעלה." : "לא אומתה תאימות לפעולה שנבחרה."}</p> : null}
    {view ? <small>הבקשה תועדה באודיט. תוקף הבדיקה עד {new Date(view.expires_at).toLocaleTimeString("he-IL")}.</small> : null}
    <p className="do-notice info">שליטה פיזית חסומה. בדיקת יכולות אינה אישור ביצוע ואינה הוכחה שהמצלמה ביצעה פעולה.</p>
    {error ? <div role="alert" className="do-action-result error">{error}</div> : null}
  </section>;
}
