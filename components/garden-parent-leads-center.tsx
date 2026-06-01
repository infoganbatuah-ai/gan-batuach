"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Copy, Eye, UserRoundPlus } from "lucide-react";

type Lead = Record<string, any>;
type Credentials = { username: string; email: string; temporary_password: string };

const statusLabels: Record<string, string> = {
  new: "חדש",
  viewed: "נצפה",
  missing_details: "חסרים פרטים",
  parent_approved_pending_child_completion: "הורה פעיל - ממתין להשלמת ילד",
  approved_pending_parent_completion: "אושר - ממתין להשלמת הורה",
  active: "פעיל",
  rejected: "נדחה",
  converted: "הומר",
  new_parent_lead: "חדש"
};

export function GardenParentLeadsCenter({ leads }: { leads: Lead[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(leads);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [message, setMessage] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingConversionStatuses = useMemo(() => new Set(["new", "new_parent_lead", "viewed", "missing_details"]), []);

  useEffect(() => {
    setRows(leads);
  }, [leads]);

  async function markViewed(lead: Lead) {
    if (["viewed", "parent_approved_pending_child_completion", "approved_pending_parent_completion", "active", "converted"].includes(lead.status)) return;
    const response = await fetch(`/api/garden/leads/${lead.id}/status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "viewed" }) }).catch(() => null);
    if (response?.ok) {
      setRows((current) => current.map((row) => row.id === lead.id ? { ...row, status: "viewed" } : row));
      setActiveLead((current) => current?.id === lead.id ? { ...current, status: "viewed" } : current);
    }
  }

  async function convert(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeLead) return;
    setBusy(true);
    setMessage("");
    setCredentials(null);
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const response = await fetch(`/api/garden/leads/${activeLead.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parent_name: String(data.parent_name || ""),
          phone: String(data.phone || ""),
          identity_number: String(data.identity_number || ""),
          email: String(data.email || "") || undefined,
          child_name: String(data.child_name || ""),
          child_identity_number: activeLead.child_identity_number ?? "",
          child_age: String(data.child_age || ""),
          requested_age_group: String(data.requested_age_group || ""),
          address: String(data.address || ""),
          requested_start_date: String(data.requested_start_date || ""),
          notes: String(data.notes || "")
        })
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "המרת הליד נכשלה");
      setCredentials(body.data.credentials ?? null);
      setMessage(body.data.existing_user ? "ההורה הקיים קושר לגן ונוצר כרטיס ילד להשלמה." : "נוצר הורה פעיל וכרטיס ילד להשלמת פרטים.");
      setRows((current) => current.filter((lead) => lead.id !== activeLead.id));
      setActiveLead((current) => current ? { ...current, status: body.data.lead_status ?? "parent_approved_pending_child_completion" } : current);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "המרת הליד נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="lead-center-layout">
      <section className="dashboard-section">
        {rows.length === 0 ? (
          <div className="empty-state">
            <strong>אין בקשות הצטרפות חדשות</strong>
            <span>כאשר הורה ישלח בקשת רישום מעמוד גן ציבורי, היא תופיע כאן. בקשות שהומרו מוסרות מיד מרשימת הטיפול.</span>
          </div>
        ) : (
          <div className="people-card-grid">
            {rows.map((lead) => (
              <article className="person-card lead-request-card" key={lead.id}>
                <div className="person-card-top">
                  <div className="avatar avatar-lg">{String(lead.parent_name ?? "ה").slice(0, 1)}</div>
                  <div>
                    <span className={lead.status === "new" || lead.status === "new_parent_lead" ? "pill warn" : lead.status === "rejected" ? "pill bad" : "pill good"}>{statusLabels[lead.status] ?? lead.status}</span>
                    <h3>{lead.parent_name ?? "הורה ללא שם"}</h3>
                    <p>{lead.phone ?? "אין טלפון"} · {lead.email ?? "אין מייל"}</p>
                  </div>
                </div>
                <div className="profile-badge-row">
                  <span className="pill">ילד: {lead.child_name ?? "לא צוין"}</span>
                  <span className="pill">ת״ז ילד: {lead.child_identity_number ?? "לא צוינה"}</span>
                  <span className="pill">ת״ז הורה: {lead.parent_identity_number ?? "לא צוינה"}</span>
                  <span className="pill">גיל: {lead.child_age ?? "לא צוין"}</span>
                  <span className="pill">קבוצה: {lead.requested_age_group ?? "לא צוין"}</span>
                  <span className="pill">מקור: {lead.source ?? "עמוד ציבורי"}</span>
                </div>
                <details className="profile-expand">
                  <summary>פרטי בקשה</summary>
                  <div className="profile-details-grid">
                    <section><h4>גן מבוקש</h4><p>{lead.gardens?.name ?? "הגן שלך"}</p><p>{lead.gardens?.city ?? ""}</p></section>
                    <section><h4>פרטי רישום</h4><p>כתובת: {lead.address ?? "לא צוינה"}</p><p>תחילת גן: {lead.requested_start_date ? new Date(lead.requested_start_date).toLocaleDateString("he-IL") : "לא צוינה"}</p></section>
                    <section><h4>הערות</h4><p>{lead.notes || "אין הערות"}</p></section>
                    <section><h4>חסרים</h4><p>{Array.isArray(lead.missing_details) && lead.missing_details.length ? lead.missing_details.join(", ") : "טרם נבדק"}</p></section>
                    <section><h4>זמן</h4><p>{lead.created_at ? new Date(lead.created_at).toLocaleString("he-IL") : "-"}</p></section>
                  </div>
                </details>
                <div className="profile-actions">
                  <button className="button secondary tiny" type="button" onClick={() => { setActiveLead(lead); void markViewed(lead); }}><Eye size={14} /> סקירה</button>
                  {pendingConversionStatuses.has(String(lead.status)) ? (
                    <button className="button primary tiny" type="button" onClick={() => setActiveLead(lead)}><UserRoundPlus size={14} /> אישור ליד הורה</button>
                  ) : (
                    <span className="pill good">לא ממתין להמרה</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {activeLead ? (
        <section className="card action-panel lead-conversion-panel">
          <div className="section-heading">
            <div><h2>אישור בקשה והפעלת הורה</h2><p>נוצר/מקושר משתמש הורה פעיל וכרטיס ילד במצב “ממתין להשלמת פרטים”. הילד לא יהיה פעיל עד אישור מנהלת.</p></div>
            <button className="button secondary tiny" type="button" onClick={() => setActiveLead(null)}>סגירה</button>
          </div>
          <form className="form-grid" onSubmit={convert}>
            <label>שם הורה<input name="parent_name" required defaultValue={activeLead.parent_name ?? ""} /></label>
            <label>טלפון<input name="phone" required defaultValue={activeLead.phone ?? ""} /></label>
            <label>תעודת זהות הורה<input name="identity_number" required defaultValue={activeLead.parent_identity_number ?? ""} /></label>
            <label>מייל<input name="email" type="email" defaultValue={activeLead.email ?? ""} /></label>
            <label>שם ילד<input name="child_name" defaultValue={activeLead.child_name ?? ""} /></label>
            <label>גיל / תאריך לידה<input name="child_age" defaultValue={activeLead.child_age ?? ""} /></label>
            <label>קבוצת גיל מבוקשת<input name="requested_age_group" defaultValue={activeLead.requested_age_group ?? ""} /></label>
            <label>תאריך התחלה מבוקש<input name="requested_start_date" type="date" defaultValue={activeLead.requested_start_date ? String(activeLead.requested_start_date).slice(0, 10) : ""} /></label>
            <label className="wide">כתובת מלאה<input name="address" defaultValue={activeLead.address ?? ""} /></label>
            <label className="wide">הערות<textarea name="notes" rows={3} defaultValue={activeLead.notes ?? ""} /></label>
            <button className="button primary large wide" disabled={busy}><CheckCircle2 size={16} /> אישור הורה ופתיחת כרטיס ילד להשלמה</button>
          </form>
          {message ? <div className={message.includes("נוצר") || message.includes("קושר") ? "success-banner" : "error-banner"}>{message}</div> : null}
          {credentials ? <div className="credential-box" dir="ltr">
            <span>Username: {credentials.username}</span>
            <span>Password: {credentials.temporary_password}</span>
            <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(`Username: ${credentials.username}\nPassword: ${credentials.temporary_password}`)}><Copy size={14} /> העתקת פרטי כניסה</button>
            <small>הפרטים יישארו זמינים למנהלת עד שההורה יחליף סיסמה.</small>
          </div> : null}
        </section>
      ) : null}
    </div>
  );
}
