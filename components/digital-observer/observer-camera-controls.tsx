"use client";

import {
  AlertTriangle, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp,
  Lightbulb, LightbulbOff, Siren, Volume2, VolumeX, X, ZoomIn, ZoomOut
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./observer-camera-controls.module.css";

type PhysicalAction = "lighting" | "siren" | "ptz";
type DiagnosticsState = "loading" | "online" | "live_capabilities" | "unavailable" | "operator_lock";
type AutomationState = { enabled: boolean; allowedActions: Array<"lighting" | "siren">; sirenDurationMs: number | null };
type PreparedAction = {
  requestId: string;
  confirmationId: string;
  confirmationNonce: string;
  expiresAt: string;
  action: PhysicalAction;
  label: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function liveVideo(cameraSourceId: string) {
  return document.querySelector<HTMLVideoElement>(`video[data-camera-source-id="${CSS.escape(cameraSourceId)}"]`);
}

async function cameraAction(body: Record<string, unknown>) {
  const response = await fetch("/api/digital-observer/camera-actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({})) as { data?: Record<string, unknown>; error?: string };
  if (!response.ok || !payload.data) throw new Error(payload.error || "הפעולה לא הושלמה.");
  return payload.data;
}

export function ObserverCameraControls({
  observerSiteId,
  cameraSourceId,
  name,
  capabilities = {}
}: {
  observerSiteId: string;
  cameraSourceId: string;
  name: string;
  talkSupported?: boolean;
  capabilities?: Record<string, unknown>;
}) {
  const [muted, setMuted] = useState(true);
  const [controls, setControls] = useState<PhysicalAction[]>([]);
  const [prepared, setPrepared] = useState<PreparedAction | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [physicalLocked, setPhysicalLocked] = useState(false);
  const [operatorWarning, setOperatorWarning] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsState>("loading");
  const [automation, setAutomation] = useState<AutomationState>({ enabled: false, allowedActions: [], sirenDurationMs: null });
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const audioSupported = capabilities.audio === true;
  const validSite = UUID.test(observerSiteId);

  const loadControls = useCallback(async () => {
    if (!validSite) {
      setControls([]);
      setPhysicalLocked(true);
      setDiagnostics("unavailable");
      setStatus("שיוך האתר של המצלמה אינו תקין.");
      return;
    }
    try {
      const data = await cameraAction({ action: "controls", camera_source_id: cameraSourceId });
      if (data.observer_site_id !== observerSiteId || data.camera_source_id !== cameraSourceId) {
        throw new Error("Camera control scope mismatch");
      }
      const available = Array.isArray(data.controls)
        ? data.controls.filter((value): value is PhysicalAction => value === "lighting" || value === "siren" || value === "ptz")
        : [];
      const state = data.diagnostics;
      if (state !== "online" && state !== "live_capabilities" && state !== "unavailable" && state !== "operator_lock") {
        throw new Error("Camera diagnostics contract mismatch");
      }
      setControls(available);
      setDiagnostics(state);
      const automationValue = data.digital_guard_automation as Record<string, unknown> | undefined;
      const automationActions = Array.isArray(automationValue?.allowed_actions)
        ? automationValue.allowed_actions.filter((value): value is "lighting" | "siren" => value === "lighting" || value === "siren")
        : [];
      setAutomation({
        enabled: automationValue?.enabled === true,
        allowedActions: automationActions,
        sirenDurationMs: typeof automationValue?.siren_duration_ms === "number" ? automationValue.siren_duration_ms : null
      });
      const warning = data.operator_warning === true && data.non_retryable === true;
      setPhysicalLocked(warning);
      setOperatorWarning(warning);
      if (warning) setStatus(typeof data.message === "string" ? data.message : "הבקרים הפיזיים נעולים עד בדיקה ידנית.");
    } catch {
      setControls([]);
      setDiagnostics("unavailable");
      setAutomation({ enabled: false, allowedActions: [], sirenDurationMs: null });
    }
  }, [cameraSourceId, observerSiteId, validSite]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadControls(), 0);
    return () => window.clearTimeout(timer);
  }, [loadControls]);

  useEffect(() => {
    const refresh = (event: Event) => {
      const detail = (event as CustomEvent<{ cameraSourceId?: string }>).detail;
      if (detail?.cameraSourceId === cameraSourceId) void loadControls();
    };
    window.addEventListener("observer-camera-capabilities-updated", refresh);
    return () => window.removeEventListener("observer-camera-capabilities-updated", refresh);
  }, [cameraSourceId, loadControls]);

  useEffect(() => {
    if (!prepared) return;
    const update = () => {
      const seconds = Math.max(0, Math.ceil((Date.parse(prepared.expiresAt) - Date.now()) / 1_000));
      setRemainingSeconds(seconds);
      if (seconds === 0) {
        setPrepared(null);
        setStatus("תוקף האישור פג. לא בוצעה פעולה.");
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [prepared]);

  const controlSet = useMemo(() => new Set(controls), [controls]);

  function toggleAudio() {
    if (!audioSupported) return;
    const video = liveVideo(cameraSourceId);
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function snapshot() {
    const video = liveVideo(cameraSourceId);
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${name}-${new Date().toISOString().replaceAll(":", "-")}.jpg`;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1_000);
    }, "image/jpeg", 0.92);
  }

  async function prepare(action: PhysicalAction, payload: Record<string, unknown>, label: string) {
    if (physicalLocked || !validSite) return;
    setBusy(true);
    setOperatorWarning(false);
    setStatus("מכין אישור מאובטח...");
    try {
      const requestId = crypto.randomUUID();
      const data = await cameraAction({
        action: "prepare",
        request_id: requestId,
        camera_source_id: cameraSourceId,
        camera_action: action,
        payload
      });
      if (data.request_id !== requestId || data.observer_site_id !== observerSiteId
        || data.camera_source_id !== cameraSourceId || typeof data.confirmation_id !== "string"
        || data.confirmation_id === requestId || typeof data.confirmation_nonce !== "string" || typeof data.expires_at !== "string") {
        throw new Error("השרת החזיר אישור לא תקין.");
      }
      setPrepared({ requestId, confirmationId: data.confirmation_id, confirmationNonce: data.confirmation_nonce,
        expiresAt: data.expires_at, action, label });
      setStatus("");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "הפעולה לא הוכנה.");
    } finally {
      setBusy(false);
    }
  }

  async function monitorResult(requestId: string) {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const data = await cameraAction({ action: "status", request_id: requestId });
      if (data.request_id !== requestId || data.observer_site_id !== observerSiteId) {
        throw new Error("סטטוס השרת אינו תואם לבקשה.");
      }
      if (data.terminal === true) {
        const warning = data.operator_warning === true && data.non_retryable === true;
        setOperatorWarning(warning);
        setPhysicalLocked(warning);
        setStatus(typeof data.message === "string" ? data.message : warning
          ? "מצב הפעולה אינו ודאי. אין לשלוח אותה שוב עד בדיקה ידנית."
          : "הפעולה הסתיימה.");
        if (!warning) await loadControls();
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_000));
    }
    setOperatorWarning(true);
    setPhysicalLocked(true);
    setStatus("לא התקבל מצב סופי בזמן. אין לשלוח את הפעולה שוב עד בדיקה ידנית.");
  }

  async function confirm() {
    if (!prepared || remainingSeconds <= 0) return;
    setBusy(true);
    try {
      const data = await cameraAction({
        action: "confirm",
        request_id: prepared.requestId,
        confirmation_id: prepared.confirmationId,
        confirmation_nonce: prepared.confirmationNonce
      });
      if (data.request_id !== prepared.requestId || data.observer_site_id !== observerSiteId || data.executed !== false) {
        throw new Error("אישור השרת אינו תואם לבקשה.");
      }
      const requestId = prepared.requestId;
      setPrepared(null);
      setStatus("הפעולה אושרה ונמסרה פעם אחת. ממתין לאימות מצב, ללא שליחה חוזרת.");
      await monitorResult(requestId);
    } catch (error) {
      setPrepared(null);
      setOperatorWarning(true);
      setPhysicalLocked(true);
      setStatus(error instanceof Error ? `${error.message} אין לשלוח את הפעולה שוב עד בדיקה ידנית.` : "לא ניתן לאמת את המצב. אין לשלוח שוב.");
    } finally {
      setBusy(false);
    }
  }

  const physicalDisabled = busy || physicalLocked;
  const diagnosticsLabel: Record<DiagnosticsState, string> = {
    loading: "טוען מצב חיבור ויכולות...",
    online: "המצלמה מחוברת; יכולות חיות אינן זמינות כעת.",
    live_capabilities: "המצלמה מחוברת ויכולות חיות אומתו.",
    unavailable: "מצב החיבור או היכולות אינו זמין.",
    operator_lock: "הבקרים נעולים עד בדיקה ידנית של תוצאת הפעולה האחרונה."
  };

  return <>
    <section className={`${styles.diagnostics} ${diagnostics === "operator_lock" ? styles.diagnosticsWarning : ""}`} aria-live="polite" aria-label="אבחון חיבור ויכולות">
      <strong>אבחון חיבור ויכולות</strong>
      <span>{diagnosticsLabel[diagnostics]}</span>
    </section>
    <section className={styles.automation} aria-live="polite" aria-label="מצב פעולות התצפיתן הדיגיטלי">
      <strong>{automation.enabled ? "פעולות תצפיתן פעילות" : "פעולות תצפיתן אינן פעילות"}</strong>
      <span>{automation.enabled
        ? `מורשות רק באירוע מאומת: ${automation.allowedActions.map((action) => action === "lighting" ? "תאורה" : "סירנה").join(" ו")}${automation.allowedActions.includes("siren") ? ` של ${Math.round((automation.sirenDurationMs ?? 0) / 100) / 10} שנייה` : ""}.`
        : "לא קיימת מדיניות אוטונומית פעילה למצלמה זו."}</span>
    </section>
    <div className="do-camera-live-controls" aria-label="פעולות צפייה חיה">
      <button type="button" onClick={toggleAudio} disabled={!audioSupported || busy} title={audioSupported ? (muted ? "הפעלת שמע מהמצלמה" : "השתקת שמע מהמצלמה") : "שמע אינו נתמך במצלמה זו"}>
        {muted ? <VolumeX /> : <Volume2 />}<strong>שמע</strong><small>{audioSupported ? (muted ? "מושתק" : "פעיל") : "לא נתמך"}</small>
      </button>
      <button type="button" onClick={snapshot} disabled={busy} title="שמירת תמונה מהשידור החי">
        <Camera /><strong>צילום</strong><small>שמירה במכשיר</small>
      </button>
      {controlSet.has("lighting") ? <>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("lighting", { enabled: true }, "הדלקת תאורה")} title="הדלקת תאורת המצלמה"><Lightbulb /><strong>הדלקה</strong><small>דורש אישור</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("lighting", { enabled: false }, "כיבוי תאורה")} title="כיבוי תאורת המצלמה"><LightbulbOff /><strong>כיבוי</strong><small>דורש אישור</small></button>
      </> : null}
      {controlSet.has("siren") ? <button type="button" disabled={physicalDisabled} onClick={() => void prepare("siren", { enabled: true, duration_ms: 1_000 }, "הפעלת סירנה לשנייה אחת")} title="הפעלת סירנה קצרה"><Siren /><strong>סירנה</strong><small>שנייה אחת, באישור</small></button> : null}
      {controlSet.has("ptz") ? <div className={styles.ptzGroup} role="group" aria-label="הזזת מצלמה">
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_Up", duration_ms: 150, speed: 35 }, "הזזת המצלמה למעלה")} title="למעלה"><ChevronUp /><strong>למעלה</strong><small>פעימה קצרה</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_Down", duration_ms: 150, speed: 35 }, "הזזת המצלמה למטה")} title="למטה"><ChevronDown /><strong>למטה</strong><small>פעימה קצרה</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_Right", duration_ms: 150, speed: 35 }, "הזזת המצלמה ימינה")} title="ימינה"><ChevronRight /><strong>ימינה</strong><small>פעימה קצרה</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_Left", duration_ms: 150, speed: 35 }, "הזזת המצלמה שמאלה")} title="שמאלה"><ChevronLeft /><strong>שמאלה</strong><small>פעימה קצרה</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_ZoomAdd", duration_ms: 100, speed: 25 }, "התקרבות המצלמה")} title="התקרבות"><ZoomIn /><strong>התקרבות</strong><small>פעימה קצרה</small></button>
        <button type="button" disabled={physicalDisabled} onClick={() => void prepare("ptz", { command: "Ptz_Cmd_ZoomMinus", duration_ms: 100, speed: 25 }, "התרחקות המצלמה")} title="התרחקות"><ZoomOut /><strong>התרחקות</strong><small>פעימה קצרה</small></button>
      </div> : null}
      <p className={`${styles.status} ${operatorWarning ? styles.warning : ""}`} role={operatorWarning ? "alert" : undefined} aria-live="polite">
        {operatorWarning ? <AlertTriangle aria-hidden="true" /> : null}{status}
      </p>
    </div>

    {prepared ? <div className={styles.confirmationBackdrop} role="presentation">
      <section className={styles.confirmationDialog} role="alertdialog" aria-modal="true" aria-labelledby="camera-confirmation-title" aria-describedby="camera-confirmation-description">
        <h2 id="camera-confirmation-title">אישור פעולה במצלמה</h2>
        <p id="camera-confirmation-description"><strong>{prepared.label}</strong> במצלמה <strong>{name}</strong>.</p>
        <p>האישור תקף לפעולה הזו בלבד ולא יישמר לפעולות עתידיות.</p>
        <p className={styles.confirmationExpiry}>האישור יפוג בעוד {remainingSeconds} שניות.</p>
        <div className={styles.confirmationActions}>
          <button type="button" onClick={() => { setPrepared(null); setStatus("הפעולה בוטלה ולא נמסרה לביצוע."); }} disabled={busy}><X />ביטול</button>
          <button type="button" onClick={() => void confirm()} disabled={busy || remainingSeconds <= 0}><Check />אישור עכשיו</button>
        </div>
      </section>
    </div> : null}
  </>;
}
