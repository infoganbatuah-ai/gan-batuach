"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";
import { CameraPlaybackCard } from "@/components/camera-playback-card";
import { summarizeCameraHealth } from "@/lib/domain/camera-health";

type Garden = { id: string; name: string; city?: string | null };
type CameraRow = Record<string, any>;
type AiEvent = Record<string, any>;
type Rule = Record<string, any>;
const systemTypeLabels: Record<string, string> = {
  dvr: "DVR",
  nvr: "NVR",
  dvr_nvr: "מערכת מצלמות DVR / NVR",
  ip_camera: "מצלמת IP",
  rtsp: "RTSP",
  onvif: "מצלמת ONVIF",
  hikvision: "Hikvision",
  dahua: "Dahua",
  uniview: "Uniview",
  axis: "Axis",
  generic_camera: "מצלמה כללית",
  manual_rtsp: "חיבור ידני",
  sample_hls: "בדיקת Sample HLS"
};
type CameraSetupFlow = "dvr_nvr" | "ip_camera" | "manual_rtsp" | "onvif" | "home_test";
const cameraFlowOptions: Array<{ value: CameraSetupFlow; title: string; text: string }> = [
  { value: "dvr_nvr", title: "DVR / NVR", text: "מערכת מרכזית שמחוברים אליה כמה ערוצים." },
  { value: "ip_camera", title: "מצלמת IP", text: "מצלמה שמחוברת ישירות לרשת." },
  { value: "manual_rtsp", title: "RTSP ידני", text: "כתובת שידור מלאה מטכנאי או מספק המצלמות." },
  { value: "onvif", title: "ONVIF", text: "תקן שמאפשר לגלות מצלמות ולבדוק יכולות." },
  { value: "home_test", title: "בדיקת בית", text: "מצלמה פרטית לבדיקה בלבד, לא נתוני גן." }
] as const;
const cameraBrandOptions = [
  ["hikvision", "Hikvision"],
  ["dahua", "Dahua"],
  ["uniview", "Uniview"],
  ["axis", "Axis"],
  ["generic_camera", "Generic"]
] as const;
const testSiteOptions = [
  ["", "גן פעיל"],
  ["home_test", "בדיקת בית"],
  ["business_test", "בדיקת עסק"],
  ["kindergarten_test", "בדיקת גן ניסיון"]
] as const;
function sourceTypeFor(systemType: string) {
  if (systemType === "sample_hls") return "Sample HLS";
  if (systemType === "onvif") return "ONVIF";
  if (systemType === "ip_camera") return "IP Camera";
  if (systemType === "dvr") return "DVR";
  if (systemType === "nvr") return "NVR";
  if (["hikvision", "dahua", "uniview", "axis"].includes(systemType)) return systemTypeLabels[systemType];
  return "RTSP";
}
async function postJson(url: string, payload: unknown, method = "POST") {
  const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function CameraAdminManager({
  cameras,
  gardens,
  gatewayConnected,
  defaultOpenAdd = false,
  showHealthCenter = true
}: {
  cameras: CameraRow[];
  gardens: Garden[];
  gatewayConnected: boolean;
  defaultOpenAdd?: boolean;
  showHealthCenter?: boolean;
}) {
  const [rows, setRows] = useState(cameras);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [setupFlow, setSetupFlow] = useState<CameraSetupFlow>("dvr_nvr");
  useEffect(() => setRows(cameras), [cameras]);
  async function refreshRows() {
    const freshRows = await postJson("/api/camera-streams?limit=200", undefined, "GET");
    setRows(Array.isArray(freshRows) ? freshRows : []);
  }
  async function cameraAction(camera: CameraRow, action: string) {
    try {
      setError(null); setMessage(null);
      const data = await postJson(`/api/camera-streams/${camera.id}/status`, { action });
      setRows((current) => current.map((row) => row.id === camera.id ? { ...row, ...(data.camera ?? {}) } : row));
      setMessage(data.message ?? "סטטוס המצלמה עודכן");
    } catch (err) {
      setError(err instanceof Error ? err.message : "פעולת מצלמה נכשלה");
    }
  }
  async function save(event: FormEvent<HTMLFormElement>, close?: () => void) {
    event.preventDefault(); setError(null); setMessage(null);
    const form = event.currentTarget; const data = Object.fromEntries(new FormData(form).entries());
    try {
      const systemType = String(data.system_type || "dvr_nvr");
      const sourceType = sourceTypeFor(systemType);
      const sampleHlsUrl = String(data.hls_playback_url || "");
      const channel = data.connection_channel ? Number(data.connection_channel) : undefined;
      const parentAllowed = Boolean(data.parent_view_allowed);
      await postJson("/api/camera-streams", { garden_id: String(data.garden_id), kindergarten_id: String(data.garden_id), name: String(data.name), area: String(data.area), camera_type: sourceType, source_type: sourceType, source_category: setupFlow === "home_test" ? "home_test" : setupFlow === "manual_rtsp" ? "rtsp_direct" : setupFlow, camera_zone_label: String(data.area), system_type: systemType, deployment_scope: String(data.test_site_type || "kindergarten_production"), test_site_type: String(data.test_site_type || "") || undefined, camera_provider_key: String(data.camera_provider_key || systemType), gateway_provider_preference: String(data.gateway_provider_preference || "custom"), protocol: systemType === "sample_hls" ? "HLS" : systemType === "onvif" ? "ONVIF" : "RTSP", active: true, status: sampleHlsUrl ? "connected" : "pending_gateway", stream_status: sampleHlsUrl ? "connected" : "pending", health_status: sampleHlsUrl ? "healthy" : "pending", connection_method: sampleHlsUrl ? "sample_hls" : "pending_gateway", parent_view_allowed: parentAllowed, parent_viewing_allowed: parentAllowed, parent_visibility_status: parentAllowed ? (sampleHlsUrl ? "allowed" : "pending_gateway") : "blocked", parent_blocked_reason: parentAllowed ? (sampleHlsUrl ? "" : "נדרש חיבור שרת וידאו") : "הגן לא פתח צפייה להורים", staff_view_allowed: Boolean(data.staff_view_allowed), inspector_view_allowed: Boolean(data.inspector_view_allowed), observer_enabled: Boolean(data.observer_enabled), observer_review_required: true, observer_confidence_threshold: data.observer_confidence_threshold ? Number(data.observer_confidence_threshold) : 0.75, host: String(data.connection_host || ""), connection_host: String(data.connection_host || ""), port: data.connection_port ? Number(data.connection_port) : undefined, connection_port: data.connection_port ? Number(data.connection_port) : undefined, username: String(data.username || ""), password: String(data.password || ""), channel: channel ? String(channel) : "", connection_channel: channel, stream_quality: String(data.stream_quality || "sub"), manual_rtsp_url: String(data.manual_rtsp_url || ""), hls_playback_url: sampleHlsUrl, sample_hls_url: sampleHlsUrl, recording_enabled: Boolean(data.recording_enabled), retention_days: data.retention_days ? Number(data.retention_days) : undefined, archive_policy: String(data.archive_policy || ""), viewing_hours: { window: String(data.viewing_hours || "") }, operating_hours: { window: String(data.viewing_hours || "") } });
      await refreshRows(); form.reset(); setMessage(gatewayConnected ? "המצלמה נשמרה ונטענה מחדש מהשרת." : "המצלמה נשמרה במסד הנתונים ונטענה מחדש כממתינה ל-Video Gateway."); close?.();
    } catch (err) { setError(err instanceof Error ? err.message : "שמירת מצלמה נכשלה"); }
  }
  async function testDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setMessage(null);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const result = await postJson("/api/camera-streams/test-connection", {
        garden_id: String(data.garden_id || ""),
        system_type: String(data.system_type || "dvr_nvr"),
        host: String(data.connection_host || ""),
        port: data.connection_port ? Number(data.connection_port) : undefined,
        username: String(data.username || ""),
        password: String(data.password || ""),
        channel: data.connection_channel ? Number(data.connection_channel) : undefined,
        stream_quality: String(data.stream_quality || "sub"),
        manual_rtsp_url: String(data.manual_rtsp_url || ""),
        sample_hls_url: String(data.hls_playback_url || "")
      });
      setMessage(`${result.message} · נבדקו ${result.candidates_tried_count ?? 0} אפשרויות חיבור`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "בדיקת החיבור נכשלה");
    }
  }
  const hasCameras = rows.length > 0;
  const health = summarizeCameraHealth(rows);
  const effectiveSystemType = setupFlow === "home_test" ? "generic_camera" : setupFlow;
  return (
    <>
      <div className={gatewayConnected ? "success-screen" : "gateway-setup-state"}>
        <strong>{gatewayConnected ? "Gateway וידאו מחובר" : "המערכת מוכנה לחיבור, אך נדרש Video Gateway פעיל כדי להציג שידור חי."}</strong>
        <p>פרטי מצלמה נבדקים ונשמרים דרך השרת בלבד. כתובות RTSP, שמות משתמש, סיסמאות ומפתחות Gateway לא מוצגים בדפדפן.</p>
      </div>
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>מחוברות</span><strong>{health.online}</strong></article>
        <article className="card metric-card"><span>דורשות טיפול</span><strong>{health.warning + health.pending}</strong></article>
        <article className="card metric-card"><span>לא מחוברות</span><strong>{health.offline}</strong></article>
        <article className="card metric-card"><span>מושבתות</span><strong>{health.disabled}</strong></article>
      </section>
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <CollapsibleActionPanel title={hasCameras ? "הוספת מצלמה" : "חיבור מצלמה ראשונה"} description="בחרו את סוג החיבור, והטופס יציג רק את הפרטים הרלוונטיים." buttonLabel={hasCameras ? "הוספת מצלמה" : "חיבור מצלמה ראשונה"} defaultOpen={defaultOpenAdd || !hasCameras}>
        {({ close }) => (
          <section className="grid cols-2 dashboard-panels">
            <form className="card form wizard-form camera-connection-wizard" onSubmit={(event) => save(event, close)}>
              <h2>אשף חיבור מצלמה</h2>
              <div className="camera-flow-selector">
                {cameraFlowOptions.map((flow) => (
                  <button className={setupFlow === flow.value ? "selected-choice" : ""} key={flow.value} type="button" onClick={() => setSetupFlow(flow.value)}>
                    <strong>{flow.title}</strong>
                    <span>{flow.text}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" name="system_type" value={effectiveSystemType} />
              <input type="hidden" name="test_site_type" value={setupFlow === "home_test" ? "home_test" : ""} />
              <div className="form-grid">
                <label>גן<select name="garden_id" required><option value="">בחר גן</option>{gardens.map((g) => <option key={g.id} value={g.id}>{g.name} · {g.city}</option>)}</select></label>
                <label>שם מצלמה<input name="name" required placeholder="כניסה ראשית" /></label>
                {setupFlow === "dvr_nvr" ? (
                  <>
                    <label>מותג<select name="camera_provider_key">{cameraBrandOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><small>DVR/NVR הוא מכשיר מרכזי שמרכז כמה מצלמות. בוחרים ערוץ לכל מצלמה.</small></label>
                    <label>כתובת DVR/NVR<input name="connection_host" placeholder="IP או דומיין של המכשיר" /><small>בדרך כלל מופיע במסך ההגדרות של המכשיר או אצל הטכנאי.</small></label>
                    <label>פורט<input name="connection_port" defaultValue="554" /><small>RTSP משתמש לרוב בפורט 554.</small></label>
                    <label>שם משתמש<input name="username" autoComplete="off" /></label>
                    <label>סיסמה<input name="password" type="password" autoComplete="new-password" /></label>
                    <label>מספר ערוץ<input name="connection_channel" type="number" min="1" placeholder="1" /><small>הערוץ הוא מספר המצלמה בתוך ה-DVR/NVR.</small></label>
                    <label>איכות שידור<select name="stream_quality"><option value="sub">רגילה</option><option value="main">גבוהה</option></select></label>
                  </>
                ) : null}
                {setupFlow === "ip_camera" ? (
                  <>
                    <input type="hidden" name="camera_provider_key" value="ip_camera" />
                    <label>כתובת מצלמה<input name="connection_host" placeholder="IP או דומיין של המצלמה" /><small>אפשר למצוא בנתב, באפליקציית היצרן או בעזרת הטכנאי.</small></label>
                    <label>פורט<input name="connection_port" defaultValue="554" /></label>
                    <label>שם משתמש<input name="username" autoComplete="off" /></label>
                    <label>סיסמה<input name="password" type="password" autoComplete="new-password" /></label>
                    <label>תמיכה<select name="camera_provider_key"><option value="ip_camera">RTSP</option><option value="generic_camera">RTSP / ONVIF</option></select><small>RTSP הוא נתיב השידור. ONVIF הוא תקן גילוי ושליטה במצלמות.</small></label>
                    <label>איכות שידור<select name="stream_quality"><option value="sub">רגילה</option><option value="main">גבוהה</option></select></label>
                  </>
                ) : null}
                {setupFlow === "manual_rtsp" ? (
                  <>
                    <input type="hidden" name="camera_provider_key" value="generic_camera" />
                    <label className="wide">כתובת RTSP מלאה<input name="manual_rtsp_url" placeholder="rtsp://..." /><small>RTSP היא כתובת השידור של המצלמה. היא לא תוצג שוב אחרי שמירה.</small></label>
                    <label>שם משתמש נפרד<input name="username" autoComplete="off" /></label>
                    <label>סיסמה נפרדת<input name="password" type="password" autoComplete="new-password" /></label>
                  </>
                ) : null}
                {setupFlow === "onvif" ? (
                  <>
                    <input type="hidden" name="camera_provider_key" value="generic_camera" />
                    <label>כתובת מצלמה<input name="connection_host" placeholder="IP או דומיין" /><small>ONVIF עוזר לגלות מצלמות ויכולות, אבל עדיין צריך Gateway לצפייה חיה.</small></label>
                    <label>פורט<input name="connection_port" placeholder="80 או 8899" /></label>
                    <label>שם משתמש<input name="username" autoComplete="off" /></label>
                    <label>סיסמה<input name="password" type="password" autoComplete="new-password" /></label>
                    <label>מספר ערוץ<input name="connection_channel" type="number" min="1" placeholder="1" /></label>
                  </>
                ) : null}
                {setupFlow === "home_test" ? (
                  <>
                    <input type="hidden" name="camera_provider_key" value="generic_camera" />
                    <label className="wide">מצלמת בדיקה פרטית<div className="gateway-setup-state"><strong>בדיקה בלבד</strong><p>המצלמה חייבת לתמוך ב-RTSP או ONVIF. היא תסומן כ-home_test ולא תתערבב עם נתוני גן פעיל.</p></div></label>
                    <label>כתובת מצלמה<input name="connection_host" placeholder="IP או דומיין פרטי" /></label>
                    <label>פורט<input name="connection_port" defaultValue="554" /></label>
                    <label>שם משתמש<input name="username" autoComplete="off" /></label>
                    <label>סיסמה<input name="password" type="password" autoComplete="new-password" /></label>
                    <label>מספר ערוץ<input name="connection_channel" type="number" min="1" placeholder="1" /></label>
                  </>
                ) : null}
                <label>Gateway<select name="gateway_provider_preference"><option value="mediamtx">MediaMTX</option><option value="go2rtc">go2rtc</option><option value="custom">מותאם</option></select><small>Gateway ממיר RTSP/ONVIF ל-HLS/WebRTC ומייצר צפייה מאובטחת.</small></label>
                <label>אזור בגן<input name="area" required placeholder="כניסה / חצר / כיתה" /></label>
                <label>שעות צפייה<input name="viewing_hours" placeholder="08:00-12:00" /></label>
                <label><input name="recording_enabled" type="checkbox" /> הכנה להקלטה</label>
                <label><input name="parent_view_allowed" type="checkbox" /> צפיית הורים מותרת</label>
                <label><input name="staff_view_allowed" type="checkbox" /> צפיית צוות מותרת</label>
                <label><input name="inspector_view_allowed" type="checkbox" defaultChecked /> צפיית פקח מותרת</label>
                <label><input name="observer_enabled" type="checkbox" /> חיבור לתצפיתן</label>
                <label>סף בדיקה<input name="observer_confidence_threshold" type="number" min="0" max="1" step="0.05" defaultValue="0.75" /></label>
              </div>
              <div className="profile-actions">
                <button className="button secondary" type="button" onClick={(event) => { const form = event.currentTarget.form; if (form) void testDraft({ preventDefault() {}, currentTarget: form } as any); }}>בדיקת חיבור</button>
                <button className="button primary">שמירת מצלמה</button>
                <button className="button secondary" type="button" onClick={close}>ביטול</button>
              </div>
            </form>
            <article className="card action-panel">
              <h2>מדריך קצר</h2>
              <div className="setup-checklist">
                <span>DVR/NVR: קופסה מרכזית עם ערוצים.</span>
                <span>IP: מצלמה עצמאית עם כתובת ברשת.</span>
                <span>RTSP: כתובת השידור הגולמית.</span>
                <span>ONVIF: תקן גילוי ובדיקה.</span>
                <span>Gateway: שכבת שרת שמגינה על השידור.</span>
              </div>
            </article>
          </section>
        )}
      </CollapsibleActionPanel>
      {showHealthCenter ? (
        <section className="dashboard-section">
          <div className="section-heading"><h2>מרכז בריאות מצלמות</h2><p>צפייה עוברת דרך הרשאות ו-Token זמני. פרטי מקור לא מוצגים.</p></div>
          {rows.length === 0 ? <div className="empty-state"><strong>אין מצלמות עדיין</strong><span>לחצו על “חיבור מצלמה ראשונה” כדי להתחיל.</span></div> : <div className="camera-playback-grid">{rows.map((cam) => <div key={cam.id} className="camera-operation-stack"><CameraPlaybackCard camera={cam} /><div className="camera-admin-verification"><span>סוג: {systemTypeLabels[cam.system_type] ?? cam.system_type ?? cam.source_type ?? "מצלמה"}</span><span>בדיקה אחרונה: {cam.last_test_message ?? "טרם נבדקה"}</span><span>Gateway: {cam.gateway_registration_status ?? cam.connection_method ?? "ממתין"}</span><span>בדיקה/ייצור: {cam.test_site_type ?? "גן פעיל"}</span><span>פרטי חיבור: {cam.masked_connection_summary?.password_present ? "סיסמה שמורה ומוצפנת" : "ללא סיסמה שמורה"}</span></div><div className="profile-actions"><button className="button secondary tiny" type="button" onClick={() => cameraAction(cam, "test_connection")}>בדיקת חיבור</button><button className="button secondary tiny" type="button" onClick={() => cameraAction(cam, "register_gateway")}>רישום Gateway</button><button className="button secondary tiny" type="button" onClick={() => cameraAction(cam, cam.active === false ? "enable" : "disable")}>{cam.active === false ? "הפעלה" : "השבתה"}</button><button className="button secondary tiny" type="button" onClick={() => cameraAction(cam, "mark_offline")}>סימון תקלה</button></div></div>)}</div>}
        </section>
      ) : null}
    </>
  );
}

export function AiEventsManager({ events }: { events: AiEvent[] }) {
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState(events);
  const [busyId, setBusyId] = useState<string | null>(null);
  const eventTypes = ["zone anomaly candidate", "fall suspected candidate", "overcrowding candidate", "inactivity candidate", "panic movement candidate", "camera health event", "camera blocked", "camera frozen", "human review required"];
  async function action(event: AiEvent, actionName: string) {
    setBusyId(event.id); setMessage(null);
    const note = ["false_positive", "add_note", "create_task"].includes(actionName) ? window.prompt("הערה") ?? "" : undefined;
    const data = await postJson(`/api/ai-events/${event.id}/action`, { action: actionName, note });
    setRows((current) => current.map((row) => row.id === event.id ? { ...row, ...(data.event ?? {}) } : row));
    setBusyId(null); setMessage("הפעולה נשמרה במסד הנתונים ונרשמה בלוג.");
  }
  return <><section className="filter-bar"><input placeholder="חיפוש אירוע" /><select><option>כל החומרות</option><option>critical</option><option>high</option><option>medium</option></select><select><option>כל הסטטוסים</option><option>open</option><option>done</option></select></section>{message ? <div className="success-banner">{message}</div> : null}<section className="dashboard-section">{rows.length===0?<div className="empty-state"><strong>אין אירועי AI</strong><span>כאשר Gateway/AI יתחברו, אירועים יופיעו כאן. ניהול אירועים קיימים עובד גם בלי Gateway.</span></div>:<div className="procedure-list">{rows.map((event)=><article className="card procedure-card" key={event.id}><div><div className="snapshot-placeholder">snapshot</div><span className="pill bad">{event.severity}</span><h3>{event.event_type}</h3><p>{event.gardens?.name ?? event.garden_id} · {event.camera_streams?.name ?? "מצלמה"} · confidence {event.confidence ?? "-"}</p><small>{event.detected_at ?? ""} · handler {event.handled_by ?? event.assigned_to ?? "לא שויך"}</small></div><div className="procedure-meta"><span className="pill">{event.status ?? "open"}</span><button className="button secondary" disabled={busyId===event.id} onClick={()=>action(event, "handled")}>טופל</button><button className="button secondary" disabled={busyId===event.id} onClick={()=>action(event, "false_positive")}>זיהוי שגוי</button><button className="button secondary" disabled={busyId===event.id} onClick={()=>action(event, "assign_inspector")}>שיוך אלי</button><button className="button secondary" disabled={busyId===event.id} onClick={()=>action(event, "create_task")}>משימה</button><button className="button secondary" disabled={busyId===event.id} onClick={()=>action(event, "add_note")}>הערה</button><Link className="button secondary" href={`/dashboard/admin/kindergartens`}>פרופיל גן</Link><Link className="button secondary" href="/dashboard/admin/cameras">מצלמה</Link></div></article>)}</div>}</section><section className="tag-cloud">{eventTypes.map((type)=><span key={type}>{type}</span>)}</section></>;
}

export function AiObserverConfig({ rules, backendConnected }: { rules: Rule[]; backendConnected: boolean }) {
  const [rows, setRows] = useState(rules);
  const [message, setMessage] = useState<string | null>(null);
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f=event.currentTarget; const d=Object.fromEntries(new FormData(f).entries()); const row=await postJson('/api/ai-observer-rules',{event_type:String(d.event_type),enabled:Boolean(d.enabled),severity:String(d.severity),threshold:Number(d.threshold||0.75),cooldown_seconds:Number(d.cooldown_seconds||60),config:{recipients:String(d.recipients||'admin,inspector'), alert_channels: f.querySelectorAll<HTMLInputElement>('[name="alert_channels"]:checked').length ? Array.from(f.querySelectorAll<HTMLInputElement>('[name="alert_channels"]:checked')).map((i)=>i.value) : ["manager","inspector","admin"], motion_sensitivity:Number(d.motion_sensitivity||0.7), human_review_required:true, parent_visible:false, no_audio:true, no_face_recognition:true, automatic_accusation:false}}); setRows((c)=>[row,...c]); setMessage('הגדרת AI נשמרה'); f.reset(); }
  return <><div className={backendConnected?"success-screen":"gateway-setup-state"}><strong>{backendConnected?"AI backend configured for test only":"AI backend pending connection"}</strong><p>הגדרות נשמרות כ-Shadow Mode בלבד. אין אודיו, אין זיהוי פנים, אין האשמות אוטומטיות ואין הודעות הורים לפני review אנושי.</p></div>{message?<div className="success-banner">{message}</div>:null}<section className="grid cols-2 dashboard-panels"><form className="card form wizard-form" onSubmit={save}><h2>הגדרת חוק AI</h2><div className="form-grid"><label>Event type<select name="event_type"><option value="child_outside_allowed_zone">חריגת אזור לבדיקה</option><option value="fall_detection">חשד לנפילה</option><option value="crowding_detection">צפיפות לבדיקה</option><option value="no_movement">חוסר תנועה לבדיקה</option><option value="panic_movement">תנועה חריגה לבדיקה</option><option value="camera_covered">מצלמה חסומה</option><option value="camera_disconnected">מצלמה מנותקת</option></select></label><label>Severity<select name="severity"><option>low</option><option>medium</option><option>high</option><option>critical</option></select></label><label>Motion sensitivity<input name="motion_sensitivity" type="range" min="0" max="1" step="0.05" defaultValue="0.7" /></label><label>Threshold<input name="threshold" type="number" step="0.05" min="0" max="1" defaultValue="0.75" /></label><label>Cooldown seconds<input name="cooldown_seconds" type="number" defaultValue="120" /></label><label>Recipients<input name="recipients" defaultValue="manager,inspector,admin" /></label><label><input name="alert_channels" value="email" type="checkbox" defaultChecked /> email readiness</label><label><input name="alert_channels" value="push" type="checkbox" defaultChecked /> push readiness</label><label><input name="alert_channels" value="manager" type="checkbox" defaultChecked /> manager</label><label><input name="alert_channels" value="inspector" type="checkbox" defaultChecked /> inspector</label><label><input name="alert_channels" value="admin" type="checkbox" defaultChecked /> admin</label><label><input name="enabled" type="checkbox" defaultChecked /> enabled</label></div><div className="setup-checklist"><span>Audio disabled</span><span>Face recognition disabled</span><span>Human review required</span><span>Parent raw visibility blocked</span></div><button className="button primary">שמירת הגדרה</button></form><article className="card action-panel"><h2>חוקים קיימים</h2>{rows.length===0?<div className="empty-mini">אין חוקים.</div>:rows.map((r)=><div className="list-item" key={r.id ?? r.event_type}><div><strong>{r.event_type}</strong><span>threshold {r.threshold} · cooldown {r.cooldown_seconds}</span></div><span className="pill">{r.severity}</span></div>)}</article></section></>;
}
