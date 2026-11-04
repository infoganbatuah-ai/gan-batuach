"use client";

import { useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
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
  kindergarten_id?: string | null;
  observer_site_id?: string | null;
  camera_id?: string | null;
  zone_id?: string | null;
  camera_streams?: { name?: string | null } | null;
  camera_zones?: { name?: string | null; zone_type?: string | null } | null;
  gardens?: { name?: string | null } | null;
  observer_sites?: { name?: string | null; site_type?: string | null } | null;
};

type SelectOption = { id: string; name: string; garden_id?: string | null; kindergarten_id?: string | null; observer_site_id?: string | null; zone_type?: string | null; site_type?: string | null };
type Availability = { requests: boolean; cameras: boolean; zones: boolean; gardens: boolean; observerSites: boolean; events: boolean };
type Context = { identity: string; generation: number };
type Feedback = { context: Context; message: string | null; busy: boolean };

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
  fixedKindergartenId,
  availability
}: {
  role: "admin" | "garden";
  requests: WatchRequest[];
  cameras: SelectOption[];
  zones: SelectOption[];
  gardens?: SelectOption[];
  observerSites?: SelectOption[];
  fixedKindergartenId?: string | null;
  availability?: Availability;
}) {
  const router = useRouter();
  const qualified = role === "admin" && availability !== undefined;
  const requestsAvailable = !qualified || availability.requests;
  const choicesAvailable = !qualified || (availability.cameras && availability.zones && availability.gardens && availability.observerSites);
  const unavailable = "לא זמין";
  const requestRows = requestsAvailable ? requests : [];
  const optionIdentity = (options: SelectOption[] = []) => options.map((option) => [option.id, option.garden_id ?? null, option.kindergarten_id ?? null, option.observer_site_id ?? null, option.zone_type ?? null, option.site_type ?? null]).sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const formIdentity = qualified ? JSON.stringify([choicesAvailable, fixedKindergartenId ?? null, optionIdentity(cameras), optionIdentity(zones), optionIdentity(gardens), optionIdentity(observerSites)]) : "legacy";
  const [formSnapshot, setFormSnapshot] = useState<Context>(() => ({ identity: formIdentity, generation: 0 }));
  const formContext = useMemo(() => formSnapshot.identity === formIdentity ? formSnapshot : { identity: formIdentity, generation: formSnapshot.generation + 1 }, [formSnapshot, formIdentity]);
  if (formSnapshot !== formContext) setFormSnapshot(formContext);
  const [rowSnapshot, setRowSnapshot] = useState(() => new Map<string, Context>());
  const rowContexts = useMemo(() => {
    const next = new Map<string, Context>();
    if (requestsAvailable) for (const row of requests) {
      const identity = JSON.stringify([row.id, row.title, row.description, row.watch_type, row.active, row.priority, row.schedule, row.created_at, row.kindergarten_id, row.observer_site_id, row.camera_id, row.zone_id]);
      const previous = rowSnapshot.get(row.id);
      next.set(row.id, previous?.identity === identity ? previous : { identity, generation: (previous?.generation ?? -1) + 1 });
    }
    return next.size === rowSnapshot.size && [...next].every(([id, value]) => rowSnapshot.get(id) === value) ? rowSnapshot : next;
  }, [requestsAvailable, requests, rowSnapshot]);
  if (rowSnapshot !== rowContexts) setRowSnapshot(rowContexts);
  const liveForm = useRef<Context | null>(null);
  const liveRows = useRef<Map<string, Context>>(new Map());
  const formSequence = useRef(0);
  const rowSequence = useRef(0);
  const rowTokens = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    liveForm.current = formContext;
    return () => { if (liveForm.current === formContext) liveForm.current = null; };
  }, [formContext]);
  useLayoutEffect(() => {
    liveRows.current = rowContexts;
    rowTokens.current = new Map([...rowTokens.current].filter(([id]) => rowContexts.has(id)));
    return () => { if (liveRows.current === rowContexts) liveRows.current = new Map(); };
  }, [rowContexts]);
  const [creationFeedback, setCreationFeedback] = useState<Feedback>(() => ({ context: formContext, message: null, busy: false }));
  const [rowFeedback, setRowFeedback] = useState<Record<string, Feedback>>({});
  const currentCreation = creationFeedback.context === formContext ? creationFeedback : { context: formContext, message: null, busy: false };
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = requestRows.filter((request) => request.active).length;
  const disabledCount = requestRows.filter((request) => !request.active).length;
  const byType = requestRows.reduce<Record<string, number>>((acc, request) => {
    acc[request.watch_type] = (acc[request.watch_type] ?? 0) + 1;
    return acc;
  }, {});

  async function post(payload: Record<string, unknown>, current = () => true, update = (patch: Partial<Pick<Feedback, "busy" | "message">>) => { if (patch.message !== undefined) setMessage(patch.message); }) {
    try {
      if (!current()) return;
      update({ message: null, busy: true });
      const response = await fetch("/api/observer-watch-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
      });
      const body = await response.json();
      if (!current()) return;
      if (!response.ok) { update({ message: body.error ?? "הפעולה נכשלה" }); return; }
      update({ message: "הפעולה נשמרה" });
      router.refresh();
    } catch {
      if (current()) update({ message: "הפעולה נכשלה" });
    } finally {
      update({ busy: false });
    }
  }

  function formCurrent() {
    return !qualified || (choicesAvailable && liveForm.current === formContext);
  }

  function createRequest(formData: FormData) {
    if (!formCurrent()) return;
    startTransition(() => {
      if (!formCurrent()) return;
      const targets: Record<string, unknown> = {};
      const bindings: [string, SelectOption[] | undefined][] = [["kindergarten_id", gardens], ["observer_site_id", observerSites], ["camera_id", cameras], ["zone_id", zones]];
      for (const [field, options = []] of bindings) {
        if (!formCurrent()) return;
        const value = field === "kindergarten_id" && fixedKindergartenId != null ? fixedKindergartenId : formData.get(field) || null;
        if (!formCurrent()) return;
        if (qualified && value !== null && (typeof value !== "string" || !options.some((option) => option.id === value))) return;
        targets[field] = value;
      }
      const payload = {
        action: "create",
        ...targets,
        title: formData.get("title"),
        description: formData.get("description"),
        watch_type: formData.get("watch_type"),
        priority: formData.get("priority"),
        schedule_mode: formData.get("schedule_mode"),
        notification_channels: ["in_app"]
      };
      if (!formCurrent()) return;
      if (!qualified) { void post(payload); return; }
      const token = ++formSequence.current;
      const current = () => formCurrent() && formSequence.current === token;
      const update = (patch: Partial<Pick<Feedback, "busy" | "message">>) => setCreationFeedback((previous) => current() ? { ...previous, context: formContext, ...patch } : previous);
      void post(payload, current, update);
    });
  }

  function rowAction(id: string, action: "disable" | "trigger_mock", context?: Context) {
    const valid = () => !qualified || (context !== undefined && liveRows.current.get(id) === context);
    if (!valid()) return;
    startTransition(() => {
      if (!valid()) return;
      if (!qualified || !context) { void post({ action, id }); return; }
      const token = ++rowSequence.current;
      rowTokens.current.set(id, token);
      const current = () => valid() && rowTokens.current.get(id) === token;
      const update = (patch: Partial<Pick<Feedback, "busy" | "message">>) => setRowFeedback((previous) => {
        if (!current()) return previous;
        const retained = Object.fromEntries(Object.entries(previous).filter(([key, feedback]) => liveRows.current.get(key) === feedback.context));
        return { ...retained, [id]: { ...(retained[id] ?? { message: null, busy: false }), context, ...patch } };
      });
      void post({ action, id }, current, update);
    });
  }

  return (
    <div className="stack">
      <section className="grid cols-4 dashboard-panels">
        <article className="metric-card"><Eye /><strong>{requestsAvailable ? requestRows.length : unavailable}</strong><span>בקשות</span></article>
        <article className="metric-card"><PlayCircle /><strong>{requestsAvailable ? activeCount : unavailable}</strong><span>פעילות</span></article>
        <article className="metric-card"><PauseCircle /><strong>{requestsAvailable ? disabledCount : unavailable}</strong><span>מושבתות</span></article>
        <article className="metric-card"><Save /><strong>{requestsAvailable ? Object.keys(byType).length : unavailable}</strong><span>סוגים</span></article>
      </section>

      {(qualified ? currentCreation.message : message) ? <div className={(qualified ? currentCreation.message : message)?.includes("נכשלה") || (qualified ? currentCreation.message : message)?.includes("לא ") ? "notice warning" : "notice success"}>{qualified ? currentCreation.message : message}</div> : null}

      <section className="grid cols-2 dashboard-panels">
        <article className="card action-panel">
          <div className="section-heading">
            <h2>בקשת מעקב חדשה</h2>
            <p>Rule-based/mock בלבד. אין AI אמיתי, אין הודעה להורים, וכל אירוע דורש review.</p>
          </div>
          {!choicesAvailable ? <p>{unavailable}</p> : null}
          <form key={qualified ? formContext.generation : undefined} action={createRequest} className="form-grid compact-form">
            {role === "admin" ? (
              <>
                <label className="form-field"><span>גן בטוח</span><select name="kindergarten_id" disabled={qualified && !availability.gardens}>{qualified && !availability.gardens ? <option value="">{unavailable}</option> : <><option value="">ללא גן</option>{(gardens ?? []).map((garden) => <option key={garden.id} value={garden.id}>{garden.name}</option>)}</>}</select></label>
                <label className="form-field"><span>Observer site</span><select name="observer_site_id" disabled={qualified && !availability.observerSites}>{qualified && !availability.observerSites ? <option value="">{unavailable}</option> : <><option value="">ללא site</option>{(observerSites ?? []).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</>}</select></label>
              </>
            ) : <input type="hidden" name="kindergarten_id" value={fixedKindergartenId ?? ""} />}
            <label className="form-field"><span>כותרת</span><input name="title" placeholder="שים לב לשער האחורי" required /></label>
            <label className="form-field"><span>סוג בקשה</span><select name="watch_type" defaultValue="after_hours_activity">{Object.entries(watchTypeLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
            <label className="form-field"><span>מצלמה</span><select name="camera_id" disabled={qualified && !availability.cameras}>{qualified && !availability.cameras ? <option value="">{unavailable}</option> : <><option value="">כל המצלמות</option>{cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.name}</option>)}</>}</select></label>
            <label className="form-field"><span>אזור</span><select name="zone_id" disabled={qualified && !availability.zones}>{qualified && !availability.zones ? <option value="">{unavailable}</option> : <><option value="">כל האזורים</option>{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</>}</select></label>
            <label className="form-field"><span>לוח זמנים</span><select name="schedule_mode" defaultValue="always_active"><option value="always_active">תמיד פעיל</option><option value="business_hours">שעות פעילות</option><option value="night_only">לילה בלבד</option><option value="custom_days_hours">ימים/שעות מותאמים</option></select></label>
            <label className="form-field"><span>עדיפות</span><input name="priority" type="number" min="1" max="10" defaultValue="5" /></label>
            <label className="form-field full"><span>פירוט</span><textarea name="description" placeholder="לדוגמה: שים לב אם יש תנועה אחרי 22:00" rows={3} /></label>
            <button className="button primary full" type="submit" disabled={qualified ? !choicesAvailable || currentCreation.busy : isPending}><Save size={18} /> שמירה</button>
          </form>
        </article>

        <article className="card action-panel">
          <div className="section-heading"><h2>סוגי בקשות</h2><p>התרגום הוא deterministic. טקסט חופשי נשמר לעתיד ולא מפוענח עם AI כרגע.</p></div>
          <div className="risk-list">
            {Object.entries(watchTypeLabels).map(([key, label]) => <div key={key}>{label} <b>{requestsAvailable ? byType[key] ?? 0 : unavailable}</b></div>)}
          </div>
        </article>
      </section>

      <section className="dashboard-section">
        <div className="section-heading"><h2>בקשות קיימות</h2><p>Trigger mock יוצר אירוע shadow מקושר, לא הודעת הורה.</p></div>
        {!requestsAvailable ? <div className="empty-state"><strong>{unavailable}</strong></div> : requestRows.length === 0 ? <div className="empty-state"><strong>אין בקשות מעקב</strong><span>צרו בקשה ראשונה כדי להכין את התצפיתן לעבודה מותאמת.</span></div> : (
          <div className="procedure-list">
            {requestRows.map((request) => {
              const context = rowContexts.get(request.id);
              const feedback = rowFeedback[request.id]?.context === context ? rowFeedback[request.id] : undefined;
              return (
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
                  {qualified && feedback?.message ? <div className={feedback.message.includes("נכשלה") || feedback.message.includes("לא ") ? "notice warning" : "notice success"}>{feedback.message}</div> : null}
                  <button className="button secondary" type="button" onClick={() => rowAction(request.id, "trigger_mock", context)} disabled={qualified ? feedback?.busy ?? false : isPending}>Trigger mock</button>
                  {request.active ? <button className="button danger" type="button" onClick={() => rowAction(request.id, "disable", context)} disabled={qualified ? feedback?.busy ?? false : isPending}>השבתה</button> : null}
                </div>
              </article>
            ); })}
          </div>
        )}
      </section>
    </div>
  );
}
