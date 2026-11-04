"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";

type Row = Record<string, any>;
type Availability = { gardens: boolean; learningProfiles: boolean; routines: boolean; zones: boolean; signals: boolean; risks: boolean };
type Context = { identity: string; generation: number };
type Feedback = { context: Context; busy: boolean; message: string | null; error: string | null };

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

export function ObserverLearningDashboard({ role, kindergartenId, learningProfile, routine, zones, signals, riskProfile, gardens = [], learningProfiles = [], routines = [], riskProfiles = [], availability }: { role: "admin" | "garden"; kindergartenId?: string | null; learningProfile?: Row | null; routine?: Row | null; zones: Row[]; signals: Row[]; riskProfile?: Row | null; gardens?: Row[]; learningProfiles?: Row[]; routines?: Row[]; riskProfiles?: Row[]; availability?: Availability }) {
  const qualified = role === "admin" && availability !== undefined;
  const gardensAvailable = !qualified || availability.gardens;
  const profileAvailable = !qualified || (availability.learningProfiles && gardensAvailable);
  const routineAvailable = !qualified || (availability.routines && gardensAvailable);
  const riskAvailable = !qualified || (availability.risks && gardensAvailable);
  const zonesAvailable = !qualified || availability.zones;
  const signalsAvailable = !qualified || availability.signals;
  const unavailable = "לא זמין";
  const [gardenId, setSelectedGardenId] = useState(kindergartenId ?? gardens[0]?.id ?? "");
  const selectedGardenId = qualified ? gardensAvailable ? (gardens.some((garden) => garden.id === gardenId) ? gardenId : gardens[0]?.id ?? "") : "" : gardenId;
  if (qualified && gardenId !== selectedGardenId) setSelectedGardenId(selectedGardenId);
  const selectedProfile = qualified ? profileAvailable ? learningProfiles.find((profile) => profile.kindergarten_id === selectedGardenId) : undefined : learningProfile;
  const selectedRoutine = qualified ? routineAvailable ? routines.find((item) => item.kindergarten_id === selectedGardenId) : undefined : routine;
  const selectedRisk = qualified ? riskAvailable ? riskProfiles.find((risk) => risk.kindergarten_id === selectedGardenId) : undefined : riskProfile;
  const routineDefaults = {
    opening_start: selectedRoutine?.opening_hours?.start ?? "07:30",
    opening_end: selectedRoutine?.opening_hours?.end ?? "16:30",
    pickup_start: selectedRoutine?.pickup_windows?.[0]?.start ?? "15:30",
    pickup_end: selectedRoutine?.pickup_windows?.[0]?.end ?? "16:30",
    nap_start: selectedRoutine?.nap_time?.start ?? "13:00",
    nap_end: selectedRoutine?.nap_time?.end ?? "14:30",
    outdoor_start: selectedRoutine?.outdoor_activity_hours?.[0]?.start ?? "10:00",
    outdoor_end: selectedRoutine?.outdoor_activity_hours?.[0]?.end ?? "11:00",
    breakfast_time: selectedRoutine?.meal_times?.[0]?.time ?? "09:00",
    lunch_time: selectedRoutine?.meal_times?.[1]?.time ?? "12:00"
  };
  const canSaveRoutine = !qualified || (routineAvailable && gardensAvailable && gardens.some((garden) => garden.id === selectedGardenId));
  const routineIdentity = qualified ? JSON.stringify([selectedGardenId, routineAvailable, canSaveRoutine, selectedRoutine?.id, selectedRoutine?.kindergarten_id, ...Object.values(routineDefaults)]) : "legacy";
  const zoneIdentity = qualified ? JSON.stringify([zonesAvailable, zonesAvailable ? zones.map((zone) => [zone.id, zone.kindergarten_id, zone.garden_id, zone.camera_id, zone.name, zone.zone_type, zone.is_restricted, zone.camera_streams?.name]) : []]) : "legacy";
  const [routineSnapshot, setRoutineSnapshot] = useState<Context>(() => ({ identity: routineIdentity, generation: 0 }));
  const [zoneSnapshot, setZoneSnapshot] = useState<Context>(() => ({ identity: zoneIdentity, generation: 0 }));
  const currentRoutine = useMemo(() => routineSnapshot.identity === routineIdentity ? routineSnapshot : { identity: routineIdentity, generation: routineSnapshot.generation + 1 }, [routineSnapshot, routineIdentity]);
  const currentZone = useMemo(() => zoneSnapshot.identity === zoneIdentity ? zoneSnapshot : { identity: zoneIdentity, generation: zoneSnapshot.generation + 1 }, [zoneSnapshot, zoneIdentity]);
  if (routineSnapshot.identity !== routineIdentity) setRoutineSnapshot(currentRoutine);
  if (zoneSnapshot.identity !== zoneIdentity) setZoneSnapshot(currentZone);
  const [zoneState, setZoneState] = useState(() => ({ context: currentZone, rows: zonesAvailable ? zones : [] }));
  const currentZoneRows = useMemo(() => zoneState.context === currentZone ? zoneState : { context: currentZone, rows: zonesAvailable ? zones : [] }, [zoneState, currentZone, zonesAvailable, zones]);
  if (zoneState.context !== currentZone) setZoneState(currentZoneRows);
  const zoneRows = currentZoneRows.rows;
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [zoneFeedback, setZoneFeedback] = useState<Feedback>(() => ({ context: currentZone, busy: false, message: null, error: null }));
  const [routineFeedback, setRoutineFeedback] = useState<Feedback>(() => ({ context: currentRoutine, busy: false, message: null, error: null }));
  const currentZoneFeedback = zoneFeedback.context === currentZone ? zoneFeedback : { context: currentZone, busy: false, message: null, error: null };
  const currentRoutineFeedback = routineFeedback.context === currentRoutine ? routineFeedback : { context: currentRoutine, busy: false, message: null, error: null };
  const liveZone = useRef<Context | null>(null);
  const liveRoutine = useRef<Context | null>(null);
  const liveZoneRows = useRef<typeof currentZoneRows | null>(null);
  const zoneSequence = useRef(0);
  const routineSequence = useRef(0);
  useLayoutEffect(() => {
    liveZone.current = currentZone; liveZoneRows.current = currentZoneRows;
    return () => { if (liveZone.current === currentZone) { liveZone.current = null; liveZoneRows.current = null; } };
  }, [currentZone, currentZoneRows]);
  useLayoutEffect(() => {
    liveRoutine.current = currentRoutine;
    return () => { if (liveRoutine.current === currentRoutine) liveRoutine.current = null; };
  }, [currentRoutine]);
  function zoneCurrent(id: string) {
    return !qualified || (zonesAvailable && liveZone.current === currentZone && liveZoneRows.current === currentZoneRows && zoneRows.some((zone) => zone.id === id));
  }
  function routineCurrent() {
    return !qualified || (canSaveRoutine && liveRoutine.current === currentRoutine);
  }
  function feedback(kind: "zone" | "routine", current: () => boolean, patch: Partial<Omit<Feedback, "context">>) {
    if (qualified) {
      const setter = kind === "zone" ? setZoneFeedback : setRoutineFeedback;
      const context = kind === "zone" ? currentZone : currentRoutine;
      setter((previous) => current() ? { ...previous, context, ...patch } : previous);
    } else {
      if (patch.busy !== undefined) setBusy(patch.busy);
      if (patch.message !== undefined) setMessage(patch.message);
      if (patch.error !== undefined) setError(patch.error);
    }
  }

  async function updateZone(zone: Row, formData: FormData) {
    if (!zoneCurrent(zone.id)) return;
    const payload = {
      action: "update_zone",
      zone_id: zone.id,
      name: String(formData.get("name") || zone.name),
      zone_type: String(formData.get("zone_type") || zone.zone_type),
      is_restricted: Boolean(formData.get("is_restricted"))
    };
    if (!zoneCurrent(zone.id)) return;
    const token = ++zoneSequence.current;
    const current = () => !qualified || (liveZone.current === currentZone && zoneSequence.current === token);
    feedback("zone", current, { busy: true, error: null, message: null });
    try {
      const data = await postJson(payload);
      if (!current()) return;
      if (qualified && data?.zone?.id !== zone.id) throw new Error("שמירת אזור נכשלה");
      setZoneState((previous) => current() && previous.context === currentZone ? { ...previous, rows: previous.rows.map((row) => row.id === data.zone.id ? data.zone : row) } : previous);
      feedback("zone", current, { message: "אזור המצלמה נשמר. אין ציור תמונה בשלב זה." });
    } catch (err) {
      feedback("zone", current, { error: err instanceof Error ? err.message : "שמירת אזור נכשלה" });
    } finally {
      feedback("zone", current, { busy: false });
    }
  }

  async function saveRoutine(formData: FormData) {
    if (!routineCurrent()) return;
    const target = String(formData.get("kindergarten_id") || selectedGardenId);
    if (qualified && target !== selectedGardenId) return;
    const payload = {
      action: "save_routine",
      kindergarten_id: target,
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
    };
    if (!routineCurrent()) return;
    const token = ++routineSequence.current;
    const current = () => !qualified || (liveRoutine.current === currentRoutine && routineSequence.current === token);
    feedback("routine", current, { busy: true, error: null, message: null });
    try {
      await postJson(payload);
      feedback("routine", current, { message: "שגרת הגן נשמרה כבסיס למידה mock. אין החלטות אוטומטיות." });
    } catch (err) {
      feedback("routine", current, { error: err instanceof Error ? err.message : "שמירת שגרה נכשלה" });
    } finally {
      feedback("routine", current, { busy: false });
    }
  }

  const risk = selectedRisk ?? {};
  const scores = [
    ["attendance_score", "נוכחות"],
    ["pickup_score", "איסוף"],
    ["safety_score", "בטיחות"],
    ["supervision_score", "השגחה"],
    ["camera_coverage_score", "כיסוי מצלמות"]
  ] as const;

  return (
    <div className="stack">
      {qualified ? <>
        {currentZoneFeedback.message ? <div className="success-banner">{currentZoneFeedback.message}</div> : null}
        {currentRoutineFeedback.message ? <div className="success-banner">{currentRoutineFeedback.message}</div> : null}
        {currentZoneFeedback.error ? <div className="error-banner">{currentZoneFeedback.error}</div> : null}
        {currentRoutineFeedback.error ? <div className="error-banner">{currentRoutineFeedback.error}</div> : null}
      </> : <>
        {message ? <div className="success-banner">{message}</div> : null}
        {error ? <div className="error-banner">{error}</div> : null}
      </>}
      <section className="grid cols-4 dashboard-panels">
        <article className="card metric-card"><span>סטטוס למידה</span><strong>{profileAvailable ? selectedProfile?.learning_status ?? "not_started" : unavailable}</strong></article>
        <article className="card metric-card"><span>Baseline</span><strong>{profileAvailable ? selectedProfile?.baseline_version ?? "v0_mock" : unavailable}</strong></article>
        <article className="card metric-card"><span>Confidence</span><strong>{profileAvailable ? `${Math.round(Number(selectedProfile?.confidence_level ?? 0) * 100)}%` : unavailable}</strong></article>
        <article className="card metric-card"><span>Zones</span><strong>{zonesAvailable ? zoneRows.length : unavailable}</strong></article>
      </section>

      <section className="grid cols-2 dashboard-panels">
        <form key={qualified ? currentRoutine.generation : undefined} className="card form compact-form" action={saveRoutine}>
          <div>
            <p className="eyebrow">Daily routine baseline</p>
            <h2>שגרת יום לגן</h2>
            <p>הגדרה זו משמשת baseline עתידי בלבד. אין זיהוי חריגות ואין החלטות אוטומטיות.</p>
          </div>
          {role === "admin" ? <label>גן<select name="kindergarten_id" disabled={qualified && (!gardensAvailable || gardens.length === 0)} value={selectedGardenId} onChange={(event) => setSelectedGardenId(event.target.value)}>{gardensAvailable ? gardens.map((garden) => <option value={garden.id} key={garden.id}>{garden.name}</option>) : null}</select>{!gardensAvailable ? <span>אפשרויות הגן אינן זמינות</span> : null}</label> : <input type="hidden" name="kindergarten_id" value={kindergartenId ?? ""} />}
          {!routineAvailable ? <div className="empty-state">נתוני שגרת האתר אינם זמינים</div> : <div className="form-grid two">
            <label>פתיחה<input name="opening_start" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.opening_start} /></label>
            <label>סגירה<input name="opening_end" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.opening_end} /></label>
            <label>תחילת איסוף<input name="pickup_start" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.pickup_start} /></label>
            <label>סיום איסוף<input name="pickup_end" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.pickup_end} /></label>
            <label>תחילת שינה<input name="nap_start" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.nap_start} /></label>
            <label>סיום שינה<input name="nap_end" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.nap_end} /></label>
            <label>חצר מתחיל<input name="outdoor_start" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.outdoor_start} /></label>
            <label>חצר מסתיים<input name="outdoor_end" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.outdoor_end} /></label>
            <label>ארוחת בוקר<input name="breakfast_time" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.breakfast_time} /></label>
            <label>ארוחת צהריים<input name="lunch_time" type="time" disabled={qualified && !canSaveRoutine} defaultValue={routineDefaults.lunch_time} /></label>
          </div>}
          <button className="button primary" disabled={(qualified ? currentRoutineFeedback.busy : busy) || !canSaveRoutine}>שמירת שגרה</button>
        </form>

        <article className="card action-panel">
          <h2>Risk mock בלבד</h2>
          <p>מדדי סיכון הם תשתית mock ל-dashboard בלבד. הם לא מפעילים החלטות ולא מדרגים ילדים.</p>
          <div className="risk-score-grid">
            {scores.map(([key, label]) => {
              const value = Number(risk[key] ?? 0);
              return <div className={`risk-score-card ${riskAvailable ? scoreTone(value) : "default"}`} key={key}><strong>{riskAvailable ? value : unavailable}</strong><span>{label}</span>{riskAvailable ? <i><b style={{ width: `${value}%` }} /></i> : null}</div>;
            })}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>אזורי מצלמות</h2><p>שיוך סוג אזור למצלמה בלבד. אין ציור על תמונה בשלב זה.</p></div>
        {!zonesAvailable ? <div className="empty-state"><strong>נתוני אזורי המצלמות אינם זמינים</strong></div> : zoneRows.length === 0 ? <div className="empty-state"><strong>אין אזורי מצלמות עדיין</strong><span>לאחר הוספת מצלמות, המערכת תיצור אזורי baseline שניתן לערוך.</span></div> : <div className="procedure-list">{zoneRows.map((zone) => <form className="card procedure-card" key={qualified ? JSON.stringify([currentZone.generation, zone.id, zone.name, zone.zone_type, zone.is_restricted, zone.camera_streams?.name]) : zone.id} action={(formData) => updateZone(zone, formData)}><div><span className={zone.is_restricted ? "pill warn" : "pill good"}>{zone.is_restricted ? "מוגבל" : "רגיל"}</span><h3>{zone.camera_streams?.name ?? zone.name}</h3><p>{zoneLabels[zone.zone_type] ?? zone.zone_type} · {zone.name}</p><small>Learning baseline only · no child profiling</small></div><div className="procedure-meta"><input name="name" defaultValue={zone.name} /><select name="zone_type" defaultValue={zone.zone_type}>{zoneTypes.map((type) => <option key={type} value={type}>{zoneLabels[type]}</option>)}</select><label><input type="checkbox" name="is_restricted" defaultChecked={zone.is_restricted} /> אזור מוגבל</label><button className="button secondary" disabled={qualified ? currentZoneFeedback.busy : busy}>שמירה</button></div></form>)}</div>}
      </section>

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <h2>Learning signals</h2>
          {!signalsAvailable ? <div className="empty-mini">נתוני Learning signals אינם זמינים</div> : signals.length === 0 ? <div className="empty-mini">אין signals עדיין.</div> : signals.slice(0, 12).map((signal) => <div className="list-item" key={signal.id}><div><strong>{signal.signal_type}</strong><span>confidence {Math.round(Number(signal.confidence_level ?? 0) * 100)}% · {signal.baseline_version}</span></div><span className="pill">baseline</span></div>)}
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
