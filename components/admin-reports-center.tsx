"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, MessageSquareReply, PlusCircle } from "lucide-react";

const statuses = ["all", "new", "open", "in_progress", "waiting_user", "resolved", "closed"];
const categories = ["all", "safety", "violence", "staff", "camera", "medical", "pickup", "technical", "privacy", "general"];

export function AdminReportsCenter({ complaints, incidents }: { complaints: any[]; incidents: any[] }) {
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [message, setMessage] = useState("");
  const rows = useMemo(() => [
    ...complaints.map((row) => ({ ...row, source: "complaint", category: row.category ?? "general", title: row.subject })),
    ...incidents.map((row) => ({ ...row, source: "incident", category: row.incident_type ?? "general" }))
  ].filter((row) => (status === "all" || row.status === status) && (category === "all" || row.category === category)), [complaints, incidents, status, category]);
  const urgent = rows.filter((row) => row.urgent || row.severity === "critical" || row.severity === "high").length;
  const resolvedThisMonth = rows.filter((row) => ["resolved", "closed"].includes(row.status) && row.updated_at && new Date(row.updated_at).getMonth() === new Date().getMonth()).length;

  return (
    <>
      <div className="grid cols-4 dashboard-kpis"><div className="card stat-card"><MessageSquareReply /> חדשים <b>{rows.filter((r) => r.status === "new").length}</b></div><div className="card stat-card"><AlertCircle /> דחופים <b>{urgent}</b></div><div className="card stat-card"><Clock /> באיחור <b>{rows.filter((r) => r.response_due_at && new Date(r.response_due_at) < new Date()).length}</b></div><div className="card stat-card"><CheckCircle2 /> נפתרו החודש <b>{resolvedThisMonth}</b></div></div>
      <section className="filter-bar"><select value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item} value={item}>{item === "all" ? "כל הסטטוסים" : item}</option>)}</select><select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((item) => <option key={item} value={item}>{item === "all" ? "כל הקטגוריות" : item}</option>)}</select></section>
      {message ? <div className="success-banner">{message}</div> : null}
      <section className="dashboard-section">{rows.length === 0 ? <div className="empty-state"><strong>אין דיווחים ופניות להצגה</strong><span>פניות מהורים, צוות, מנהלות, פקחים והאתר הציבורי יופיעו כאן עם פעולות טיפול.</span></div> : <div className="procedure-list">{rows.map((row) => <article className="card procedure-card" key={`${row.source}-${row.id}`}><div><span className={row.severity === "critical" || row.severity === "high" ? "pill bad" : "pill warn"}>{row.severity ?? "medium"} · {row.category}</span><h3>{row.title}</h3><p>{row.description ?? row.body ?? ""}</p><small>{row.gardens?.name ?? row.garden_id ?? "ללא גן"} · {row.children?.full_name ?? "ללא ילד"} · {row.created_at ? new Date(row.created_at).toLocaleString("he-IL") : ""}</small></div><div className="procedure-meta"><span className="pill">{row.status ?? "new"}</span><button className="button secondary" type="button" onClick={() => setMessage("תגובה תירשם בציר הטיפול לאחר בחירת מטפל.")}>תגובה</button><button className="button secondary" type="button" onClick={() => setMessage("שיוך מטפל יישמר אחרי בחירת משתמש מהרשימה.")}>שיוך מטפל</button><Link className="button secondary" href={`/dashboard/admin/tasks?source=${row.source}&id=${row.id}`}><PlusCircle size={15} /> משימה</Link>{row.garden_id ? <Link className="button" href={`/dashboard/admin/gardens/${row.garden_id}`}>פרופיל גן</Link> : null}</div></article>)}</div>}</section>
    </>
  );
}
