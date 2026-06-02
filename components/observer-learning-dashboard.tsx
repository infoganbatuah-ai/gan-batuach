"use client";

import { useState } from "react";

type Row = Record<string, any>;

const zoneLabels: Record<string, string> = {
  classroom: "כיתה",
  playground: "חצר משחקים",
  entrance: "כניסה",
  exit: "יציאה",
  sleeping_area: "אזור שינה",
  restricted_area: "אזור מוגבל",
  kitchen: "מטבח",
  staff_only: "צוות בלבד",
  bathroom_entrance: "כניסה לשירותים"
};

const zoneTypes = Object.keys(zoneLabels);

async function postJson(payload: unknown) {
  const response = await fetch("/api/observer-learning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

function scoreTone(score: number) {
  if (score >= 60) return "bad";
  if (score >= 30) return "warn";
  return "good";
}

export function ObserverLearningDashboard({ role, kindergartenId, learningProfile, routine, zones, signals, riskProfile, gardens = [] }: { role: "admin" | "garden"; kindergartenId?: string | null; learningProfile?: Row | null; routine?: Row | null; zones: Row[]; signals: Row[]; riskProfile?: Row | null; gardens?: Row[] }) {
  const [zoneRows, setZoneRows] = useState(zones);
  const [selectedGardenId, setSelectedGardenId] = useState(kindergartenId ?? gardens[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function updateZone(zone: Row, formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      const data = await postJson({
        action: "update_zone",
        zone_id: zone.id,
        name: String(formData.get("name") || zone.name),
        zone_type: String(formData.get("zone_type") || zone.zone_type),
        is_restricted: Boolean(formData.get("is_restricted"))
      });
      setZoneRows((current) => current.map((row) => row.id === data.zone.id ? data.zone : row));
      setMessage("אזור המצלמה נשמר. אין ציור תמונה בשלב זה.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת אזור נכשלה");
    } finally {
      setBusy(false);
    }
  }

  async function saveRoutine(formData: FormData) {
    setBusy(true); setError(null); setMessage(null);
    try {
      await postJson({
        action: "save_routine",
        kindergarten_id: String(formData.get("kindergarten_id") || selectedGardenId),
        opening_start: String(formData.get("opening_start") || ""),
        opening_end: String(formData.get("opening_end") || ""),
        pickup_start: String(formData.get("pickup_start") || ""),
        pickup_end: String(formData.get("pickup_end") || ""),
        nap_start: String(formData.get("nap_start") || ""),
        nap_end: String(formData.get("nap_end") || ""),
        outdoor_start: String(formData.get("outdoor_start") || ""),
        outdoor_end: String(formData.get("outdoor_end") || ""),
        breakfast_time: String(formData.get("breakfast_time") || ""),
        lunch_time: String(formData.get("lunch_time") || "")
      });
      setMessage("שגרת הגן נשמרה כבסיס למידה mock. אין החלטות אוטומטיות.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת שגרה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  const risk = riskProfile ?? {};
  const scores = [
    ["attendance_score", "נוכחות"],
    ["pickup_score", "איסוף"],
    ["safety_score", "בטיחות"],
    ["supervision_score", "השגחה"],
    ["camera_coverage_score", "כיסוי מצלמות"]
  ] as const;
  const routineDefaults = {
    opening_start: routine?.opening_hours?.start ?? "07:30",
    opening_end: routine?.opening_hours?.end ?? "16:30",
    pickup_start: routine?.pickup_windows?.[0]?.start ?? "15:30",
    pickup_end: routine?.pickup_windows?.[0]?.end ?? "16:30",
    nap_start: routine?.nap_time?.start ?? "13:00",
    nap_end: routine?.nap_time?.end ?? "14:30",
    outdoor_start: routine?.outdoor_activity_hours?.[0]?.start ?? "10:00",
    outdoor_end: routine?.outdoor_activity_hours?.[0]?.end ?? "11:00",
    breakfast_time: routine?.meal_times?.[0]?.time ?? "09:00",
    lunch_time: routine?.meal_times?.[1]?.time ?? "12:00"
  };

  return (
    <div className="stack">
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>סטטוס למידה</span><strong>{learningProfile?.learning_status ?? "not_started"}</strong></article>
        <article className="card metric-card"><span>Baseline</span><strong>{learningProfile?.baseline_version ?? "v0_mock"}</strong></article>
        <article className="card metric-card"><span>Confidence</span><strong>{Math.round(Number(learningProfile?.confidence_level ?? 0) * 100)}%</strong></article>
        <article className="card metric-card"><span>Zones</span><strong>{zoneRows.length}</strong></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form className="card form compact-form" action={saveRoutine}>
          <div>
            <p className="eyebrow">Daily routine baseline</p>
            <h2>שגרת יום לגן</h2>
            <p>הגדרה זו משמשת baseline עתידי בלבד. אין זיהוי חריגות ואין החלטות אוטומטיות.</p>
          </div>
          {role === "admin" ? <label>גן<select name="kindergarten_id" value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>{gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>)}</select></label> : <input type="hidden" name="kindergarten_id" value={kindergartenId ?? ""} />}
          <div className="form-grid two">
            <label>פתיחה<input name="opening_start" type="time" defaultValue={routineDefaults.opening_start} /></label>
            <label>סגירה<input name="opening_end" type="time" defaultValue={routineDefaults.opening_end} /></label>
            <label>תחילת איסוף<input name="pickup_start" type="time" defaultValue={routineDefaults.pickup_start} /></label>
            <label>סיום איסוף<input name="pickup_end" type="time" defaultValue={routineDefaults.pickup_end} /></label>
            <label>תחילת שינה<input name="nap_start" type="time" defaultValue={routineDefaults.nap_start} /></label>
            <label>סיום שינה<input name="nap_end" type="time" defaultValue={routineDefaults.nap_end} /></label>
            <label>חצר מתחיל<input name="outdoor_start" type="time" defaultValue={routineDefaults.outdoor_start} /></label>
            <label>חצר מסתיים<input name="outdoor_end" type="time" defaultValue={routineDefaults.outdoor_end} /></label>
            <label>ארוחת בוקר<input name="breakfast_time" type="time" defaultValue={routineDefaults.breakfast_time} /></label>
            <label>ארוחת צהריים<input name="lunch_time" type="time" defaultValue={routineDefaults.lunch_time} /></label>
          </div>
          <button className="button primary" disabled={busy}>שמירת שגרה</button>
        </form>

        <article className="card action-panel">
          <h2>Risk mock בלבד</h2>
          <p>מדדי סיכון הם תשתית mock ל-dashboard בלבד. הם לא מפעילים החלטות ולא מדרגים ילדים.</p>
          <div className="risk-score-grid">
            {scores.map(([key, label]) => {
              const value = Number(risk[key] ?? 0);
              return <div className={`risk-score-card ${scoreTone(value)}`} key={key}><strong>{value}</strong><span>{label}</span><i><b style={{ width: `${value}%` }} /></i></div>;
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>אזורי מצלמות</h2><p>שיוך סוג אזור למצלמה בלבד. אין ציור על תמונה בשלב זה.</p></div>
        {zoneRows.length === 0 ? <div className="empty-state"><strong>אין אזורי מצלמות עדיין</strong><span>לאחר הוספת מצלמות, המערכת תיצור אזורי baseline שניתן לערוך.</span></div> : <div className="procedure-list">{zoneRows.map((zone) => <form className="card procedure-card" key={zone.id} action={(formData) => updateZone(zone, formData)}><div><span className={zone.is_restricted ? "pill warn" : "pill good"}>{zone.is_restricted ? "מוגבל" : "רגיל"}</span><h3>{zone.camera_streams?.name ?? zone.name}</h3><p>{zoneLabels[zone.zone_type] ?? zone.zone_type} · {zone.name}</p><small>Learning baseline only · no child profiling</small></div><div className="procedure-meta"><input name="name" defaultValue={zone.name} /><select name="zone_type" defaultValue={zone.zone_type}>{zoneTypes.map((type) => <option key={type} value={type}>{zoneLabels[type]}</option>)}</select><label><input type="checkbox" name="is_restricted" defaultChecked={zone.is_restricted} /> אזור מוגבל</label><button className="button secondary" disabled={busy}>שמירה</button></div></form>)}</div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Learning signals</h2>
          {signals.length === 0 ? <div className="empty-mini">אין signals עדיין.</div> : signals.slice(0, 12).map((signal) => <div className="list-item" key={signal.id}><div><strong>{signal.signal_type}</strong><span>confidence {Math.round(Number(signal.confidence_level ?? 0) * 100)}% · {signal.baseline_version}</span></div><span className="pill">baseline</span></div>)}
        </article>
        <article className="card action-panel">
          <h2>גבולות פרטיות</h2>
          <div className="risk-list">
            <div>פרופיל למידה <b>שייך לגן</b></div>
            <div>פרופיל ילדים <b>לא נוצר</b></div>
            <div>החלטות אוטומטיות <b>לא פעילות</b></div>
            <div>Review אנושי <b>חובה</b></div>
          </div>
        </article>
      </section>
    </div>
  );
}
