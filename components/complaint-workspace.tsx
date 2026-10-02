"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  CircleAlert,
  Clock3,
  Filter,
  MessageSquareWarning,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react";

type ComplaintRole = "parent" | "garden" | "inspector" | "admin";
type ComplaintRow = {
  id: string;
  subject: string;
  description?: string | null;
  category?: string | null;
  severity?: string | null;
  status: string;
  created_at?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  closed_at?: string | null;
  acknowledgement_due_at?: string | null;
  response_due_at?: string | null;
  resolution_due_at?: string | null;
  resolution_public?: string | null;
  routing_state?: string | null;
  gardens?: { name?: string | null; city?: string | null } | null;
  children?: { full_name?: string | null } | null;
  parents?: { full_name?: string | null } | null;
  assignee?: { full_name?: string | null } | null;
};

type ParentContext = { gardenId: string; childId: string | null; label: string };

const labels: Record<string, string> = {
  new: "התקבלה",
  assigned: "שויכה לטיפול",
  in_progress: "בבדיקה",
  waiting_garden: "ממתינה לתגובת הגן",
  waiting_reporter: "נדרש מידע מהפונה",
  escalated: "הוסלמה",
  resolved: "טופלה",
  closed: "נסגרה",
  reopened: "נפתחה מחדש"
};

const actionLabels: Record<string, string> = {
  acknowledge: "אישור קבלה",
  review: "התחלת בדיקה",
  request_reporter: "בקשת מידע מהפונה",
  request_garden: "בקשת תגובת הגן",
  reporter_reply: "מסירת מידע נוסף",
  garden_reply: "שליחת תגובת הגן",
  escalate: "הסלמה",
  resolve: "פתרון התלונה",
  close: "סגירת התלונה",
  reopen: "פתיחה מחדש"
};

function tone(status: string) {
  if (["resolved", "closed"].includes(status)) return "good";
  if (status === "escalated") return "bad";
  if (["waiting_garden", "waiting_reporter"].includes(status)) return "warn";
  return "info";
}

function format(value?: string | null, withTime = false) {
  if (!value) return "לא הוגדר";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא הוגדר";
  return new Intl.DateTimeFormat("he-IL", withTime ? { dateStyle: "short", timeStyle: "short" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function activeDeadline(row: ComplaintRow) {
  const candidates = [row.acknowledgement_due_at, row.response_due_at, row.resolution_due_at]
    .filter(Boolean).map((value) => new Date(value as string)).filter((date) => !Number.isNaN(date.getTime()));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.getTime() - b.getTime())[0];
}

function isOverdue(row: ComplaintRow) {
  const deadline = activeDeadline(row);
  return Boolean(deadline && !["resolved", "closed"].includes(row.status) && deadline.getTime() < Date.now());
}

function availableActions(status: string, role: ComplaintRole) {
  if (role === "parent") return status === "waiting_reporter" ? ["reporter_reply"] : [];
  if (role === "garden") {
    const actions: string[] = [];
    if (status === "new") actions.push("acknowledge");
    if (!["resolved", "closed"].includes(status)) actions.push("garden_reply");
    return actions;
  }
  const actions: string[] = [];
  if (status === "new") actions.push("acknowledge");
  if (["new", "assigned", "reopened"].includes(status)) actions.push("review");
  if (!["resolved", "closed"].includes(status)) actions.push("request_reporter", "request_garden", "escalate");
  if (["in_progress", "escalated", "reopened", "waiting_garden", "waiting_reporter"].includes(status)) actions.push("resolve");
  if (status === "resolved") actions.push("close");
  if (["resolved", "closed"].includes(status)) actions.push("reopen");
  return actions;
}

export function ComplaintWorkspace({
  rows,
  role,
  contexts = [],
  title = "תלונות ופניות",
  scopeMessage
}: {
  rows: ComplaintRow[];
  role: ComplaintRole;
  contexts?: ParentContext[];
  title?: string;
  scopeMessage?: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(rows);
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [dialog, setDialog] = useState<"create" | "action" | null>(null);
  const [action, setAction] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = items.find((row) => row.id === selectedId) ?? items[0] ?? null;

  const metrics = useMemo(() => ({
    active: items.filter((row) => !["resolved", "closed"].includes(row.status)).length,
    overdue: items.filter(isOverdue).length,
    escalated: items.filter((row) => row.status === "escalated").length,
    resolved: items.filter((row) => ["resolved", "closed"].includes(row.status)).length
  }), [items]);

  const visible = useMemo(() => items.filter((row) => {
    const term = query.trim().toLocaleLowerCase("he");
    const matchesQuery = !term || `${row.subject} ${row.category ?? ""} ${row.gardens?.name ?? ""}`.toLocaleLowerCase("he").includes(term);
    const matchesFilter = filter === "all"
      || (filter === "active" && !["resolved", "closed"].includes(row.status))
      || (filter === "overdue" && isOverdue(row))
      || (filter === "escalated" && row.status === "escalated")
      || (filter === "resolved" && ["resolved", "closed"].includes(row.status));
    return matchesQuery && matchesFilter;
  }), [filter, items, query]);

  function runAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || !action) return;
    const note = String(new FormData(event.currentTarget).get("note") ?? "").trim();
    const needsNote = ["request_reporter", "request_garden", "reporter_reply", "garden_reply", "resolve", "reopen"].includes(action);
    if (needsNote && !note) return;
    startTransition(async () => {
      const response = await fetch(`/api/complaints/${selected.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, publicNote: note || null })
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        setItems((current) => current.map((row) => row.id === selected.id ? { ...row, ...body.data, resolution_public: body.data.resolution_public ?? row.resolution_public } : row));
        setDialog(null); setAction(null);
        setFeedback({ tone: "good", text: "הפעולה נשמרה בציר הטיפול." });
        router.refresh();
      } else setFeedback({ tone: "bad", text: "הפעולה אינה זמינה כעת או שהמצב השתנה. רעננו ונסו שוב." });
    });
  }

  function createComplaint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const context = contexts[Number(data.get("context"))];
    if (!context) { setFeedback({ tone: "bad", text: "לא נמצא שיוך פעיל לילד ולגן." }); return; }
    const payload = {
      garden_id: context.gardenId,
      child_id: context.childId ?? undefined,
      subject: String(data.get("subject") ?? ""),
      description: String(data.get("description") ?? ""),
      severity: String(data.get("severity") ?? "medium"),
      urgent: Boolean(data.get("urgent")),
      category: String(data.get("category") ?? "general")
    };
    startTransition(async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(payload)));
      const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
      let key = crypto.randomUUID();
      try {
        const pendingRequest = JSON.parse(sessionStorage.getItem("gb:m25:pending-complaint") ?? "null") as { fingerprint?: string; key?: string } | null;
        if (pendingRequest?.fingerprint === fingerprint && pendingRequest.key) key = pendingRequest.key;
        else sessionStorage.setItem("gb:m25:pending-complaint", JSON.stringify({ fingerprint, key }));
      } catch { /* Private browsing may disable session storage; the server still enforces authorization. */ }
      const response = await fetch("/api/parent/complaints", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload) });
      const body = await response.json().catch(() => null);
      if (response.ok) {
        try { sessionStorage.removeItem("gb:m25:pending-complaint"); } catch { /* Optional retry preference. */ }
        setDialog(null);
        setFeedback({ tone: "good", text: "התלונה נשלחה ותועדה. אפשר לעקוב אחריה כאן." });
        router.refresh();
      } else setFeedback({ tone: "bad", text: body?.error || "לא ניתן לשלוח תלונה כרגע." });
    });
  }

  function askAction(next: string) {
    setAction(next);
    const needsNote = ["request_reporter", "request_garden", "reporter_reply", "garden_reply", "resolve", "reopen"].includes(next);
    if (needsNote) setDialog("action");
    else {
      setAction(next);
      requestAnimationFrame(() => runImmediate(next));
    }
  }

  function runImmediate(next: string) {
    if (!selected) return;
    startTransition(async () => {
      const response = await fetch(`/api/complaints/${selected.id}/actions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: next, publicNote: null }) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.data) {
        setItems((current) => current.map((row) => row.id === selected.id ? { ...row, ...body.data } : row));
        setFeedback({ tone: "good", text: "הפעולה נשמרה בציר הטיפול." });
        router.refresh();
      } else setFeedback({ tone: "bad", text: "הפעולה אינה זמינה כעת או שהמצב השתנה." });
    });
  }

  return <section className="work-platform complaint-platform" aria-label={title}>
    <header className="work-platform-hero"><div><span className="work-eyebrow"><MessageSquareWarning size={16} /> תלונות הן תהליך נפרד מהודעות</span><h1>{title}</h1><p>סטטוס, יעד ופעולה הבאה מוצגים לפי נתוני הטיפול וההרשאות הקנוניים.</p></div>{role === "parent" ? <button className="button primary" type="button" onClick={() => setDialog("create")} disabled={!contexts.length}><Plus size={18} /> תלונה חדשה</button> : null}</header>
    {scopeMessage ? <div className="work-scope-note"><ShieldCheck size={18} />{scopeMessage}</div> : null}
    {feedback ? <div role="status" className={`work-feedback ${feedback.tone}`}>{feedback.tone === "good" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{feedback.text}</div> : null}
    <div className="work-metrics">
      <button className={filter === "active" ? "active" : ""} type="button" onClick={() => setFilter("active")}><span className="work-metric-icon blue"><MessageSquareWarning /></span><strong>{metrics.active}</strong><span>פתוחות</span></button>
      <button className={filter === "overdue" ? "active" : ""} type="button" onClick={() => setFilter("overdue")}><span className="work-metric-icon red"><Clock3 /></span><strong>{metrics.overdue}</strong><span>יעד חלף</span></button>
      <button className={filter === "escalated" ? "active" : ""} type="button" onClick={() => setFilter("escalated")}><span className="work-metric-icon orange"><CircleAlert /></span><strong>{metrics.escalated}</strong><span>מוסלמות</span></button>
      <button className={filter === "resolved" ? "active" : ""} type="button" onClick={() => setFilter("resolved")}><span className="work-metric-icon green"><CheckCircle2 /></span><strong>{metrics.resolved}</strong><span>טופלו</span></button>
    </div>
    <div className="work-toolbar"><label className="work-search"><Search size={18} /><span className="sr-only">חיפוש תלונות</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי נושא או גן..." /></label><label className="work-filter"><Filter size={17} /><span className="sr-only">סינון תלונות</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">פתוחות</option><option value="overdue">יעד חלף</option><option value="escalated">מוסלמות</option><option value="resolved">טופלו</option><option value="all">הכול</option></select></label></div>

    {!items.length ? <div className="work-empty"><span><CheckCircle2 /></span><h2>אין תלונות</h2><p>{role === "parent" ? "פניות שתגישו יישמרו כאן עם סטטוס ברור." : "פניות מורשות יופיעו כאן כאשר ייפתחו."}</p></div> : !visible.length ? <div className="work-empty compact"><span><Search /></span><h2>לא נמצאו תלונות</h2><p>אפשר לשנות את החיפוש או הסינון.</p></div> : <div className={`work-list-detail ${detailOpen ? "has-selection" : ""}`}>
      <div className="work-list" role="list">{visible.map((row) => {
        const overdue = isOverdue(row);
        return <button className={`work-list-card ${selected?.id === row.id ? "selected" : ""}`} role="listitem" type="button" key={row.id} onClick={() => { setSelectedId(row.id); setDetailOpen(true); }}><span className={`work-priority-dot ${row.status === "escalated" || overdue ? "bad" : "warn"}`} /><span className="work-list-card-content"><span className="work-list-card-top"><strong>{row.subject}</strong><span className={`status-chip ${tone(row.status)}`}>{labels[row.status] ?? row.status}</span></span><span className="work-list-card-description">{row.category ?? "כללי"} · {row.gardens?.name ?? (role === "parent" ? "הגן המקושר" : "גן")}</span><span className="work-list-card-bottom"><span><CalendarClock size={15} />{overdue ? "היעד חלף" : activeDeadline(row) ? `יעד ${format(activeDeadline(row)?.toISOString())}` : "ללא יעד מוגדר"}</span><span>{format(row.created_at)}</span></span></span><ChevronLeft className="work-chevron" size={19} /></button>;
      })}</div>
      {selected ? <article className="work-detail"><div className="work-detail-mobile-head"><button type="button" onClick={() => setDetailOpen(false)}><ChevronLeft /></button><span>פרטי תלונה</span></div><header className="work-detail-head"><div><div className="work-detail-chips"><span className={`status-chip ${tone(selected.status)}`}>{labels[selected.status] ?? selected.status}</span>{selected.severity ? <span className={`status-chip ${["critical", "high"].includes(selected.severity) ? "bad" : "warn"}`}>דחיפות {selected.severity}</span> : null}</div><h2>{selected.subject}</h2><p>{selected.description || "פרטי התלונה זמינים בהתאם להרשאת התפקיד."}</p></div></header>
        <div className="work-detail-facts"><div><span><ShieldCheck size={18} /> גן והקשר</span><strong>{selected.gardens?.name ?? "הקשר מורשה"}{selected.children?.full_name ? ` · ${selected.children.full_name}` : ""}</strong></div><div><span><CalendarClock size={18} /> יעד טיפול</span><strong>{activeDeadline(selected) ? format(activeDeadline(selected)?.toISOString(), true) : "לא הוגדר יעד"}</strong></div><div><span><UserRound size={18} /> אחראי</span><strong>{selected.assignee?.full_name ?? "צוות הטיפול"}</strong></div><div><span><CircleAlert size={18} /> הסלמה</span><strong>{selected.status === "escalated" ? "התלונה מוסלמת" : "אין הסלמה פעילה"}</strong></div></div>
        <section className="work-timeline"><h3>ציר טיפול</h3><ol><li className="done"><span /><div><strong>התלונה התקבלה</strong><small>{format(selected.created_at, true)}</small></div></li><li className={selected.acknowledged_at ? "done" : "future"}><span /><div><strong>אישור קבלה</strong><small>{selected.acknowledged_at ? format(selected.acknowledged_at, true) : "ממתין"}</small></div></li><li className={selected.status === "escalated" ? "current" : ["resolved", "closed"].includes(selected.status) ? "done" : "future"}><span /><div><strong>טיפול והחלטה</strong><small>{selected.resolution_public || labels[selected.status] || selected.status}</small></div></li><li className={selected.status === "closed" ? "done" : "future"}><span /><div><strong>סגירה</strong><small>{selected.closed_at ? format(selected.closed_at, true) : "טרם נסגרה"}</small></div></li></ol></section>
        <div className="work-detail-actions">{availableActions(selected.status, role).map((next) => <button type="button" disabled={pending} className={next === "escalate" ? "button ghost-danger" : next === "resolve" || next === "close" ? "button primary" : "button secondary"} key={next} onClick={() => askAction(next)}>{actionLabels[next]}</button>)}</div>
      </article> : null}
    </div>}

    {dialog === "action" ? <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><div className="work-modal small" role="dialog" aria-modal="true" aria-labelledby="complaint-action-title"><header><h2 id="complaint-action-title">{action ? actionLabels[action] : "פעולה"}</h2><button className="icon-button" type="button" onClick={() => setDialog(null)} aria-label="סגירה"><X /></button></header><form onSubmit={runAction}><label>פירוט<textarea name="note" rows={5} required autoFocus maxLength={4000} placeholder="הפירוט יוצג רק בהתאם למדיניות ולתפקיד" /></label><div className="work-modal-actions"><button className="button secondary" type="button" onClick={() => setDialog(null)}>ביטול</button><button className="button primary" disabled={pending}>שמירת הפעולה</button></div></form></div></div> : null}
    {dialog === "create" ? <div className="work-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialog(null); }}><div className="work-modal" role="dialog" aria-modal="true" aria-labelledby="complaint-create-title"><header><div><span className="work-eyebrow"><MessageSquareWarning size={15} /> תלונה רשמית</span><h2 id="complaint-create-title">תלונה חדשה</h2></div><button className="icon-button" type="button" onClick={() => setDialog(null)} aria-label="סגירה"><X /></button></header><form onSubmit={createComplaint}><label>ילד וגן<select name="context" required>{contexts.map((context, index) => <option key={`${context.childId}-${context.gardenId}`} value={index}>{context.label}</option>)}</select></label><div className="work-form-grid"><label>קטגוריה<select name="category"><option value="safety">בטיחות</option><option value="violence">אלימות</option><option value="staff">צוות</option><option value="camera">מצלמות</option><option value="medical">רפואה</option><option value="pickup">איסוף</option><option value="privacy">פרטיות</option><option value="general">כללי</option></select></label><label>דחיפות<select name="severity"><option value="low">נמוכה</option><option value="medium">בינונית</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label></div><label>נושא<input name="subject" minLength={2} maxLength={200} required /></label><label>תיאור<textarea name="description" minLength={5} maxLength={10000} rows={5} required /></label><label className="work-checkbox"><input name="urgent" type="checkbox" /> התלונה דורשת תשומת לב דחופה</label><div className="work-modal-actions"><button className="button secondary" type="button" onClick={() => setDialog(null)}>ביטול</button><button className="button primary" disabled={pending}>שליחת תלונה</button></div></form></div></div> : null}
  </section>;
}
