"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CollapsibleActionPanel } from "@/components/collapsible-action-panel";

type Row = Record<string, any>;

async function postTask(payload: Row) {
  const response = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "יצירת משימה נכשלה");
  return body.data;
}

export function AdminTaskEngine({ tasks, users, gardens }: { tasks: Row[]; users: Row[]; gardens: Row[] }) {
  const [rows, setRows] = useState(tasks);
  const [role, setRole] = useState("manager");
  const [gardenId, setGardenId] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filteredUsers = useMemo(() => users.filter((user) => (!role || user.role === role) && (!gardenId || user.garden_id === gardenId || user.role === "inspector")), [users, role, gardenId]);

  async function submit(event: FormEvent<HTMLFormElement>, close?: () => void) {
    event.preventDefault(); setMessage(null); setError(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const created = await postTask({
        garden_id: String(data.garden_id || "") || undefined,
        assigned_to: String(data.assigned_to || "") || undefined,
        assigned_role: String(data.assigned_role || role),
        assigned_group: String(data.assigned_group || ""),
        title: String(data.title),
        description: String(data.description || ""),
        due_at: String(data.due_at || "") || undefined,
        priority: String(data.priority || "medium"),
        repeat_rule: String(data.repeat_rule || ""),
        task_type: String(data.repeat_rule || "") ? "recurring" : "admin"
      });
      setRows((current) => [created, ...current]);
      form.reset();
      setMessage("המשימה נוצרה ותופיע למשתמשים הרלוונטיים.");
      close?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "יצירת משימה נכשלה");
    }
  }

  return <>
    {message ? <div className="success-banner">{message}</div> : null}
    {error ? <div className="error-banner">{error}</div> : null}
    <CollapsibleActionPanel title="יצירת משימה" description="המשימות הקיימות מוצגות למטה. פתחו את הטופס רק כשצריך להקצות משימה חדשה." buttonLabel="יצירת משימה חדשה" defaultOpen={rows.length === 0}>
      {({ close }) => <section className="grid cols-2 dashboard-panels">
      <form className="card form wizard-form" onSubmit={(event) => submit(event, close)}>
        <h2>יצירת משימה</h2>
        <div className="form-grid">
          <label>סוג משתמש<select name="assigned_role" value={role} onChange={(event) => setRole(event.target.value)}><option value="staff">צוות</option><option value="manager">מנהלת</option><option value="owner">בעלים</option><option value="parent">הורים</option><option value="inspector">פקח</option><option value="admin">אדמין</option></select></label>
          <label>גן קשור<select name="garden_id" value={gardenId} onChange={(event) => setGardenId(event.target.value)}><option value="">לא קשור לגן מסוים</option>{gardens.map((garden) => <option key={garden.id} value={garden.id}>{garden.name} · {garden.city}</option>)}</select></label>
          <label>משתמש יעד<select name="assigned_to"><option value="">כל התפקיד / קבוצה</option>{filteredUsers.map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.role}</option>)}</select></label>
          <label>קבוצה<select name="assigned_group"><option value="">ללא</option><option value="all_users">כל המשתמשים</option><option value="all_kindergarten_users">כל משתמשי הגן</option><option value="all_role">כל התפקיד</option></select></label>
          <label>כותרת<input name="title" required /></label>
          <label>דדליין<input name="due_at" type="datetime-local" /></label>
          <label>עדיפות<select name="priority"><option value="low">נמוכה</option><option value="medium">רגילה</option><option value="high">גבוהה</option><option value="critical">קריטית</option></select></label>
          <label>חזרתיות<select name="repeat_rule"><option value="">חד פעמי</option><option value="daily">יומי</option><option value="weekly">שבועי</option><option value="monthly">חודשי</option></select></label>
          <label className="wide">תיאור<textarea name="description" rows={4} /></label>
        </div>
        <div className="profile-actions"><button className="button primary">יצירת משימה</button><button className="button secondary" type="button" onClick={close}>ביטול</button></div>
      </form>
      <article className="card action-panel">
        <h2>מה המשתמש מקבל</h2>
        <div className="risk-list">
          <div>התראה באזור האישי</div>
          <div>פריט משימה עם דדליין ועדיפות</div>
          <div>אפשרות להשלים, לדחות ולהוסיף הערה</div>
          <div>לוג צפייה, ביצוע והסלמה לאדמין</div>
        </div>
      </article>
    </section>}
    </CollapsibleActionPanel>
    <section className="dashboard-section">
      {rows.length === 0 ? <div className="empty-state"><strong>אין משימות עדיין</strong><span>צרו משימה חד פעמית או חוזרת כדי להתחיל מעקב.</span></div> : <div className="procedure-list">{rows.map((task) => <article className="card procedure-card" key={task.id}><div><span className="pill">{task.priority ?? "medium"}</span><h3>{task.title}</h3><p>{task.description ?? ""}</p><small>יעד: {task.assigned_role ?? task.assigned_to ?? "כללי"} · דדליין: {task.due_at ? new Date(task.due_at).toLocaleString("he-IL") : "ללא"}</small></div><div className="procedure-meta"><span className="pill">{task.status ?? "open"}</span></div></article>)}</div>}
    </section>
  </>;
}
