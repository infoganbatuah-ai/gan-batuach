"use client";

import { useMemo, useState, type FormEvent } from "react";

type Procedure = { id: string; title: string; procedure_type?: string; body?: string; required_for_framework?: string; active?: boolean; requires_acknowledgement?: boolean; created_at?: string };
type Garden = { id: string; name: string; city?: string; manager_id?: string | null };
type Acknowledgement = { procedure_id?: string; acknowledged_at?: string; acknowledged_by?: string | null; gardens?: { name?: string } | null; profiles?: { full_name?: string } | null };
type AuditLog = { action?: string; created_at?: string; profiles?: { full_name?: string } | null; after_data?: unknown };

async function postJson(method: "POST" | "PATCH", payload: unknown) {
  const response = await fetch("/api/admin/procedures", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "הפעולה נכשלה");
  return body.data;
}

export function ProceduresManager({ procedures, gardens, acknowledgements, auditLogs }: { procedures: Procedure[]; gardens: Garden[]; acknowledgements: Acknowledgement[]; auditLogs: AuditLog[] }) {
  const [items, setItems] = useState(procedures);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const acknowledgementsByProcedure = useMemo(() => new Map(acknowledgements.map((ack) => [ack.procedure_id, ack])), [acknowledgements]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setError(null);
    const data = Object.fromEntries(new FormData(form).entries());
    const payload = { title: String(data.title), procedure_type: String(data.procedure_type || "תפעול"), body: String(data.body), required_for_framework: String(data.required_for_framework || "all"), active: String(data.status || "active") === "active", requires_acknowledgement: Boolean(data.requires_acknowledgement) };
    try {
      if (editing) {
        const updated = await postJson("PATCH", { id: editing.id, ...payload });
        setItems((current) => current.map((item) => item.id === editing.id ? updated : item));
        setMessage("הנוהל עודכן ונרשם בלוג הביקורת.");
        setEditing(null);
      } else {
        const created = await postJson("POST", payload);
        setItems((current) => [created, ...current]);
        setMessage("נוהל חדש נוצר ונכנס לרשימת הנהלים.");
        form.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  return (
    <div className="procedure-manager">
      {message ? <div className="success-screen"><strong>{message}</strong><small>הפעולה נשמרה דרך API מאובטח ולא דרך דף JSON.</small></div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      <section className="grid cols-2 dashboard-panels">
        <form className="card form wizard-form" onSubmit={submit}>
          <h2>{editing ? "עריכת נוהל" : "יצירת נוהל חדש"}</h2>
          <p>בחרו קטגוריה, קהל יעד, סטטוס וחובת אישור. מנהלי גנים ואנשי צוות יראו נהלים פעילים לפי הרשאה.</p>
          <div className="form-grid">
            <label>כותרת<input name="title" required defaultValue={editing?.title ?? ""} /></label>
            <label>קטגוריה<select name="procedure_type" defaultValue={editing?.procedure_type ?? "בטיחות"}><option>בטיחות</option><option>תברואה</option><option>פרטיות</option><option>מצלמות</option><option>חירום</option><option>כוח אדם</option></select></label>
            <label>שיוך<select name="required_for_framework" defaultValue={editing?.required_for_framework ?? "all"}><option value="all">כל הגנים</option>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name} · {garden.city}</option>)}<option value="manager">מנהלות גן</option><option value="inspector">פקחים</option><option value="staff">צוות</option></select></label>
            <label>סטטוס<select name="status" defaultValue={editing?.active === false ? "draft" : "active"}><option value="active">פעיל</option><option value="draft">טיוטה / ארכיון</option></select></label>
            <label>תאריך יעד<input name="due_at" type="date" /></label>
            <label className="check-row"><input name="requires_acknowledgement" type="checkbox" defaultChecked={editing?.requires_acknowledgement ?? true} /> נדרש אישור קריאה</label>
            <label className="wide">תוכן הנוהל<textarea name="body" required rows={6} defaultValue={editing?.body ?? ""} /></label>
          </div>
          <button className="button primary large">{editing ? "שמירת עריכה" : "יצירת נוהל"}</button>
          {editing ? <button className="button secondary large" type="button" onClick={() => setEditing(null)}>ביטול עריכה</button> : null}
        </form>
        <article className="card action-panel">
          <div className="section-heading"><h2>מעקב צפייה וביצוע</h2><p>מי ראה, מי אישר, ומה נרשם בלוג.</p></div>
          {acknowledgements.length === 0 ? <div className="empty-mini">אין אישורי קריאה עדיין.</div> : acknowledgements.map((ack, index) => <div className="list-item" key={index}><div><strong>{ack.gardens?.name ?? "גן"}</strong><span>{ack.profiles?.full_name ?? "משתמש"} · {ack.acknowledged_at ? new Date(ack.acknowledged_at).toLocaleDateString("he-IL") : "ללא תאריך"}</span></div><span className="pill good">הושלם</span></div>)}
          <div className="mini-divider" /><h3>Audit log</h3>
          {auditLogs.length === 0 ? <div className="empty-mini">אין פעולות נוהל בלוג.</div> : auditLogs.map((log, index) => <div className="document-chip" key={index}><strong>{log.action}</strong><span>{log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</span></div>)}
        </article>
      </section>
      <section className="dashboard-section"><div className="section-heading"><h2>רשימת נהלים</h2><p>נהלים פעילים, טיוטות ונהלים שהועברו לארכיון.</p></div>{items.length === 0 ? <div className="empty-state"><strong>אין נהלים עדיין</strong><span>צרו נוהל ראשון כדי להפעיל בקרה ותיעוד מול הגנים.</span></div> : <div className="procedure-list">{items.map((procedure) => { const ack = acknowledgementsByProcedure.get(procedure.id); return <article className="card procedure-card" key={procedure.id}><div><span className="pill">{procedure.procedure_type ?? "כללי"}</span><h3>{procedure.title}</h3><p>{procedure.body}</p></div><div className="procedure-meta"><span className={procedure.active ? "pill good" : "pill warn"}>{procedure.active ? "פעיל" : "טיוטה / ארכיון"}</span><span>{procedure.requires_acknowledgement ? "נדרש אישור" : "ללא אישור חובה"}</span><span>שיוך: {procedure.required_for_framework ?? "all"}</span><span>נצפה/הושלם: {ack ? "כן" : "טרם"}</span><button className="button secondary" type="button" onClick={() => setEditing(procedure)}>עריכה</button></div></article>; })}</div>}</section>
    </div>
  );
}
