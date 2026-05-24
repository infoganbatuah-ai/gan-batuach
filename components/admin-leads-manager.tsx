"use client";

import Link from "next/link";
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

export function AdminLeadsManager({ leads }: { leads: LeadRow[] }) {
  const [rows, setRows] = useState(leads);
  return (
    <section className="dashboard-section">
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
                {lead.lead_type === "garden" && lead.status !== "converted" ? <Link className="button primary" href={`/dashboard/admin/users/new-kindergarten?leadId=${lead.id}`}>המרה לגן פעיל</Link> : null}
                {lead.lead_type === "inspector" && lead.status !== "converted" ? <Link className="button primary" href={`/dashboard/admin/users/new-inspector?leadId=${lead.id}`}>המרה לפקח פעיל</Link> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
