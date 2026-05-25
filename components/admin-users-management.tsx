"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { Avatar } from "@/components/avatar";

type Row = Record<string, any>;

const tabs = [
  ["kindergartens", "גני ילדים / מנהלות"],
  ["owners", "בעלי גן"],
  ["inspectors", "מפקחים"],
  ["staff", "צוות"],
  ["parents", "הורים"],
  ["all", "כל המשתמשים"]
] as const;

async function postAction(userId: string, action: string, extra: Record<string, unknown> = {}) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, action, ...extra })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

function filterRows(rows: Row[], tab: string) {
  if (tab === "all") return rows;
  if (tab === "kindergartens") return rows.filter((row) => row.role === "manager");
  if (tab === "owners") return rows.filter((row) => row.role === "owner");
  if (tab === "inspectors") return rows.filter((row) => row.role === "inspector");
  if (tab === "staff") return rows.filter((row) => row.role === "staff");
  if (tab === "parents") return rows.filter((row) => row.role === "parent");
  return rows;
}

export function AdminUsersManagement({ users, auditLogs }: { users: Row[]; auditLogs: Row[] }) {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("kindergartens");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const rows = useMemo(() => filterRows(users, activeTab), [users, activeTab]);

  async function action(userId: string, actionName: string) {
    setMessage(null); setError(null);
    try {
      const result = await postAction(userId, actionName);
      if (actionName === "send_password_reset") {
        setMessage("נשלח איפוס סיסמה למייל המשתמש.");
      } else if (result?.temporary_password) {
        setMessage(`נוצרה סיסמה חדשה: ${result.username} / ${result.temporary_password}`);
      } else {
        setMessage("הפעולה בוצעה ונרשמה בלוג.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "הפעולה נכשלה");
    }
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setMessage(null); setError(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      await postAction(editing.id, "update_profile", {
        full_name: String(data.full_name || ""),
        phone: String(data.phone || ""),
        role: String(data.role || editing.role),
        garden_id: String(data.garden_id || "") || null,
        active: String(data.active) === "true",
        notes: String(data.notes || ""),
        profile_image_url: String(data.profile_image_url || "")
      });
      setMessage("פרטי המשתמש נשמרו ונרשמו בלוג.");
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שמירת המשתמש נכשלה");
    }
  }

  return (
    <>
      <section className="admin-tabs">
        {tabs.map(([id, label]) => <button className={activeTab === id ? "tab active" : "tab"} key={id} onClick={() => setActiveTab(id)}>{label} <small>{filterRows(users, id).length}</small></button>)}
      </section>
      <section className="quick-actions-grid">
        <Link className="quick-action" href="/dashboard/admin/users/new-kindergarten"><strong>הוספת גן ילדים</strong><span>גן + מנהלת + בעלים</span></Link>
        <Link className="quick-action" href="/dashboard/admin/users/new-inspector"><strong>הוספת מפקח</strong><span>מפקח + שיוך ערים וגנים</span></Link>
      </section>
      {message ? <div className="success-banner">{message}</div> : null}
      {error ? <div className="error-banner">{error}</div> : null}
      {editing ? <section className="modal-card"><form className="card form wizard-form" onSubmit={saveEdit}><div className="section-heading"><h2>עריכת משתמש</h2><p>עדכון פרופיל נשמר ב-Supabase ונרשם בלוג ביקורת.</p></div><div className="form-grid"><label>שם מלא<input name="full_name" defaultValue={editing.full_name ?? ""} /></label><label>טלפון<input name="phone" defaultValue={editing.phone ?? ""} /></label><label>תפקיד<select name="role" defaultValue={editing.role}><option value="admin">admin</option><option value="inspector">inspector</option><option value="manager">manager</option><option value="owner">owner</option><option value="staff">staff</option><option value="parent">parent</option></select></label><label>גן משויך<input name="garden_id" defaultValue={editing.garden_id ?? ""} /></label><label>סטטוס<select name="active" defaultValue={editing.active === false ? "false" : "true"}><option value="true">פעיל</option><option value="false">לא פעיל</option></select></label><label className="wide">תמונת פרופיל URL<input name="profile_image_url" defaultValue={editing.profile_image_url ?? ""} /></label><label className="wide">הערות<textarea name="notes" rows={3} defaultValue={editing.notes ?? ""} /></label></div><div className="actions"><button className="button primary">שמירת שינויים</button><button className="button secondary" type="button" onClick={() => setEditing(null)}>ביטול</button></div></form></section> : null}
      <section className="dashboard-section">
        {rows.length === 0 ? <div className="empty-state"><strong>אין משתמשים להצגה</strong><span>כאשר משתמשים ייווצרו הם יופיעו כאן לפי הרשאה ותפקיד.</span></div> : <div className="procedure-list">{rows.map((user) => {
          const credential = Array.isArray(user.generated_credentials) ? user.generated_credentials[0] : null;
          const garden = user.gardens ?? user.related_garden ?? null;
          const createdBy = user.created_by_profile?.full_name ?? user.created_by ?? "-";
          const passwordChanged = user.must_change_password === false || credential?.password_changed_at;
          const showPassword = user.role !== "parent" && credential && !passwordChanged;
          return <article className="card procedure-card" key={user.id}>
            <div>
              <span className={user.active === false ? "pill bad" : "pill good"}>{user.active === false ? "לא פעיל" : "פעיל"} · {user.role}</span>
              <div className="selected-child-strip mini"><Avatar name={user.full_name} src={user.profile_image_url} /><h3>{user.full_name ?? user.email ?? user.username ?? "משתמש"}</h3></div>
              <p>{user.email ?? credential?.username ?? user.username ?? "-"} · {user.phone ?? "-"}</p>
              <small>גן: {garden?.name ?? user.garden_id ?? "-"} · נוצר: {user.created_at ? new Date(user.created_at).toLocaleDateString("he-IL") : "-"} · כניסה אחרונה: {user.last_login_at ? new Date(user.last_login_at).toLocaleString("he-IL") : "-"}</small>
              <small>נוצר על ידי: {createdBy} · שם משתמש: {credential?.username ?? user.username ?? "-"}</small>
              <div className="credential-box"><b>פרטי כניסה ראשונים:</b> <span>{credential?.username ?? user.email ?? user.username ?? "-"}</span>{showPassword ? <code>{credential.temporary_password}</code> : <strong>{user.role === "parent" ? "סיסמת הורה מוסתרת" : "הסיסמה הוחלפה"}</strong>}</div>
              <details className="audit-details"><summary>היסטוריית ביקורת למשתמש</summary>{auditLogs.filter((log) => log.entity_id === user.id || log.actor_id === user.id).length === 0 ? <small>אין פעולות ישירות.</small> : auditLogs.filter((log) => log.entity_id === user.id || log.actor_id === user.id).map((log) => <small key={log.id}>{log.action} · {log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</small>)}</details>
            </div>
            <div className="procedure-meta">
              <button className="button secondary" type="button" onClick={() => setEditing(user)}>צפייה / עריכה</button>
              {showPassword ? <button className="button secondary" onClick={() => navigator.clipboard?.writeText(`${credential?.username ?? user.username ?? ""}\n${credential?.temporary_password ?? ""}`)}>העתקת פרטים</button> : null}
              <button className="button secondary" onClick={() => action(user.id, "send_password_reset")}>שלח איפוס סיסמה</button>
              <button className="button secondary" onClick={() => action(user.id, "reset_password")}>איפוס ידני</button>
              <button className="button" onClick={() => action(user.id, user.active === false ? "reactivate" : "deactivate")}>{user.active === false ? "הפעלה" : "השבתה"}</button>
            </div>
          </article>;
        })}</div>}
      </section>
      <section className="card action-panel">
        <h2>Audit history</h2>
        {auditLogs.length === 0 ? <div className="empty-mini">אין פעולות אחרונות.</div> : auditLogs.map((log) => <div className="list-item" key={log.id}><div><strong>{log.action}</strong><span>{log.actor_role} · {log.created_at ? new Date(log.created_at).toLocaleString("he-IL") : ""}</span></div><span className="pill">{String(log.entity_type ?? "audit")}</span></div>)}
      </section>
    </>
  );
}
