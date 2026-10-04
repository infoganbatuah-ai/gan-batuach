"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  FileCheck2,
  FileImage,
  Filter,
  History,
  Search,
  ShieldCheck,
  Wrench
} from "lucide-react";
import { ViolationStatusActions } from "@/components/violation-status-actions";

type CorrectiveRole = "garden" | "inspector";
type CorrectiveEvent = { id?: string; action: string; from_status?: string | null; to_status?: string | null; note?: string | null; created_at?: string | null };
type CorrectiveRow = {
  id: string;
  title: string;
  description?: string | null;
  category?: string | null;
  severity?: string | null;
  score?: number | null;
  status: string;
  correction_due_at?: string | null;
  correction_note?: string | null;
  review_note?: string | null;
  correction_files?: string[] | null;
  created_at?: string | null;
  submitted_at?: string | null;
  approved_at?: string | null;
  gardens?: { name?: string | null; city?: string | null } | null;
  events?: CorrectiveEvent[];
};

const statusLabels: Record<string, string> = {
  open: "פתוחה",
  in_progress: "בטיפול",
  waiting_approval: "ממתינה לבדיקת מפקח",
  rejected: "נדרשת ראיה נוספת",
  overdue: "באיחור",
  done: "אומתה ונסגרה"
};

const eventLabels: Record<string, string> = {
  acknowledge: "הגן אישר קבלה",
  progress: "נשמרה התקדמות",
  submit: "הראיות נשלחו לבדיקה",
  accept: "התיקון אומת ונסגר",
  reject: "נדרשה ראיה נוספת",
  reopen: "הפעולה נפתחה מחדש",
  extend: "תאריך היעד עודכן"
};

function statusTone(status: string) {
  if (status === "done") return "good";
  if (["rejected", "overdue"].includes(status)) return "bad";
  if (["waiting_approval", "in_progress"].includes(status)) return "warn";
  return "info";
}

function format(value?: string | null, withTime = false) {
  if (!value) return "לא הוגדר";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "לא הוגדר";
  return new Intl.DateTimeFormat("he-IL", withTime ? { dateStyle: "short", timeStyle: "short" } : { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function overdue(row: CorrectiveRow) {
  return Boolean(row.correction_due_at && row.status !== "done" && new Date(row.correction_due_at).getTime() < Date.now());
}

export function CorrectiveActionWorkspace({ rows, role, scopeMessage }: { rows: CorrectiveRow[]; role: CorrectiveRole; scopeMessage?: string }) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;
  const metrics = useMemo(() => ({
    active: rows.filter((row) => row.status !== "done").length,
    review: rows.filter((row) => row.status === "waiting_approval").length,
    overdue: rows.filter(overdue).length,
    done: rows.filter((row) => row.status === "done").length
  }), [rows]);
  const visible = useMemo(() => rows.filter((row) => {
    const term = query.trim().toLocaleLowerCase("he");
    const matchesQuery = !term || `${row.title} ${row.description ?? ""} ${row.gardens?.name ?? ""}`.toLocaleLowerCase("he").includes(term);
    const matchesFilter = filter === "all"
      || (filter === "active" && row.status !== "done")
      || (filter === "review" && row.status === "waiting_approval")
      || (filter === "overdue" && overdue(row))
      || (filter === "done" && row.status === "done");
    return matchesQuery && matchesFilter;
  }), [filter, query, rows]);

  return <section className="work-platform corrective-platform" aria-label="מרכז פעולות תיקון">
    <header className="work-platform-hero"><div><span className="work-eyebrow"><Wrench size={16} /> פעולות תיקון GB-M23</span><h1>פעולות תיקון</h1><p>{role === "garden" ? "הגשת תגובה וראיות לממצא, עד לאימות המפקח." : "בדיקת תיקון מול הממצא המקורי, הראיות וציר הטיפול."}</p></div></header>
    {scopeMessage ? <div className="work-scope-note"><ShieldCheck size={18} />{scopeMessage}</div> : null}
    <div className="work-score-lock"><ShieldCheck size={18} /><span><strong>ציון הביקורת המקורי נשמר.</strong> אימות תיקון סוגר את הפעולה ואינו משנה את הציון ההיסטורי.</span></div>
    <div className="work-metrics">
      <button className={filter === "active" ? "active" : ""} type="button" onClick={() => setFilter("active")}><span className="work-metric-icon blue"><Wrench /></span><strong>{metrics.active}</strong><span>פתוחות</span></button>
      <button className={filter === "review" ? "active" : ""} type="button" onClick={() => setFilter("review")}><span className="work-metric-icon orange"><FileCheck2 /></span><strong>{metrics.review}</strong><span>ממתינות לבדיקה</span></button>
      <button className={filter === "overdue" ? "active" : ""} type="button" onClick={() => setFilter("overdue")}><span className="work-metric-icon red"><AlertTriangle /></span><strong>{metrics.overdue}</strong><span>באיחור</span></button>
      <button className={filter === "done" ? "active" : ""} type="button" onClick={() => setFilter("done")}><span className="work-metric-icon green"><CheckCircle2 /></span><strong>{metrics.done}</strong><span>אומתו</span></button>
    </div>
    <div className="work-toolbar"><label className="work-search"><Search size={18} /><span className="sr-only">חיפוש פעולות תיקון</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי ממצא או גן..." /></label><label className="work-filter"><Filter size={17} /><span className="sr-only">סינון פעולות תיקון</span><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="active">פתוחות</option><option value="review">ממתינות לבדיקה</option><option value="overdue">באיחור</option><option value="done">אומתו</option><option value="all">הכול</option></select></label></div>
    {!rows.length ? <div className="work-empty"><span><CheckCircle2 /></span><h2>אין פעולות תיקון</h2><p>ממצאים שדורשים תיקון יופיעו כאן עם תאריך יעד ופעולה הבאה.</p></div> : !visible.length ? <div className="work-empty compact"><span><Search /></span><h2>לא נמצאו פעולות</h2><p>אפשר לשנות את החיפוש או הסינון.</p></div> : <div className={`work-list-detail ${detailOpen ? "has-selection" : ""}`}>
      <div className="work-list" role="list">{visible.map((row) => <button type="button" role="listitem" key={row.id} className={`work-list-card ${selected?.id === row.id ? "selected" : ""}`} onClick={() => { setSelectedId(row.id); setDetailOpen(true); }}><span className={`work-priority-dot ${overdue(row) || row.status === "rejected" ? "bad" : row.status === "done" ? "good" : "warn"}`} /><span className="work-list-card-content"><span className="work-list-card-top"><strong>{row.title}</strong><span className={`status-chip ${statusTone(overdue(row) ? "overdue" : row.status)}`}>{overdue(row) ? "באיחור" : statusLabels[row.status] ?? row.status}</span></span><span className="work-list-card-description">{row.gardens?.name ?? "גן"} · {row.category ?? "ממצא ביקורת"}</span><span className="work-list-card-bottom"><span><CalendarClock size={15} />יעד {format(row.correction_due_at)}</span><span>{Array.isArray(row.correction_files) ? row.correction_files.length : 0} ראיות</span></span></span><ChevronLeft className="work-chevron" size={19} /></button>)}</div>
      {selected ? <article className="work-detail"><div className="work-detail-mobile-head"><button type="button" onClick={() => setDetailOpen(false)}><ChevronLeft /></button><span>בדיקת תיקון</span></div><header className="work-detail-head"><div><div className="work-detail-chips"><span className={`status-chip ${statusTone(selected.status)}`}>{statusLabels[selected.status] ?? selected.status}</span><span className={`status-chip ${["critical", "high"].includes(String(selected.severity)) ? "bad" : "warn"}`}>חומרה {selected.severity ?? "לא צוינה"}</span></div><h2>{selected.title}</h2><p>{selected.description || "לא נוסף תיאור לממצא."}</p></div></header>
        <div className="work-detail-facts"><div><span><AlertTriangle size={18} /> הממצא המקורי</span><strong>{selected.category ?? "ממצא ביקורת"}</strong></div><div><span><CalendarClock size={18} /> תאריך יעד</span><strong>{format(selected.correction_due_at, true)}</strong></div><div><span><Wrench size={18} /> תגובת הגן</span><strong>{selected.correction_note || "טרם התקבלה תגובה"}</strong></div><div><span><ShieldCheck size={18} /> החלטת מפקח</span><strong>{selected.review_note || "טרם התקבלה החלטה"}</strong></div></div>
        <section className="work-evidence"><div className="work-section-title"><div><FileImage size={19} /><h3>ראיות תיקון</h3></div><span>{selected.correction_files?.length ?? 0} קבצים</span></div>{selected.correction_files?.length ? <div className="work-evidence-grid">{selected.correction_files.map((path) => <a key={path} className="work-evidence-card" href={`/api/violations/${selected.id}/evidence?path=${encodeURIComponent(path)}`}><FileCheck2 /><span><strong>ראיית תיקון</strong><small>{path.split("/").pop()}</small></span><ChevronLeft /></a>)}</div> : <div className="work-inline-empty"><FileImage /><span><strong>טרם צורפה ראיה</strong><small>הגן יצרף תמונה או מסמך פרטי לפני שליחה לבדיקה.</small></span></div>}</section>
        <section className="work-timeline"><h3><History size={18} /> ציר טיפול</h3><ol>{selected.events?.length ? selected.events.map((event, index) => <li className={event.to_status === "done" ? "done" : event.to_status === "rejected" ? "current" : "done"} key={event.id ?? `${event.action}-${index}`}><span /><div><strong>{eventLabels[event.action] ?? event.action}</strong><small>{event.note || `${event.from_status ?? "—"} ← ${event.to_status ?? "—"}`} · {format(event.created_at, true)}</small></div></li>) : <li className="current"><span /><div><strong>הממצא נפתח</strong><small>{format(selected.created_at, true)}</small></div></li>}</ol></section>
        <div className="work-canonical-actions"><ViolationStatusActions id={selected.id} initialStatus={selected.status} role={role} /></div>
      </article> : null}
    </div>}
  </section>;
}
