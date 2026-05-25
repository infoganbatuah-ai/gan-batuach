"use client";

import Link from "next/link";
import { useState } from "react";

type Row = Record<string, any>;

async function postDemand(payload: Row) {
  const response = await fetch("/api/admin/inspection-demands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

export function InspectionSupervisionCenter({ dueSoon, late, history }: { dueSoon: Row[]; late: Row[]; history: Row[] }) {
  const [message, setMessage] = useState<string | null>(null);
  async function action(actionName: string, gardenId: string, inspectionId?: string) {
    const reason = actionName === "cancel" || actionName === "override_complete" ? window.prompt("סיבת פעולה") ?? "" : undefined;
    if ((actionName === "cancel" || actionName === "override_complete") && !reason) return;
    await postDemand({ action: actionName, garden_id: gardenId, inspection_id: inspectionId, reason });
    setMessage("הפעולה בוצעה ונרשמה.");
  }
  const table = (rows: Row[], lateMode = false) => rows.length === 0 ? <div className="empty-state"><strong>אין רשומות להצגה</strong><span>המערכת תציג כאן גנים לפי תאריך הפיקוח הבא.</span></div> : <div className="procedure-list">{rows.map((row) => { const due = new Date(row.due_at ?? row.next_inspection_at); const days = Math.ceil((due.getTime() - Date.now()) / 86400000); return <article className="card procedure-card" key={row.id ?? row.garden_id}><div><span className={lateMode ? "pill bad" : "pill warn"}>{lateMode ? `${Math.abs(days)} ימים איחור` : `${days} ימים נותרו`}</span><h3>{row.gardens?.name ?? row.name ?? "גן"}</h3><p>פקח: {row.inspectors?.full_name ?? row.gardens?.inspectors?.full_name ?? "-"}</p><small>תאריך יעד: {due.toLocaleDateString("he-IL")} · ציון אחרון: {row.gardens?.last_inspection_score ?? row.last_inspection_score ?? "-"}</small></div><div className="procedure-meta"><button className="button secondary" onClick={() => action("demand", row.garden_id ?? row.id)}>דרישת פיקוח</button><button className="button secondary" onClick={() => action("notify_inspector", row.garden_id ?? row.id)}>התראה לפקח</button><button className="button secondary" onClick={() => action("notify_kindergarten", row.garden_id ?? row.id)}>התראה לגן</button>{lateMode ? <><button className="button secondary" onClick={() => action("override_complete", row.garden_id ?? row.id, row.inspection_id)}>Override</button><button className="button" onClick={() => action("cancel", row.garden_id ?? row.id)}>ביטול דרישה</button></> : null}</div></article>; })}</div>;
  return <section className="dashboard-section"><div className="section-heading"><h2>פיקוח גני ילדים</h2><p>מעקב דרישות פיקוח חודשיות, איחורים, תזכורות ופעולות אדמין.</p></div>{message ? <div className="success-banner">{message}</div> : null}<h3>גנים שצריכים לבצע פיקוח בקרוב</h3>{table(dueSoon)}<h3>גנים שמאחרים בביצוע פיקוח</h3>{table(late, true)}<h3>היסטוריית דוחות ביקורת</h3>{history.length === 0 ? <div className="empty-mini">אין דוחות עדיין.</div> : <div className="procedure-list">{history.map((inspection) => <article className="card procedure-card" key={inspection.id}><div><strong>{inspection.gardens?.name ?? inspection.garden_id}</strong><span>{inspection.completed_at ? new Date(inspection.completed_at).toLocaleString("he-IL") : inspection.status} · ציון {inspection.weighted_score ?? "-"}</span></div><div className="procedure-meta"><Link className="button secondary" href={`/dashboard/admin/inspections/${inspection.id}/report`}>צפייה בדוח</Link><Link className="button secondary" href={`/dashboard/admin/inspections/${inspection.id}/report`}>הדפסה / PDF</Link></div></article>)}</div>}</section>;
}
