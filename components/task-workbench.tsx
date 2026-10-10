"use client";

import { useMemo, useRef, useState, useTransition, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Clock3,
  Filter,
  ListChecks,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserRoundCheck,
  X,
  XCircle
} from "lucide-react";

type TaskRow = {
  id: string;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  due_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  completed_at?: string | null;
  assigned_to?: string | null;
  created_by?: string | null;
  garden_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  assignee_name?: string | null;
  creator_name?: string | null;
};

const statusLabels: Record<string, string> = {
  open: "פתוחה",
  in_progress: "בטיפול",
  waiting_approval: "ממתינה לאישור",
  blocked: "חסומה",
  overdue: "באיחור",
  done: "הושלמה",
  completed: "הושלמה",
  rejected: "הוחזרה",
  cancelled: "בוטלה"
};

const priorityLabels: Record<string, string> = {
  low: "נמוכה",
  medium: "רגילה",
  high: "גבוהה",
  urgent: "דחופה",
  critical: "קריטית"
};

function statusTone(status?: string | null) {
  if (["done", "completed"].includes(String(status))) return "good";
  if (["overdue", "rejected", "cancelled"].includes(String(status))) return "bad";
  if (["blocked", "waiting_approval"].includes(String(status))) return "warn";
  return "info";
}

function priorityTone(priority?: string | null) {
  if (["critical", "urgent", "high"].includes(String(priority))) return "bad";
  if (priority === "medium") return "warn";
  return "info";
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "לא הוגדר";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא הוגדר";
  return new Intl.DateTimeFormat("he-IL", includeTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function isOverdue(task: TaskRow) {
  return Boolean(task.due_at && !["done", "completed", "cancelled"].includes(String(task.status)) && new Date(task.due_at).getTime() < Date.now());
}

export function TaskWorkbench({
  tasks,
  gardenId,
  assignees = [],
  canManage = false,
  roleLabel = "צוות הגן",
  limitedMessage
}: {
  tasks: TaskRow[];
  gardenId?: string;
  assignees?: { id: string; name: string }[];
  canManage?: boolean;
  roleLabel?: string;
  limitedMessage?: string;
}) {
  const [rows, setRows] = useState<TaskRow[]>(tasks);
  const [selectedId, setSelectedId] = useState<string | null>(tasks[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [dialog, setDialog] = useState<"create" | "edit" | "note" | null>(null);
  const [pendingAction, setPendingAction] = useState<"reject" | "reopen" | "block" | null>(null);
  const [isPending, startTransition] = useTransition();
  const titleInput = useRef<HTMLInputElement>(null);

  const selected = rows.find((task) => task.id === selectedId) ?? rows[0] ?? null;
  const counts = useMemo(() => ({
    active: rows.filter((task) => !["done", "completed", "cancelled"].includes(String(task.status))).length,
    overdue: rows.filter(isOverdue).length,
    review: rows.filter((task) => task.status === "waiting_approval").length,
    done: rows.filter((task) => ["done", "completed"].includes(String(task.status))).length
  }), [rows]);

  const visibleRows = useMemo(() => rows.filter((task) => {
    const term = search.trim().toLocaleLowerCase("he");
    const matchesSearch = !term || `${task.title ?? ""} ${task.description ?? ""} ${task.assignee_name ?? ""}`.toLocaleLowerCase("he").includes(term);
    const matchesFilter = filter === "all"
      || (filter === "active" && !["done", "completed", "cancelled"].includes(String(task.status)))
      || (filter === "overdue" && isOverdue(task))
      || (filter === "review" && task.status === "waiting_approval")
      || (filter === "done" && ["done", "completed"].includes(String(task.status)));
    return matchesSearch && matchesFilter;
  }), [filter, rows, search]);

  function openDialog(next: "create" | "edit") {
    setDialog(next);
    requestAnimationFrame(() => titleInput.current?.focus());
  }

  function updateTask(id: string, action: "start" | "submit" | "reject" | "complete" | "reopen" | "cancel" | "block", note?: string) {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(`/api/tasks/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: note || undefined })
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        setRows((current) => current.map((task) => task.id === id ? { ...task, ...body.data } : task));
        setMessage({ tone: "good", text: "המשימה עודכנה ונשמרה ביומן הפעילות." });
      } else {
        setMessage({ tone: "bad", text: "לא ניתן לעדכן את המשימה כרגע. בדקו הרשאה או רעננו את העמוד." });
      }
    });
  }

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !pendingAction) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    if (!note) return;
    updateTask(selected.id, pendingAction, note);
    setDialog(null);
    setPendingAction(null);
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!gardenId) return;
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const isEditing = dialog === "edit" && selected;
    const url = isEditing ? `/api/tasks/${selected.id}` : "/api/tasks";
    const assignment = {
      assigned_to: String(data.assigned_to ?? "") || null,
      due_at: data.due_at ? new Date(String(data.due_at)).toISOString() : null,
      priority: String(data.priority ?? "medium")
    };
    const payload = isEditing ? assignment : {
      garden_id: gardenId,
      title: String(data.title ?? "").trim(),
      description: String(data.description ?? "").trim(),
      ...assignment
    };
    setMessage(null);
    startTransition(async () => {
      const response = await fetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        if (isEditing) setRows((current) => current.map((task) => task.id === selected.id ? { ...task, ...body.data } : task));
        else {
          setRows((current) => [body.data, ...current]);
          setSelectedId(body.data.id);
        }
        setDialog(null);
        setMessage({ tone: "good", text: isEditing ? "פרטי המשימה נשמרו." : "המשימה נוצרה ונוספה למרחב העבודה." });
      } else {
        setMessage({ tone: "bad", text: isEditing ? "שמירת המשימה נכשלה. נסו שוב." : "יצירת המשימה נכשלה. בדקו את הפרטים ונסו שוב." });
      }
    });
  }

  return (
    <section className="work-platform" aria-label="מרחב משימות">
      <header className="work-platform-hero">
        <div>
          <span className="work-eyebrow"><ListChecks size={16} /> מרכז עבודה תפעולי</span>
          <h1>משימות</h1>
          <p>מעקב ברור אחר אחריות, תאריך יעד ופעולה הבאה — לפי ההרשאות של {roleLabel}.</p>
        </div>
        {canManage && gardenId ? <button className="button primary" type="button" onClick={() => openDialog("create")}><Plus size={18} /> משימה חדשה</button> : null}
      </header>

      {limitedMessage ? <div className="work-scope-note"><ShieldCheck size={18} /><span>{limitedMessage}</span></div> : null}
      {message ? <div role="status" className={`work-feedback ${message.tone}`}>{message.tone === "good" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{message.text}</div> : null}

      <div className="work-metrics" aria-label="סיכום משימות">
        <button type="button" className={filter === "active" ? "active" : ""} onClick={() => setFilter("active")}><span className="work-metric-icon blue"><CircleDot /></span><strong>{counts.active}</strong><span>פעילות</span></button>
        <button type="button" className={filter === "overdue" ? "active" : ""} onClick={() => setFilter("overdue")}><span className="work-metric-icon red"><AlertTriangle /></span><strong>{counts.overdue}</strong><span>באיחור</span></button>
        <button type="button" className={filter === "review" ? "active" : ""} onClick={() => setFilter("review")}><span className="work-metric-icon orange"><Clock3 /></span><strong>{counts.review}</strong><span>ממתינות לאישור</span></button>
        <button type="button" className={filter === "done" ? "active" : ""} onClick={() => setFilter("done")}><span className="work-metric-icon green"><CheckCircle2 /></span><strong>{counts.done}</strong><span>הושלמו</span></button>
      </div>

      <div className="work-toolbar">
        <label className="work-search"><Search size={18} /><span className="sr-only">חיפוש משימות</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="חיפוש לפי משימה או אחראי..." /></label>
        <label className="work-filter"><Filter size={17} /><span className="sr-only">סינון משימות</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">פעילות</option><option value="overdue">באיחור</option><option value="review">ממתינות לאישור</option><option value="done">הושלמו</option><option value="all">הכול</option></select></label>
      </div>

      {rows.length === 0 ? (
        <div className="work-empty"><span><CheckCircle2 /></span><h2>אין משימות</h2><p>משימות חדשות שיוקצו בהקשר המורשה יופיעו כאן.</p>{canManage && gardenId ? <button className="button primary" type="button" onClick={() => openDialog("create")}><Plus size={18} /> יצירת משימה</button> : null}</div>
      ) : visibleRows.length === 0 ? (
        <div className="work-empty compact"><span><Search /></span><h2>לא נמצאו משימות</h2><p>אפשר לשנות את החיפוש או את הסינון.</p><button className="button secondary" type="button" onClick={() => { setSearch(""); setFilter("all"); }}>ניקוי סינון</button></div>
      ) : (
        <div className={`work-list-detail ${detailOpen ? "has-selection" : ""}`}>
          <div className="work-list" role="list" aria-label="רשימת משימות">
            {visibleRows.map((task) => {
              const overdue = isOverdue(task);
              const assignee = task.assignee_name || assignees.find((person) => person.id === task.assigned_to)?.name || "לא שויך אחראי";
              return <button key={task.id} type="button" role="listitem" className={`work-list-card ${task.id === selected?.id ? "selected" : ""}`} onClick={() => { setSelectedId(task.id); setDetailOpen(true); }}>
                <span className={`work-priority-dot ${priorityTone(task.priority)}`} aria-hidden="true" />
                <span className="work-list-card-content">
                  <span className="work-list-card-top"><strong>{task.title || "משימה ללא כותרת"}</strong><MoreVertical size={17} /></span>
                  <span className="work-list-card-meta"><span className={`status-chip ${statusTone(overdue ? "overdue" : task.status)}`}>{overdue ? "באיחור" : statusLabels[String(task.status)] || task.status || "פתוחה"}</span><span className={`status-chip ${priorityTone(task.priority)}`}>עדיפות {priorityLabels[String(task.priority)] || "רגילה"}</span></span>
                  <span className="work-list-card-bottom"><span><UserRoundCheck size={15} />{assignee}</span><span><CalendarDays size={15} />{formatDate(task.due_at)}</span></span>
                </span>
                <ChevronLeft className="work-chevron" size={19} />
              </button>;
            })}
          </div>

          {selected ? <article className="work-detail" aria-label={`פרטי משימה: ${selected.title ?? "משימה"}`}>
            <div className="work-detail-mobile-head"><button type="button" onClick={() => setDetailOpen(false)} aria-label="חזרה לרשימה"><ChevronLeft /></button><span>פרטי משימה</span></div>
            <header className="work-detail-head">
              <div><div className="work-detail-chips"><span className={`status-chip ${statusTone(isOverdue(selected) ? "overdue" : selected.status)}`}>{isOverdue(selected) ? "באיחור" : statusLabels[String(selected.status)] || selected.status || "פתוחה"}</span><span className={`status-chip ${priorityTone(selected.priority)}`}>עדיפות {priorityLabels[String(selected.priority)] || "רגילה"}</span></div><h2>{selected.title || "משימה ללא כותרת"}</h2><p>{selected.description || "לא נוסף תיאור למשימה זו."}</p></div>
              {canManage ? <button type="button" className="icon-button" onClick={() => openDialog("edit")} aria-label="עריכת משימה"><Pencil size={18} /></button> : null}
            </header>

            <div className="work-detail-facts">
              <div><span><UserRoundCheck size={18} /> אחראי</span><strong>{selected.assignee_name || assignees.find((person) => person.id === selected.assigned_to)?.name || "לא שויך"}</strong></div>
              <div><span><CalendarDays size={18} /> תאריך יעד</span><strong>{formatDate(selected.due_at, true)}</strong></div>
              <div><span><Clock3 size={18} /> נוצרה</span><strong>{formatDate(selected.created_at, true)}</strong></div>
              <div><span><ShieldCheck size={18} /> הקשר</span><strong>{selected.related_entity_type ? "פריט מקושר ומוגן" : "משימת גן"}</strong></div>
            </div>

            <section className="work-timeline" aria-labelledby={`task-history-${selected.id}`}>
              <h3 id={`task-history-${selected.id}`}>ציר פעילות</h3>
              <ol>
                <li className="done"><span /><div><strong>המשימה נוצרה</strong><small>{formatDate(selected.created_at, true)}</small></div></li>
                {selected.updated_at && selected.updated_at !== selected.created_at ? <li className="done"><span /><div><strong>המשימה עודכנה</strong><small>{formatDate(selected.updated_at, true)}</small></div></li> : null}
                <li className={selected.status === "waiting_approval" ? "current" : ["done", "completed"].includes(String(selected.status)) ? "done" : "future"}><span /><div><strong>הוגשה לבדיקה</strong><small>{selected.status === "waiting_approval" ? "ממתינה לפעולה" : ["done", "completed"].includes(String(selected.status)) ? "אושרה" : "טרם הוגשה"}</small></div></li>
                <li className={["done", "completed"].includes(String(selected.status)) ? "done" : "future"}><span /><div><strong>הושלמה</strong><small>{selected.completed_at ? formatDate(selected.completed_at, true) : "טרם הושלמה"}</small></div></li>
              </ol>
            </section>

            <div className="work-detail-actions">
              {selected.status === "open" ? <button className="button primary" disabled={isPending} type="button" onClick={() => updateTask(selected.id, "start")}>התחלת טיפול</button> : null}
              {!["done", "completed", "cancelled", "waiting_approval"].includes(String(selected.status)) ? <button className="button primary" disabled={isPending} type="button" onClick={() => updateTask(selected.id, "submit")}><CheckCircle2 size={17} /> שליחה לאישור</button> : null}
              {canManage && selected.status === "waiting_approval" ? <button className="button primary" disabled={isPending} type="button" onClick={() => updateTask(selected.id, "complete")}><CheckCircle2 size={17} /> אישור השלמה</button> : null}
              {canManage && selected.status === "waiting_approval" ? <button className="button secondary" disabled={isPending} type="button" onClick={() => { setPendingAction("reject"); setDialog("note"); }}><XCircle size={17} /> החזרה לתיקון</button> : null}
              {canManage && ["done", "completed", "cancelled", "rejected"].includes(String(selected.status)) ? <button className="button secondary" disabled={isPending} type="button" onClick={() => { setPendingAction("reopen"); setDialog("note"); }}>פתיחה מחדש</button> : null}
              {canManage && !["done", "completed", "cancelled"].includes(String(selected.status)) ? <button className="button ghost-danger" disabled={isPending} type="button" onClick={() => updateTask(selected.id, "cancel")}>ביטול משימה</button> : null}
            </div>
          </article> : null}
        </div>
      )}

      {dialog === "create" || dialog === "edit" ? <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}>
        <div className="work-modal" role="dialog" aria-modal="true" aria-labelledby="task-form-title">
          <header><div><span className="work-eyebrow"><ListChecks size={15} /> משימות</span><h2 id="task-form-title">{dialog === "edit" ? "עריכת משימה" : "משימה חדשה"}</h2></div><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="סגירה"><X /></button></header>
          <form onSubmit={saveTask}>
            {dialog === "create" ? <><label>כותרת<input ref={titleInput} name="title" required maxLength={200} /></label><label>תיאור<textarea name="description" rows={4} /></label></> : <div className="work-edit-context"><strong>{selected?.title}</strong><span>המודל הקנוני מאפשר לעדכן שיוך, יעד ועדיפות. הכותרת והתיאור נשמרים ביומן המקורי.</span></div>}
            <div className="work-form-grid"><label>אחראי<select name="assigned_to" defaultValue={dialog === "edit" ? selected?.assigned_to ?? "" : ""}><option value="">לא משויך</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><label>עדיפות<select name="priority" defaultValue={dialog === "edit" ? selected?.priority ?? "medium" : "medium"}><option value="low">נמוכה</option><option value="medium">רגילה</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label></div>
            <label>תאריך יעד<input name="due_at" type="datetime-local" defaultValue={dialog === "edit" && selected?.due_at ? new Date(selected.due_at).toISOString().slice(0, 16) : ""} /></label>
            <div className="work-modal-actions"><button type="button" className="button secondary" onClick={() => setDialog(null)}>ביטול</button><button type="submit" className="button primary" disabled={isPending}>{isPending ? "שומר..." : dialog === "edit" ? "שמירת שינויים" : "יצירת משימה"}</button></div>
          </form>
        </div>
      </div> : null}

      {dialog === "note" ? <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><div className="work-modal small" role="dialog" aria-modal="true" aria-labelledby="task-note-title"><header><h2 id="task-note-title">הוספת הערה לפעולה</h2><button type="button" className="icon-button" onClick={() => setDialog(null)} aria-label="סגירה"><X /></button></header><form onSubmit={submitNote}><label>הסבר קצר<textarea name="note" rows={4} required autoFocus placeholder="ההערה נשמרת כחלק מהפעולה" /></label><div className="work-modal-actions"><button type="button" className="button secondary" onClick={() => setDialog(null)}>ביטול</button><button type="submit" className="button primary" disabled={isPending}>אישור הפעולה</button></div></form></div></div> : null}
    </section>
  );
}
