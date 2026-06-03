"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, PauseCircle, PlayCircle, Save } from "lucide-react";

type WatchRequest = {
  id: string;
  title: string;
  description?: string | null;
  watch_type: string;
  active: boolean;
  priority: number;
  schedule?: Record<string, unknown> | null;
  created_at?: string | null;
  camera_streams?: { name?: string | null } | null;
  camera_zones?: { name?: string | null; zone_type?: string | null } | null;
  gardens?: { name?: string | null } | null;
  observer_sites?: { name?: string | null; site_type?: string | null } | null;
};

type SelectOption = { id: string; name: string; garden_id?: string | null; observer_site_id?: string | null };

const watchTypeLabels: Record<string, string> = {
  movement_in_area: "תנועה באזור",
  no_movement: "אין תנועה",
  door_left_open: "דלת / שער פתוח",
  person_near_object: "אדם ליד חפץ",
  restricted_area_entry: "כניסה לאזור אסור",
  after_hours_activity: "פעילות אחרי שעות",
  camera_obstruction: "חסימת מצלמה",
  custom_text_instruction: "בקשה מותאמת"
};

export function ObserverWatchRequestsPanel({
  role,
  requests,
  cameras,
  zones,
  gardens,
  observerSites,
  fixedKindergartenId
}: {
  role: "admin" | "garden";
  requests: WatchRequest[];
  cameras: SelectOption[];
  zones: SelectOption[];
  gardens?: SelectOption[];
  observerSites?: SelectOption[];
  fixedKindergartenId?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = requests.filter((request) => request.active).length;
  const disabledCount = requests.filter((request) => !request.active).length;
  const byType = requests.reduce<Record<string, number>>((acc, request) => {
    acc[request.watch_type] = (acc[request.watch_type] ?? 0) + 1;
    return acc;
  }, {});

  async function post(payload: Record<string, unknown>) {
    setMessage(null);
    const response = await fetch("/api/observer-watch-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!response.ok) {
      setMessage(body.error ?? "הפעולה נכשלה");
      return;
    }
    setMessage("הפעולה נשמרה");
    router.refresh();
  }

  function createRequest(formData: FormData) {
    startTransition(() => {
      void post({
        action: "create",
        kindergarten_id: fixedKindergartenId ?? (formData.get("kindergarten_id") || null),
        observer_site_id: formData.get("observer_site_id") || null,
        camera_id: formData.get("camera_id") || null,
        zone_id: formData.get("zone_id") || null,
        title: formData.get("title"),
        description: formData.get("description"),
        watch_type: formData.get("watch_type"),
        priority: formData.get("priority"),
        schedule_mode: formData.get("schedule_mode"),
        notification_channels: ["in_app"]
      });
    });
  }

  function disableRequest(id: string) {
    startTransition(() => void post({ action: "disable", id }));
  }

  function triggerMock(id: string) {
    startTransition(() => void post({ action: "trigger_mock", id }));
  }

  return (
    <div className="stack">
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Eye /><strong>{requests.length}</strong><span>בקשות</span></article>
        <article className="metric-card"><PlayCircle /><strong>{activeCount}</strong><span>פעילות</span></article>
        <article className="metric-card"><PauseCircle /><strong>{disabledCount}</strong><span>מושבתות</span></article>
        <article className="metric-card"><Save /><strong>{Object.keys(byType).length}</strong><span>סוגים</span></article>
      </section>

      {message ? <div className={message.includes("נכשלה") || message.includes("לא ") ? "notice warning" : "notice success"}>{message}</div> : null}

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading">
            <h2>בקשת מעקב חדשה</h2>
            <p>Rule-based/mock בלבד. אין AI אמיתי, אין הודעה להורים, וכל אירוע דורש review.</p>
          </div>
          <form action={createRequest} className="form-grid compact-form">
            {role === "admin" ? (
              <>
                <label className="form-field"><span>גן בטוח</span><select name="kindergarten_id"><option value="">ללא גן</option>{(gardens ?? []).map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</select></label>
                <label className="form-field"><span>Observer site</span><select name="observer_site_id"><option value="">ללא site</option>{(observerSites ?? []).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
              </>
            ) : <input type="hidden" name="kindergarten_id" value={fixedKindergartenId ?? ""} />}
            <label className="form-field"><span>כותרת</span><input name="title" placeholder="שים לב לשער האחורי" required /></label>
            <label className="form-field"><span>סוג בקשה</span><select name="watch_type" defaultValue="after_hours_activity">{Object.entries(watchTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="form-field"><span>מצלמה</span><select name="camera_id"><option value="">כל המצלמות</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</select></label>
            <label className="form-field"><span>אזור</span><select name="zone_id"><option value="">כל האזורים</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
            <label className="form-field"><span>לוח זמנים</span><select name="schedule_mode" defaultValue="always_active"><option value="always_active">תמיד פעיל</option><option value="business_hours">שעות פעילות</option><option value="night_only">לילה בלבד</option><option value="custom_days_hours">ימים/שעות מותאמים</option></select></label>
            <label className="form-field"><span>עדיפות</span><input name="priority" type="number" min="1" max="10" defaultValue="5" /></label>
            <label className="form-field full"><span>פירוט</span><textarea name="description" placeholder="לדוגמה: שים לב אם יש תנועה אחרי 22:00" rows={3} /></label>
            <button className="button primary full" type="submit" disabled={isPending}><Save size={18} /> שמירה</button>
          </form>
        </article>

        <article className="card action-panel">
          <div className="section-heading"><h2>סוגי בקשות</h2><p>התרגום הוא deterministic. טקסט חופשי נשמר לעתיד ולא מפוענח עם AI כרגע.</p></div>
          <div className="risk-list">
            {Object.entries(watchTypeLabels).map(([key, label]) => <div key={key}>{label} <b>{byType[key] ?? 0}</b></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>בקשות קיימות</h2><p>Trigger mock יוצר אירוע shadow מקושר, לא הודעת הורה.</p></div>
        {requests.length === 0 ? <div className="empty-state"><strong>אין בקשות מעקב</strong><span>צרו בקשה ראשונה כדי להכין את התצפיתן לעבודה מותאמת.</span></div> : (
          <div className="procedure-list">
            {requests.map((request) => (
              <article className="card procedure-card" key={request.id}>
                <div>
                  <span className={request.active ? "pill good" : "pill bad"}>{request.active ? "פעילה" : "מושבתת"}</span>
                  <span className="pill">{watchTypeLabels[request.watch_type] ?? request.watch_type}</span>
                  <h3>{request.title}</h3>
                  <p>{request.description || "אין פירוט נוסף"}</p>
                  <small>{request.gardens?.name ?? request.observer_sites?.name ?? "כללי"} · {request.camera_streams?.name ?? "כל המצלמות"} · {request.camera_zones?.name ?? "כל האזורים"}</small>
                </div>
                <div className="procedure-meta">
                  <span>עדיפות {request.priority}</span>
                  <button className="button secondary" type="button" onClick={() => triggerMock(request.id)} disabled={isPending}>Trigger mock</button>
                  {request.active ? <button className="button danger" type="button" onClick={() => disableRequest(request.id)} disabled={isPending}>השבתה</button> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
