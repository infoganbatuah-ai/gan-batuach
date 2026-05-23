"use client";

import { useState } from "react";

type LeadRow = {
  id: string;
  lead_type: string;
  parent_name?: string | null;
  garden_name?: string | null;
  owner_name?: string | null;
  manager_name?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  age_groups?: string[] | null;
  capacity?: number | null;
  children_count?: number | null;
  staff_count?: number | null;
  experience?: string | null;
  certifications?: string | null;
  notes?: string | null;
  status?: string | null;
};

type Credentials = { username: string; email: string; temporary_password: string };

async function postJson(url: string, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "הפעולה נכשלה");
  return body.data;
}

function CopyCredentials({ credentials }: { credentials: Credentials }) {
  const text = "Username: " + credentials.username + "\nPassword: " + credentials.temporary_password;
  return <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(text)}>העתקת פרטי כניסה</button>;
}

export function AdminLeadsManager({ leads }: { leads: LeadRow[] }) {
  const [rows, setRows] = useState(leads);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ title: string; credentials?: Credentials; owner?: Credentials | null } | null>(null);

  async function convertGarden(lead: LeadRow) {
    setBusyId(lead.id);
    setError(null);
    setSuccess(null);
    try {
      const data = await postJson("/api/admin/create-garden-manager", {
        source_lead_id: lead.id,
        garden: {
          name: lead.garden_name || "גן חדש",
          city: lead.city || "לא צוין",
          address: lead.address || "",
          owner_name: lead.owner_name || lead.manager_name || "בעלים",
          phone: lead.phone || "",
          email: lead.email || undefined,
          framework_type: "mixed",
          children_capacity: Number(lead.capacity || lead.children_count || 0),
          staff_count: Number(lead.staff_count || 0)
        },
        manager: { full_name: lead.manager_name || lead.owner_name || "מנהלת גן", email: lead.email || undefined, phone: lead.phone || "" }
      });
      setRows((current) => current.map((row) => row.id === lead.id ? { ...row, status: "converted" } : row));
      setSuccess({ title: "הליד הומר לגן פעיל", credentials: data.credentials.manager, owner: data.credentials.owner });
    } catch (err) {
      setError(err instanceof Error ? err.message : "המרה נכשלה");
    } finally {
      setBusyId(null);
    }
  }

  async function convertInspector(lead: LeadRow) {
    setBusyId(lead.id);
    setError(null);
    setSuccess(null);
    try {
      const cities = String(lead.city || "כללי").split(",").map((city) => city.trim()).filter(Boolean);
      const data = await postJson("/api/admin/create-inspector", {
        source_lead_id: lead.id,
        full_name: lead.parent_name || "פקח חדש",
        email: lead.email || undefined,
        phone: lead.phone || "",
        service_cities: cities.length ? cities : ["כללי"],
        certification_notes: [lead.experience, lead.certifications, lead.notes].filter(Boolean).join("\n")
      });
      setRows((current) => current.map((row) => row.id === lead.id ? { ...row, status: "converted" } : row));
      setSuccess({ title: "הליד הומר לפקח פעיל", credentials: data.credentials });
    } catch (err) {
      setError(err instanceof Error ? err.message : "המרה נכשלה");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="dashboard-section">
      {error ? <div className="error-banner">{error}</div> : null}
      {success ? (
        <div className="success-screen">
          <strong>{success.title}</strong>
          {success.credentials ? <div className="credential-box" dir="ltr"><span>Username: {success.credentials.username}</span><span>Password: {success.credentials.temporary_password}</span><CopyCredentials credentials={success.credentials} /></div> : null}
          <small>פרטי הכניסה מוצגים כאן פעם אחת בלבד.</small>
        </div>
      ) : null}
      {rows.length === 0 ? <div className="empty-state"><strong>אין לידים להצגה</strong><span>בקשות מגנים ומפקחים יופיעו כאן.</span></div> : (
        <div className="procedure-list">
          {rows.map((lead) => (
            <article className="card procedure-card" key={lead.id}>
              <div>
                <span className="pill">{lead.lead_type === "garden" ? "גן" : lead.lead_type === "inspector" ? "מפקח" : "הורה"}</span>
                <h3>{lead.garden_name || lead.parent_name || "ליד חדש"}</h3>
                <p>{lead.city || "ללא עיר"} · {lead.phone || "ללא טלפון"} · {lead.email || "ללא אימייל"}</p>
                <small>{lead.notes || lead.experience || ""}</small>
              </div>
              <div className="procedure-meta">
                <span className="pill">{lead.status || "new"}</span>
                {lead.lead_type === "garden" && lead.status !== "converted" ? <button className="button primary" disabled={busyId === lead.id} onClick={() => convertGarden(lead)}>המרה לגן פעיל</button> : null}
                {lead.lead_type === "inspector" && lead.status !== "converted" ? <button className="button primary" disabled={busyId === lead.id} onClick={() => convertInspector(lead)}>המרה לפקח פעיל</button> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
